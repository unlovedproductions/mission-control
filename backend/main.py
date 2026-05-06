"""
Unloved Productions — Mission Control Backend
Orchestration layer that sits on top of ShadowCast and APF.
Does NOT modify either app. Communicates via their APIs.
"""

import os
import json
import httpx
import asyncio
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sqlite3
import time
import uuid

# ── App Setup ─────────────────────────────────────────────────────────
app = FastAPI(
    title="Mission Control",
    description="Unloved Productions — Unified Dashboard for ShadowCast + APF",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Configuration ─────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "mission_control.db")

DEFAULT_CONFIG = {
    "shadowcast_url": "http://localhost:8000",
    "apf_url": "http://localhost:3000",
    "ollama_url": "http://localhost:11434",
    "default_script_model": "llama3.1:8b",
    "default_analysis_model": "llama3.1:8b",
    "default_creative_model": "mistral:7b-instruct",
    "heavy_reasoning_model": "mixtral:8x7b-instruct-v0.1-q4_K_M",
}


# ── Database ──────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            marketplace TEXT NOT NULL,
            price TEXT DEFAULT '',
            commission TEXT DEFAULT '',
            gravity_score REAL DEFAULT 0,
            category TEXT DEFAULT '',
            url TEXT DEFAULT '',
            description TEXT DEFAULT '',
            scraped_at TEXT DEFAULT '',
            status TEXT DEFAULT 'new',
            ai_analysis TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS video_jobs (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            status TEXT DEFAULT 'queued',
            job_type TEXT DEFAULT 'both',
            script_model TEXT DEFAULT '',
            short_form_path TEXT DEFAULT '',
            long_form_path TEXT DEFAULT '',
            script_json TEXT DEFAULT '',
            error_message TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            started_at TEXT DEFAULT '',
            completed_at TEXT DEFAULT '',
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS calendar_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            event_type TEXT DEFAULT 'video_publish',
            scheduled_date TEXT NOT NULL,
            product_id TEXT DEFAULT '',
            video_job_id TEXT DEFAULT '',
            status TEXT DEFAULT 'scheduled',
            platform TEXT DEFAULT 'youtube',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            details TEXT DEFAULT '',
            timestamp TEXT DEFAULT (datetime('now'))
        );
    """)

    # Seed default config
    for key, value in DEFAULT_CONFIG.items():
        conn.execute(
            "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
            (key, value),
        )
    conn.commit()
    conn.close()


init_db()


def get_config() -> dict:
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM config").fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}


def log_activity(action: str, details: str = ""):
    conn = get_db()
    conn.execute(
        "INSERT INTO activity_log (action, details) VALUES (?, ?)",
        (action, details),
    )
    conn.commit()
    conn.close()


# ── Pydantic Models ───────────────────────────────────────────────────
class ConfigUpdate(BaseModel):
    key: str
    value: str


class ProductImport(BaseModel):
    marketplace: str
    limit: int = 20


class VideoJobCreate(BaseModel):
    product_id: str
    job_type: str = "both"  # "short", "long", "both"
    script_model: Optional[str] = None


class CalendarEventCreate(BaseModel):
    title: str
    description: str = ""
    event_type: str = "video_publish"
    scheduled_date: str
    product_id: str = ""
    video_job_id: str = ""
    platform: str = "youtube"


# ── Health & Config Endpoints ─────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "Mission Control", "version": "1.0.0"}


@app.get("/api/config")
async def get_all_config():
    return get_config()


@app.put("/api/config")
async def update_config(update: ConfigUpdate):
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        (update.key, update.value),
    )
    conn.commit()
    conn.close()
    log_activity("config_updated", f"{update.key} = {update.value}")
    return {"status": "updated", "key": update.key}


# ── Service Status Endpoints ──────────────────────────────────────────
@app.get("/api/status/services")
async def check_services():
    config = get_config()
    results = {}

    # Check ShadowCast
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{config['shadowcast_url']}/api/health")
            results["shadowcast"] = {
                "status": "online" if r.status_code == 200 else "error",
                "url": config["shadowcast_url"],
            }
    except Exception:
        results["shadowcast"] = {"status": "offline", "url": config["shadowcast_url"]}

    # Check APF
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{config['apf_url']}/api/health")
            results["apf"] = {
                "status": "online" if r.status_code == 200 else "error",
                "url": config["apf_url"],
            }
    except Exception:
        results["apf"] = {"status": "offline", "url": config["apf_url"]}

    # Check Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{config['ollama_url']}/api/tags")
            results["ollama"] = {
                "status": "online" if r.status_code == 200 else "error",
                "url": config["ollama_url"],
            }
    except Exception:
        results["ollama"] = {"status": "offline", "url": config["ollama_url"]}

    return results


# ── Ollama Model Management ──────────────────────────────────────────
@app.get("/api/ollama/models")
async def list_ollama_models():
    config = get_config()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{config['ollama_url']}/api/tags")
            if r.status_code == 200:
                data = r.json()
                models = data.get("models", [])
                return {
                    "status": "ok",
                    "models": models,
                    "recommended": {
                        "script_generation": config.get("default_script_model", "llama3.1:8b"),
                        "product_analysis": config.get("default_analysis_model", "llama3.1:8b"),
                        "creative_writing": config.get("default_creative_model", "mistral:7b-instruct"),
                        "heavy_reasoning": config.get("heavy_reasoning_model", "mixtral:8x7b-instruct-v0.1-q4_K_M"),
                    },
                }
    except Exception as e:
        return {"status": "offline", "models": [], "error": str(e)}


@app.post("/api/ollama/pull")
async def pull_ollama_model(model_name: str):
    config = get_config()
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            r = await client.post(
                f"{config['ollama_url']}/api/pull",
                json={"name": model_name},
            )
            log_activity("model_pulled", model_name)
            return {"status": "pulling", "model": model_name}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/ollama/running")
async def get_running_models():
    config = get_config()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{config['ollama_url']}/api/ps")
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return {"models": []}


# ── Product Pipeline (APF Integration) ────────────────────────────────
@app.get("/api/products")
async def list_products(
    status: Optional[str] = None,
    marketplace: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    conn = get_db()
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if marketplace:
        query += " AND marketplace = ?"
        params.append(marketplace)
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(query, params).fetchall()
    count = conn.execute(
        "SELECT COUNT(*) as cnt FROM products"
    ).fetchone()["cnt"]
    conn.close()
    return {"products": [dict(r) for r in rows], "total": count}


@app.post("/api/products/import")
async def import_products_from_apf(req: ProductImport):
    """Pull products from APF scraper into Mission Control via tRPC."""
    config = get_config()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # APF uses tRPC — call products.list procedure
            trpc_input = json.dumps({
                "json": {
                    "platform": req.marketplace,
                    "limit": req.limit,
                    "offset": 0,
                }
            })
            r = await client.get(
                f"{config['apf_url']}/api/trpc/products.list",
                params={"input": trpc_input},
            )
            if r.status_code == 200:
                # tRPC wraps response in {"result": {"data": {"json": [...] }}}
                data = r.json()
                products = data.get("result", {}).get("data", {}).get("json", [])
                if not products and isinstance(data.get("result", {}).get("data"), list):
                    products = data["result"]["data"]
                conn = get_db()
                imported = 0
                for p in products:
                    pid = str(uuid.uuid4())
                    # Map APF fields to MC schema
                    conn.execute(
                        """INSERT OR IGNORE INTO products
                        (id, name, marketplace, price, commission, gravity_score,
                         category, url, description, scraped_at, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')""",
                        (
                            pid,
                            p.get("name", "Unknown"),
                            req.marketplace,
                            p.get("aggregateSales", ""),  # APF has no 'price' field
                            p.get("commissionRate", ""),  # APF: commissionRate
                            float(p.get("hiddenGemScore", 0) or 0),  # APF: hiddenGemScore
                            p.get("category", ""),
                            p.get("affiliateLink", ""),  # APF: affiliateLink
                            p.get("description", ""),
                            datetime.now().isoformat(),
                        ),
                    )
                    imported += 1
                conn.commit()
                conn.close()
                log_activity(
                    "products_imported",
                    f"{imported} products from {req.marketplace}",
                )
                return {"status": "ok", "imported": imported}
            else:
                raise HTTPException(
                    status_code=502,
                    detail=f"APF returned {r.status_code}: {r.text[:200]}",
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"APF unreachable: {e}")


