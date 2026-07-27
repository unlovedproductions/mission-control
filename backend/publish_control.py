"""ShadowCast publish / OAuth / social queue / analytics proxies."""

from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["publish"])


class PublishRequest(BaseModel):
    job_id: str
    platform: str = "youtube"
    dry_run: bool = False
    title: Optional[str] = None
    description: Optional[str] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class PublishBatchRequest(BaseModel):
    job_ids: List[str]
    platform: str = "youtube"
    dry_run: bool = False


class SocialScheduleRequest(BaseModel):
    job_id: str
    platform: str
    scheduled_at: Optional[str] = None
    dry_run: bool = False
    payload: Dict[str, Any] = Field(default_factory=dict)


async def _sc_get(path: str, timeout: float = 15.0):
    from main import get_config

    config = get_config()
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.get(f"{config['shadowcast_url']}{path}")
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"ShadowCast GET {path} failed: {r.status_code} {r.text[:200]}",
        )
    return r.json()


async def _sc_post(path: str, body: dict, timeout: float = 60.0):
    from main import _service_headers, get_config

    config = get_config()
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(
            f"{config['shadowcast_url']}{path}",
            json=body,
            headers=_service_headers(config),
        )
    if r.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"ShadowCast POST {path} failed: {r.status_code} {r.text[:200]}",
        )
    return r.json()


@router.get("/api/publish/oauth/status")
async def oauth_status():
    return await _sc_get("/api/oauth/status")


@router.get("/api/publish/postable")
async def postable_jobs():
    return await _sc_get("/api/jobs/postable")


@router.post("/api/publish")
async def publish_one(req: PublishRequest):
    from main import log_activity

    body = {
        "job_id": req.job_id,
        "platform": req.platform,
        "dry_run": req.dry_run,
        **({"title": req.title} if req.title else {}),
        **({"description": req.description} if req.description else {}),
        **req.extra,
    }
    result = await _sc_post("/api/publish", body)
    log_activity("publish", f"{req.platform}:{req.job_id}")
    return result


@router.post("/api/publish/batch")
async def publish_batch(req: PublishBatchRequest):
    from main import log_activity

    result = await _sc_post(
        "/api/publish/batch",
        {
            "job_ids": req.job_ids,
            "platform": req.platform,
            "dry_run": req.dry_run,
        },
    )
    log_activity("publish_batch", f"{req.platform}:{len(req.job_ids)} jobs")
    return result


@router.get("/api/publish/social/queue")
async def social_queue():
    return await _sc_get("/api/social/queue")


@router.post("/api/publish/social/schedule")
async def social_schedule(req: SocialScheduleRequest):
    from main import log_activity

    body = {
        "job_id": req.job_id,
        "platform": req.platform,
        "dry_run": req.dry_run,
        **({"scheduled_at": req.scheduled_at} if req.scheduled_at else {}),
        **req.payload,
    }
    result = await _sc_post("/api/social/schedule", body)
    log_activity("social_schedule", f"{req.platform}:{req.job_id}")
    return result


@router.post("/api/publish/social/queue/process")
async def social_queue_process(dry_run: bool = False):
    from main import log_activity

    result = await _sc_post("/api/social/queue/process", {"dry_run": dry_run})
    log_activity("social_queue_process", f"dry_run={dry_run}")
    return result


@router.get("/api/publish/analytics/dashboard")
async def sc_analytics_dashboard():
    return await _sc_get("/api/analytics/dashboard")


@router.get("/api/publish/analytics/hooks")
async def sc_analytics_hooks():
    return await _sc_get("/api/analytics/hooks")


@router.get("/api/publish/analytics/formats")
async def sc_analytics_formats():
    return await _sc_get("/api/analytics/formats")


@router.get("/api/publish/analytics/revenue")
async def sc_analytics_revenue():
    return await _sc_get("/api/analytics/revenue")
