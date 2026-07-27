"""Background scheduler — APF refresh/enrich + ShadowCast social queue drain."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger("mission_control.scheduler")

_task: Optional[asyncio.Task] = None
_stop = asyncio.Event()


def _utcnow() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _due(last_run: str, interval_minutes: int) -> bool:
    if not last_run:
        return True
    try:
        last = datetime.fromisoformat(last_run)
        if last.tzinfo is not None:
            last = last.replace(tzinfo=None)
        elapsed = (datetime.utcnow() - last).total_seconds()
        return elapsed >= interval_minutes * 60
    except Exception:
        return True


async def _mark_run(kind: str, ok: bool, detail: str = ""):
    from main import get_db, log_activity

    conn = get_db()
    conn.execute(
        "UPDATE schedules SET last_run = ?, last_status = ?, last_detail = ? WHERE kind = ?",
        (_utcnow(), "ok" if ok else "error", detail[:500], kind),
    )
    conn.commit()
    conn.close()
    log_activity(f"schedule_{kind}", "ok" if ok else f"error: {detail[:200]}")


async def _run_apf_refresh(marketplace: str):
    from main import _apf_trpc_post, get_config, get_db, log_activity

    config = get_config()
    conn = get_db()
    conn.execute(
        """INSERT INTO refresh_runs (marketplace, status, started_at)
           VALUES (?, 'running', datetime('now'))""",
        (marketplace,),
    )
    run_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    try:
        async with httpx.AsyncClient(timeout=900.0) as client:
            result = await _apf_trpc_post(
                client, config, "products.refresh", {"platform": marketplace}
            )
        count = 0
        if isinstance(result, dict):
            count = int(result.get("productsCount") or result.get("count") or 0)
        conn = get_db()
        conn.execute(
            """UPDATE refresh_runs SET status = ?, finished_at = datetime('now'),
               product_count = ?, error = ? WHERE id = ?""",
            ("ok" if result is not None else "error", count,
             "" if result is not None else "APF returned null", run_id),
        )
        conn.commit()
        conn.close()
        await _mark_run("apf_refresh", result is not None, marketplace)
    except Exception as e:
        conn = get_db()
        conn.execute(
            """UPDATE refresh_runs SET status = 'error', finished_at = datetime('now'),
               error = ? WHERE id = ?""",
            (str(e)[:500], run_id),
        )
        conn.commit()
        conn.close()
        await _mark_run("apf_refresh", False, str(e))
        log_activity("apf_refresh_failed", f"{marketplace}: {e}")


async def _run_apf_enrich():
    from main import _apf_trpc_post, get_config

    config = get_config()
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            result = await _apf_trpc_post(client, config, "products.queueEnrichment", {})
        await _mark_run("apf_enrich", result is not None, str(result)[:200])
    except Exception as e:
        await _mark_run("apf_enrich", False, str(e))


async def _run_sc_queue_process():
    from main import _service_headers, get_config

    config = get_config()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{config['shadowcast_url']}/api/social/queue/process",
                json={"dry_run": False},
                headers=_service_headers(config),
            )
        await _mark_run(
            "sc_queue_process",
            r.status_code in (200, 201),
            r.text[:200],
        )
    except Exception as e:
        await _mark_run("sc_queue_process", False, str(e))


async def _tick():
    from main import get_db

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM schedules WHERE enabled = 1"
    ).fetchall()
    conn.close()
    for row in rows:
        kind = row["kind"]
        if not _due(row["last_run"] or "", int(row["interval_minutes"] or 60)):
            continue
        marketplace = row["marketplace"] or "clickbank"
        try:
            if kind == "apf_refresh":
                await _run_apf_refresh(marketplace)
            elif kind == "apf_enrich":
                await _run_apf_enrich()
            elif kind == "sc_queue_process":
                await _run_sc_queue_process()
            else:
                logger.warning("Unknown schedule kind: %s", kind)
        except Exception:
            logger.exception("Schedule tick failed for %s", kind)


async def _loop():
    logger.info("Scheduler started")
    while not _stop.is_set():
        try:
            await _tick()
        except Exception:
            logger.exception("Scheduler tick error")
        try:
            await asyncio.wait_for(_stop.wait(), timeout=60.0)
            break
        except asyncio.TimeoutError:
            continue
    logger.info("Scheduler stopped")


def start_scheduler():
    global _task
    _stop.clear()
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


def stop_scheduler():
    _stop.set()