@app.post("/api/products/{product_id}/analyze")
async def analyze_product(product_id: str):
    """Use Ollama to analyze a product for video potential."""
    config = get_config()
    conn = get_db()
    product = conn.execute(
        "SELECT * FROM products WHERE id = ?", (product_id,)
    ).fetchone()
    if not product:
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    prompt = f"""Analyze this affiliate product for YouTube video potential.
Product: {product['name']}
Price: {product['price']}
Commission: {product['commission']}
Category: {product['category']}
Description: {product['description']}

Provide a brief analysis covering:
1. Video appeal score (1-10)
2. Best hook angle for a review video
3. Target audience
4. Recommended video style (comparison, review, tutorial, etc.)
5. Potential concerns or red flags"""

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{config['ollama_url']}/api/generate",
                json={
                    "model": config.get("default_analysis_model", "llama3.1:8b"),
                    "prompt": prompt,
                    "stream": False,
                },
            )
            if r.status_code == 200:
                analysis = r.json().get("response", "")
                conn.execute(
                    "UPDATE products SET ai_analysis = ?, status = 'analyzed' WHERE id = ?",
                    (analysis, product_id),
                )
                conn.commit()
                conn.close()
                log_activity("product_analyzed", product["name"])
                return {"status": "ok", "analysis": analysis}
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=502, detail=f"Ollama error: {e}")


