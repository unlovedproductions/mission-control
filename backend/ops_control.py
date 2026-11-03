"""Ops surface — service registry health, failed jobs, refresh summary."""

from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["ops"])


class ServiceUpdate(BaseModel):
    name: str
    base_url: Optional[str] = None
    health_path: Optional[str] = None
    kind: Optional[str] = None
    ui_url: Optional[str] = None
    enabled: Optional[bool] = None


@router.get("/api/ops/overview")
async def ops_overview():
    from main import get_db

    conn = get_db()
    services = [dict(r) for r in conn.execute("SELECT * FROM services ORDER BY name").fetchall()]
    refresh = conn.execute(
        """SELECT r.* FROM refresh_runs r
           INNER JOIN (
             SELECT marketplace, MAX(id) AS max_id FROM refresh_runs GROUP BY marketplace
           ) t ON r.id = t.max_id"""
    ).fetchall()
    failed = conn.execute(
        """SELECT id, product_name, status, error_message, created_at, script_json
           FROM video_jobs
           WHERE status IN ('failed', 'partial', 'cancelled')
           ORDER BY created_at DESC LIMIT 20"""
    ).fetchall()
    activity = conn.execute(
        "SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 25"
    ).fetchall()
    schedules = [dict(r) for r in conn.execute("SELECT * FROM schedules ORDER BY kind").fetchall()]
    conn.close()
    return {
        "services": services,
        "refresh_runs": [dict(r) for r in refresh],
        "problem_jobs": [dict(r) for r in failed],
        "activity": [dict(r) for r in activity],
        "schedules": schedules,
    }


@router.get("/api/ops/services")
async def list_services():
    from main import get_db

    conn = get_db()
    rows = conn.execute("SELECT * FROM services ORDER BY name").fetchall()
    conn.close()
    return {"services": [dict(r) for r in rows]}


@router.put("/api/ops/services")
async def update_service(req: ServiceUpdate):
    from main import get_db, log_activity

    conn = get_db()
    row = conn.execute("SELECT * FROM services WHERE name = ?", (req.name,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Service not found")
    fields = []
    values = []
    for col in ("base_url", "health_path", "kind", "ui_url"):
        val = getattr(req, col)
        if val is not None:
            fields.append(f"{col} = ?")
            values.append(val)
    if req.enabled is not None:
        fields.append("enabled = ?")
        values.append(1 if req.enabled else 0)
    if not fields:
        conn.close()
        return dict(row)
    values.append(req.name)
    conn.execute(f"UPDATE services SET {', '.join(fields)} WHERE name = ?", values)
    conn.commit()
    updated = conn.execute("SELECT * FROM services WHERE name = ?", (req.name,)).fetchone()
    conn.close()
    log_activity("service_updated", req.name)
    return dict(updated)


@router.get("/api/ops/schedules")
async def list_schedules():
    from main import get_db

    conn = get_db()
    rows = conn.execute("SELECT * FROM schedules ORDER BY kind").fetchall()
    conn.close()
    return {"schedules": [dict(r) for r in rows]}


class ScheduleUpdate(BaseModel):
    kind: str
    interval_minutes: Optional[int] = None
    enabled: Optional[bool] = None
    marketplace: Optional[str] = None
    payload: Optional[str] = None


@router.put("/api/ops/schedules")
async def update_schedule(req: ScheduleUpdate):
    from main import get_db, log_activity

    conn = get_db()
    row = conn.execute("SELECT * FROM schedules WHERE kind = ?", (req.kind,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Schedule not found")
    fields = []
    values = []
    if req.interval_minutes is not None:
        fields.append("interval_minutes = ?")
        values.append(req.interval_minutes)
    if req.enabled is not None:
        fields.append("enabled = ?")
        values.append(1 if req.enabled else 0)
    if req.marketplace is not None:
        fields.append("marketplace = ?")
        values.append(req.marketplace)
    if req.payload is not None:
        fields.append("payload = ?")
        values.append(req.payload)
    if fields:
        values.append(req.kind)
        conn.execute(f"UPDATE schedules SET {', '.join(fields)} WHERE kind = ?", values)
        conn.commit()
    updated = conn.execute("SELECT * FROM schedules WHERE kind = ?", (req.kind,)).fetchone()
    conn.close()
    log_activity("schedule_updated", req.kind)
    return dict(updated)
