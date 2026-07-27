"""APF control-plane proxies — enrichment, bookmarks, daemon, refresh runs."""

from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["apf-control"])

MARKETPLACES = [
    "warriorplus",
    "digistore24",
    "clickbank",
    "shareasale",
    "cj",
    "awin",
    "impact",
    "amazon",
]

DIGISTORE_DAEMON_URL = "http://127.0.0.1:3219"


class EnrichRequest(BaseModel):
    product_ids: Optional[List[int]] = None


class BookmarkAdd(BaseModel):
    product_id: int


class BookmarkStatusUpdate(BaseModel):
    product_id: int
    status: str


@router.post("/api/apf/enrich")
async def queue_enrichment(req: EnrichRequest):
    from main import _apf_trpc_post, get_config, log_activity

    config = get_config()
    payload = {}
    if req.product_ids:
        payload["productIds"] = req.product_ids
    async with httpx.AsyncClient(timeout=120.0) as client:
        result = await _apf_trpc_post(client, config, "products.queueEnrichment", payload)
    if result is None:
        raise HTTPException(status_code=502, detail="APF queueEnrichment failed")
    log_activity(
        "apf_enrich_queued",
        f"ids={req.product_ids or 'all'} result={result}",
    )
    return {"status": "ok", "result": result}


@router.get("/api/apf/products/{apf_product_id}/detail")
async def apf_product_detail(apf_product_id: int):
    from main import _apf_trpc_get, get_config

    config = get_config()
    async with httpx.AsyncClient(timeout=30.0) as client:
        detail = await _apf_trpc_get(
            client, config, "products.getDetail", {"id": apf_product_id}
        )
    if detail is None:
        raise HTTPException(status_code=502, detail="APF getDetail failed")
    return {"product": detail}


@router.get("/api/apf/bookmarks")
async def list_bookmarks():
    from main import _apf_trpc_get, get_config

    config = get_config()
    async with httpx.AsyncClient(timeout=30.0) as client:
        bookmarks = await _apf_trpc_get(client, config, "bookmarks.list", {})
    if bookmarks is None:
        raise HTTPException(status_code=502, detail="APF bookmarks.list failed")
    return {"bookmarks": bookmarks if isinstance(bookmarks, list) else []}


@router.post("/api/apf/bookmarks")
async def add_bookmark(req: BookmarkAdd):
    from main import _apf_trpc_post, get_config, log_activity

    config = get_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        result = await _apf_trpc_post(
            client, config, "bookmarks.add", {"productId": req.product_id}
        )
    if result is None:
        raise HTTPException(status_code=502, detail="APF bookmarks.add failed")
    log_activity("apf_bookmark_added", str(req.product_id))
    return {"status": "ok", "result": result}


@router.delete("/api/apf/bookmarks/{product_id}")
async def remove_bookmark(product_id: int):
    from main import _apf_trpc_post, get_config, log_activity

    config = get_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        result = await _apf_trpc_post(
            client, config, "bookmarks.remove", {"productId": product_id}
        )
    if result is None:
        raise HTTPException(status_code=502, detail="APF bookmarks.remove failed")
    log_activity("apf_bookmark_removed", str(product_id))
    return {"status": "ok", "result": result}


@router.put("/api/apf/bookmarks/{product_id}/status")
async def update_bookmark_status(product_id: int, status: str):
    from main import _apf_trpc_post, get_config, log_activity

    config = get_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        result = await _apf_trpc_post(
            client,
            config,
            "bookmarks.updateStatus",
            {"productId": product_id, "status": status},
        )
    if result is None:
        raise HTTPException(status_code=502, detail="APF bookmarks.updateStatus failed")
    log_activity("apf_bookmark_status", f"{product_id}={status}")
    return {"status": "ok", "result": result}


@router.get("/api/apf/daemon")
async def digistore_daemon_status():
    """Probe Digistore Firefox daemon (default 127.0.0.1:3219)."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{DIGISTORE_DAEMON_URL}/health")
            online = r.status_code == 200
            body = {}
            try:
                body = r.json()
            except Exception:
                body = {"raw": r.text[:200]}
            return {
                "status": "online" if online else "error",
                "url": DIGISTORE_DAEMON_URL,
                "detail": body,
            }
    except Exception as e:
        return {
            "status": "offline",
            "url": DIGISTORE_DAEMON_URL,
            "detail": {"error": str(e)},
        }


@router.get("/api/apf/refresh-runs")
async def list_refresh_runs(limit: int = 50):
    from main import get_db

    conn = get_db()
    rows = conn.execute(
        """SELECT * FROM refresh_runs ORDER BY started_at DESC LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return {"runs": [dict(r) for r in rows]}


@router.get("/api/apf/refresh-runs/latest")
async def latest_refresh_by_marketplace():
    from main import get_db

    conn = get_db()
    rows = conn.execute(
        """SELECT r.* FROM refresh_runs r
           INNER JOIN (
             SELECT marketplace, MAX(id) AS max_id FROM refresh_runs GROUP BY marketplace
           ) t ON r.id = t.max_id
           ORDER BY r.marketplace"""
    ).fetchall()
    conn.close()
    return {"runs": [dict(r) for r in rows]}


@router.get("/api/apf/marketplaces")
async def list_marketplaces():
    return {"marketplaces": MARKETPLACES}