@app.put("/api/products/{product_id}/status")
async def update_product_status(product_id: str, status: str):
    conn = get_db()
    conn.execute(
        "UPDATE products SET status = ? WHERE id = ?", (status, product_id)
    )
    conn.commit()
    conn.close()
    return {"status": "updated"}


# ── Video Production Queue ────────────────────────────────────────────
@app.get("/api/jobs")
async def list_jobs(status: Optional[str] = None, limit: int = 50):
    conn = get_db()
    query = "SELECT * FROM video_jobs"
    params = []
    if status:
        query += " WHERE status = ?"
        params.append(status)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return {"jobs": [dict(r) for r in rows]}


@app.post("/api/jobs")
async def create_video_job(req: VideoJobCreate, background_tasks: BackgroundTasks):
    """Queue a video production job — sends to ShadowCast."""
    conn = get_db()
    product = conn.execute(
        "SELECT * FROM products WHERE id = ?", (req.product_id,)
    ).fetchone()
    if not product:
        conn.close()
        raise HTTPException(status_code=404, detail="Product not found")

    config = get_config()
    job_id = str(uuid.uuid4())
    model = req.script_model or config.get("default_script_model", "llama3.1:8b")

    conn.execute(
        """INSERT INTO video_jobs
        (id, product_id, product_name, status, job_type, script_model)
        VALUES (?, ?, ?, 'queued', ?, ?)""",
        (job_id, req.product_id, product["name"], req.job_type, model),
    )
    conn.commit()
    conn.close()

    log_activity("job_created", f"Job {job_id} for {product['name']}")

    # Run the job in background
    background_tasks.add_task(run_video_job, job_id)

    return {"status": "queued", "job_id": job_id}


