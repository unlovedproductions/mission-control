"""ShadowCast publish / OAuth / social queue / analytics proxies.

Payloads match ShadowCast contracts in ~/shadowcast-/backend/app.py:
- POST /api/publish requires job_id + hook_type + platform
- POST /api/publish/batch is one job across platforms[]
- POST /api/social/schedule uses scheduled_time (not scheduled_at)
"""

from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["publish"])


class PublishRequest(BaseModel):
    job_id: str
    platform: str = "youtube"
    hook_type: str = "curiosity"
    video_format: str = "short_form"
    product_slug: Optional[str] = None
    dry_run: bool = False
    thumbnail_variant: str = "variant_a"
    extra: Dict[str, Any] = Field(default_factory=dict)


class PublishBatchRequest(BaseModel):
    job_id: str
    hook_type: str
    platforms: List[str]
    video_format: str = "short_form"
    product_slug: Optional[str] = None
    dry_run: bool = False
    thumbnail_variant: str = "variant_a"


class SocialScheduleRequest(BaseModel):
    job_id: str
    platform: str
    scheduled_time: str
    hook_type: Optional[str] = None
    video_format: str = "short_form"
    caption: str = ""
    hashtags: List[str] = Field(default_factory=list)
    product_slug: Optional[str] = None
    video_path: Optional[str] = None
    # Backward-compat alias from older MC clients
    scheduled_at: Optional[str] = None


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
        "hook_type": req.hook_type,
        "video_format": req.video_format,
        "dry_run": req.dry_run,
        "thumbnail_variant": req.thumbnail_variant,
        **({"product_slug": req.product_slug} if req.product_slug else {}),
        **req.extra,
    }
    result = await _sc_post("/api/publish", body)
    log_activity("publish", f"{req.platform}:{req.job_id}:{req.hook_type}")
    return result


@router.post("/api/publish/batch")
async def publish_batch(req: PublishBatchRequest):
    from main import log_activity

    body = {
        "job_id": req.job_id,
        "hook_type": req.hook_type,
        "video_format": req.video_format,
        "platforms": req.platforms,
        "dry_run": req.dry_run,
        "thumbnail_variant": req.thumbnail_variant,
        **({"product_slug": req.product_slug} if req.product_slug else {}),
    }
    result = await _sc_post("/api/publish/batch", body)
    log_activity("publish_batch", f"{req.job_id}:{','.join(req.platforms)}")
    return result


@router.get("/api/publish/social/queue")
async def social_queue():
    return await _sc_get("/api/social/queue")


@router.post("/api/publish/social/schedule")
async def social_schedule(req: SocialScheduleRequest):
    from main import log_activity

    scheduled_time = req.scheduled_time or req.scheduled_at
    if not scheduled_time:
        raise HTTPException(status_code=400, detail="scheduled_time is required")

    body = {
        "job_id": req.job_id,
        "platform": req.platform,
        "scheduled_time": scheduled_time,
        "caption": req.caption,
        "hashtags": req.hashtags,
        "video_format": req.video_format,
        **({"hook_type": req.hook_type} if req.hook_type else {}),
        **({"product_slug": req.product_slug} if req.product_slug else {}),
        **({"video_path": req.video_path} if req.video_path else {}),
    }
    result = await _sc_post("/api/social/schedule", body)
    log_activity("social_schedule", f"{req.platform}:{req.job_id}")
    return result


@router.post("/api/publish/social/queue/process")
async def social_queue_process(dry_run: bool = False):
    from main import _service_headers, get_config, log_activity

    config = get_config()
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{config['shadowcast_url']}/api/social/queue/process",
            params={"dry_run": dry_run},
            headers=_service_headers(config),
        )
    if r.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"ShadowCast queue process failed: {r.status_code} {r.text[:200]}",
        )
    log_activity("social_queue_process", f"dry_run={dry_run}")
    return r.json()


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
