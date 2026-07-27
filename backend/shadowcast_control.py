"""ShadowCast production-control proxies — readiness, TTS, audit, retry, files."""

from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["shadowcast-control"])


@router.get("/api/shadowcast/readiness")
async def shadowcast_readiness():
    from main import get_config

    config = get_config()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{config['shadowcast_url']}/api/readiness")
        if r.status_code != 200:
            raise HTTPException(
                status_code=502, detail=f"ShadowCast readiness returned {r.status_code}"
            )
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ShadowCast readiness unreachable: {e}")


@router.get("/api/shadowcast/tts-providers")
async def shadowcast_tts_providers():
    from main import get_config

    config = get_config()
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{config['shadowcast_url']}/api/tts-providers")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="ShadowCast TTS providers unavailable")
    return r.json()


@router.post("/api/shadowcast/jobs/{sc_job_id}/retry-missing")
async def retry_missing(sc_job_id: str):
    from main import _service_headers, get_config, log_activity

    config = get_config()
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{config['shadowcast_url']}/api/retry-missing/{sc_job_id}",
            headers=_service_headers(config),
        )
    if r.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"ShadowCast retry-missing failed: {r.status_code} {r.text[:200]}",
        )
    log_activity("sc_retry_missing", sc_job_id)
    return r.json()


@router.get("/api/shadowcast/jobs/{sc_job_id}/audit")
async def job_audit(sc_job_id: str):
    from main import get_config

    config = get_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{config['shadowcast_url']}/api/audit/{sc_job_id}")
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"ShadowCast audit failed: {r.status_code}",
        )
    return r.json()


@router.get("/api/shadowcast/jobs/{sc_job_id}/files")
async def job_files(sc_job_id: str):
    from main import get_config

    config = get_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{config['shadowcast_url']}/api/files/{sc_job_id}")
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"ShadowCast files failed: {r.status_code}",
        )
    return r.json()


def extract_sc_job_id(script_json: Optional[str]) -> Optional[str]:
    from main import _json_loads

    meta = _json_loads(script_json or "{}", {})
    if isinstance(meta, dict):
        return meta.get("shadowcast_job_id")
    return None