async def run_video_job(job_id: str):
    """Background task: submit to ShadowCast /api/generate and poll until complete.
    ShadowCast handles both script generation AND video rendering in one async job.
    """
    conn = get_db()
    job = conn.execute("SELECT * FROM video_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return

    config = get_config()
    product = conn.execute(
        "SELECT * FROM products WHERE id = ?", (job["product_id"],)
    ).fetchone()

    # Update status to running
    conn.execute(
        "UPDATE video_jobs SET status = 'generating_script', started_at = datetime('now') WHERE id = ?",
        (job_id,),
    )
    conn.commit()

    # Determine formats based on job_type
    formats = []
    if job["job_type"] in ("short", "both"):
        formats.append("short_form")
    if job["job_type"] in ("long", "both"):
        formats.append("long_form")
    if not formats:
        formats = ["short_form", "long_form"]

    try:
        # Step 1: Submit job to ShadowCast /api/generate
        # ShadowCast expects GenerateRequest with nested product_info
        generate_payload = {
            "product_info": {
                "product_name": product["name"],
                "niche": product["category"] or "General",
                "price": product["price"] or "$49.99",
                "affiliate_link": product["url"] or "[YOUR_AFFILIATE_LINK]",
                "key_features": [],
                "keywords": [],
                "target_audience": "General consumers",
                "product_category": product["category"] or "General",
            },
            "hook_types": ["curiosity"],
            "formats": formats,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{config['shadowcast_url']}/api/generate",
                json=generate_payload,
            )
            if r.status_code != 200:
                raise Exception(f"ShadowCast generation failed: {r.status_code} - {r.text[:200]}")

            sc_job = r.json()
            sc_job_id = sc_job.get("job_id")
            if not sc_job_id:
                raise Exception("ShadowCast did not return a job_id")

        conn.execute(
            "UPDATE video_jobs SET status = 'rendering', script_json = ? WHERE id = ?",
            (json.dumps({"shadowcast_job_id": sc_job_id}), job_id),
        )
        conn.commit()

        # Step 2: Poll ShadowCast /api/status/{job_id} until complete
        max_polls = 360  # 30 min max (5s intervals)
        for _ in range(max_polls):
            await asyncio.sleep(5)
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(f"{config['shadowcast_url']}/api/status/{sc_job_id}")
                if r.status_code != 200:
                    continue
                status_data = r.json()

            sc_status = status_data.get("status", "")
            if sc_status == "complete":
                # Fetch results
                async with httpx.AsyncClient(timeout=10.0) as client:
                    r = await client.get(f"{config['shadowcast_url']}/api/results/{sc_job_id}")
                    result = r.json() if r.status_code == 200 else {}

                # Extract video paths from results
                short_path = ""
                long_path = ""
                hooks = result.get("results", {})
                for hook_data in hooks.values():
                    videos = hook_data.get("videos", {}) if isinstance(hook_data, dict) else {}
                    if "short_form" in videos:
                        short_path = f"{config['shadowcast_url']}/api/download/{sc_job_id}/{videos['short_form']}"
                    if "long_form" in videos:
                        long_path = f"{config['shadowcast_url']}/api/download/{sc_job_id}/{videos['long_form']}"

                conn.execute(
                    """UPDATE video_jobs SET
                    status = 'completed',
                    short_form_path = ?,
                    long_form_path = ?,
                    completed_at = datetime('now')
                    WHERE id = ?""",
                    (short_path, long_path, job_id),
                )
                conn.commit()
                log_activity("job_completed", f"Job {job_id} for {product['name']}")
                return

            elif sc_status == "error":
                errors = status_data.get("errors", ["Unknown error"])
                raise Exception(f"ShadowCast error: {'; '.join(errors)}")

        # If we get here, polling timed out
        raise Exception("ShadowCast job timed out after 30 minutes")

    except Exception as e:
        conn.execute(
            "UPDATE video_jobs SET status = 'failed', error_message = ? WHERE id = ?",
            (str(e), job_id),
        )
        conn.commit()
        log_activity("job_failed", f"Job {job_id}: {str(e)}")
    finally:
        conn.close()


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    conn = get_db()
    job = conn.execute("SELECT * FROM video_jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return dict(job)


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    conn = get_db()
    conn.execute("DELETE FROM video_jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ── Content Calendar ──────────────────────────────────────────────────
@app.get("/api/calendar")
async def list_calendar_events(
    month: Optional[int] = None,
    year: Optional[int] = None,
):
    conn = get_db()
    query = "SELECT * FROM calendar_events"
    params = []
    if month and year:
        query += " WHERE scheduled_date LIKE ?"
        params.append(f"{year}-{month:02d}%")
    query += " ORDER BY scheduled_date ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return {"events": [dict(r) for r in rows]}


@app.post("/api/calendar")
async def create_calendar_event(event: CalendarEventCreate):
    conn = get_db()
    event_id = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO calendar_events
        (id, title, description, event_type, scheduled_date, product_id, video_job_id, platform)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            event_id,
            event.title,
            event.description,
            event.event_type,
            event.scheduled_date,
            event.product_id,
            event.video_job_id,
            event.platform,
        ),
    )
    conn.commit()
    conn.close()
    log_activity("calendar_event_created", event.title)
    return {"status": "created", "id": event_id}


@app.put("/api/calendar/{event_id}/status")
async def update_calendar_status(event_id: str, status: str):
    conn = get_db()
    conn.execute(
        "UPDATE calendar_events SET status = ? WHERE id = ?", (status, event_id)
    )
    conn.commit()
    conn.close()
    return {"status": "updated"}


@app.delete("/api/calendar/{event_id}")
async def delete_calendar_event(event_id: str):
    conn = get_db()
    conn.execute("DELETE FROM calendar_events WHERE id = ?", (event_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


# ── Analytics / Dashboard Stats ───────────────────────────────────────
@app.get("/api/analytics/overview")
async def analytics_overview():
    conn = get_db()
    stats = {
        "total_products": conn.execute("SELECT COUNT(*) as c FROM products").fetchone()["c"],
        "analyzed_products": conn.execute(
            "SELECT COUNT(*) as c FROM products WHERE status = 'analyzed'"
        ).fetchone()["c"],
        "total_jobs": conn.execute("SELECT COUNT(*) as c FROM video_jobs").fetchone()["c"],
        "completed_jobs": conn.execute(
            "SELECT COUNT(*) as c FROM video_jobs WHERE status = 'completed'"
        ).fetchone()["c"],
        "queued_jobs": conn.execute(
            "SELECT COUNT(*) as c FROM video_jobs WHERE status = 'queued'"
        ).fetchone()["c"],
        "failed_jobs": conn.execute(
            "SELECT COUNT(*) as c FROM video_jobs WHERE status = 'failed'"
        ).fetchone()["c"],
        "scheduled_events": conn.execute(
            "SELECT COUNT(*) as c FROM calendar_events WHERE status = 'scheduled'"
        ).fetchone()["c"],
        "products_by_marketplace": {},
        "jobs_by_status": {},
    }

    # Products by marketplace
    rows = conn.execute(
        "SELECT marketplace, COUNT(*) as c FROM products GROUP BY marketplace"
    ).fetchall()
    stats["products_by_marketplace"] = {r["marketplace"]: r["c"] for r in rows}

    # Jobs by status
    rows = conn.execute(
        "SELECT status, COUNT(*) as c FROM video_jobs GROUP BY status"
    ).fetchall()
    stats["jobs_by_status"] = {r["status"]: r["c"] for r in rows}

    # Recent activity
    rows = conn.execute(
        "SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 20"
    ).fetchall()
    stats["recent_activity"] = [dict(r) for r in rows]

    conn.close()
    return stats


# ── Activity Log ──────────────────────────────────────────────────────
@app.get("/api/activity")
async def get_activity(limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return {"activity": [dict(r) for r in rows]}
