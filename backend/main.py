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
    "apf_url": "http://localhost:3001",
    # Read internal service secret from environment to avoid hardcoding secrets
    "internal_service_secret": os.environ.get("INTERNAL_SERVICE_SECRET", ""),
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
            created_at TEXT DEFAULT (datetime('now')),
            apf_product_id TEXT DEFAULT '',
            recommended_content_style TEXT DEFAULT '',
            competitors TEXT DEFAULT '[]',
            review_brief TEXT DEFAULT '{}',
            enriched_payload TEXT DEFAULT '',
            product_info_json TEXT DEFAULT '',
            apf_import_token TEXT DEFAULT ''
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

    _migrate_products_columns(conn)
    _migrate_video_jobs_columns(conn)

    # Seed default config
    for key, value in DEFAULT_CONFIG.items():
        conn.execute(
            "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
            (key, value),
        )
    conn.commit()
    conn.close()


PRODUCT_ENRICHMENT_COLUMNS = [
    ("apf_product_id", "TEXT DEFAULT ''"),
    ("recommended_content_style", "TEXT DEFAULT ''"),
    ("competitors", "TEXT DEFAULT '[]'"),
    ("review_brief", "TEXT DEFAULT '{}'"),
    ("enriched_payload", "TEXT DEFAULT '{}'"),
    ("product_info_json", "TEXT DEFAULT ''"),
    ("apf_import_token", "TEXT DEFAULT ''"),
]

VIDEO_JOB_OPTION_COLUMNS = [
    ("job_options", "TEXT DEFAULT '{}'"),
]

STYLE_FROM_ANGLE = [
    (("worth it", "hype", "waste"), "worth_it_or_waste"),
    (("vs", "compare", "better than"), "vs_battle"),
    (("budget", "under $", "cheapest"), "budget_challenge"),
    (("eliminate", "rejected", "skip these"), "elimination"),
    (("honest", "pros and cons", "red flags"), "honest_review"),
]

STYLE_ALIASES = {
    "elimination_round": "elimination",
    "trust_first_review": "honest_review",
    "standard_promo": "standard",
}


def _migrate_products_columns(conn):
    existing = {row[1] for row in conn.execute("PRAGMA table_info(products)").fetchall()}
    for name, col_def in PRODUCT_ENRICHMENT_COLUMNS:
        if name not in existing:
            conn.execute(f"ALTER TABLE products ADD COLUMN {name} {col_def}")


def _migrate_video_jobs_columns(conn):
    existing = {row[1] for row in conn.execute("PRAGMA table_info(video_jobs)").fetchall()}
    for name, col_def in VIDEO_JOB_OPTION_COLUMNS:
        if name not in existing:
            conn.execute(f"ALTER TABLE video_jobs ADD COLUMN {name} {col_def}")


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


def _json_loads(value, default=None):
    if default is None:
        default = {}
    if not value:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def _json_dumps(value):
    return json.dumps(value, ensure_ascii=False)


def _normalize_content_style(value: str) -> str:
    raw = (value or "honest_review").strip().lower().replace(" ", "_").replace("-", "_")
    if not raw:
        return "honest_review"
    return STYLE_ALIASES.get(raw, raw)


def _infer_style_from_angles(angles):
    text = " ".join(str(a).strip().lower() for a in (angles or []) if str(a).strip())
    for patterns, style in STYLE_FROM_ANGLE:
        if any(pattern in text for pattern in patterns):
            return style
    return "honest_review"


def _apf_price_from_product(p: dict) -> str:
    cart = p.get("cartValue")
    if cart not in (None, "", 0, "0"):
        try:
            return f"${float(cart):.2f}"
        except (TypeError, ValueError):
            pass
    return "Varies"


def _commission_label(rate) -> str:
    rate_text = str(rate or "").strip()
    if not rate_text:
        return ""
    if "%" in rate_text:
        return f"Affiliate commission: {rate_text}"
    try:
        return f"Affiliate commission: {float(rate_text):g}%"
    except ValueError:
        return f"Affiliate commission: {rate_text}"


def _extract_enrichment_fields(enriched_payload: dict):
    if not enriched_payload:
        return "", [], {}
    brief = enriched_payload.get("review_brief") or {}
    if not isinstance(brief, dict):
        brief = {}
    angles = brief.get("best_video_angles") or []
    style = (
        brief.get("recommended_content_style")
        or brief.get("recommendedContentStyle")
        or _infer_style_from_angles(angles)
    )
    competitors = brief.get("suggested_competitors") or brief.get("suggestedCompetitors") or []
    if isinstance(competitors, str):
        competitors = [c.strip() for c in competitors.replace(";", ",").split(",") if c.strip()]
    return _normalize_content_style(style), competitors, brief


def _normalized_to_generate_product_info(normalized: dict) -> dict:
    keywords = normalized.get("keywords", [])
    if isinstance(keywords, str):
        keywords = [k.strip() for k in keywords.split(",") if k.strip()]

    key_features = normalized.get("key_features") or normalized.get("keyFeatures") or []
    if isinstance(key_features, str):
        key_features = [k.strip() for k in key_features.split("\n") if k.strip()]

    content_style = _normalize_content_style(
        normalized.get("content_style") or normalized.get("contentStyle") or "honest_review"
    )

    return {
        "product_name": normalized.get("product_name") or normalized.get("productName") or "",
        "niche": normalized.get("niche") or "General",
        "key_features": key_features,
        "price": normalized.get("price") or "Varies",
        "affiliate_link": normalized.get("affiliate_link") or normalized.get("affiliateLink") or "[YOUR_AFFILIATE_LINK]",
        "keywords": keywords if isinstance(keywords, list) else [],
        "target_audience": normalized.get("target_audience") or normalized.get("targetAudience") or "General consumers",
        "product_category": normalized.get("product_category") or normalized.get("niche") or "General",
        "competitors": normalized.get("competitors") or [],
        "unique_selling_point": normalized.get("unique_selling_point") or normalized.get("uniqueSellingPoint") or "",
        "discount_info": normalized.get("discount_info") or normalized.get("discountInfo") or "",
        "common_complaints": normalized.get("common_complaints") or normalized.get("commonComplaints") or "",
        "common_praises": normalized.get("common_praises") or normalized.get("commonPraises") or "",
        "who_not_for": normalized.get("who_not_for") or normalized.get("whoNotFor") or "",
        "series_name": normalized.get("series_name") or normalized.get("seriesName") or "",
        "price_comparison": normalized.get("price_comparison") or normalized.get("priceComparison") or "",
        "content_style": content_style,
    }


def _local_product_info(product) -> dict:
    brief = _json_loads(product["review_brief"], {})
    competitors = _json_loads(product["competitors"], [])
    positives = brief.get("positive_signals") or []
    complaints = brief.get("common_complaints") or []
    claims = brief.get("common_claims") or []
    angles = brief.get("best_video_angles") or []

    key_features = []
    if claims:
        key_features.extend(str(c).strip() for c in claims if str(c).strip())
    description = product["description"] or ""
    if description and not key_features:
        key_features = [part.strip() for part in description.split(".") if part.strip()][:5]

    common_complaints = ""
    if brief.get("negative_signals") or complaints:
        parts = []
        if brief.get("negative_signals"):
            parts.append("Negative signals: " + "; ".join(str(x) for x in brief["negative_signals"]))
        if complaints:
            parts.append("Common complaints: " + "; ".join(str(x) for x in complaints))
        common_complaints = "\n".join(parts)

    content_style = _normalize_content_style(
        product["recommended_content_style"]
        or brief.get("recommended_content_style")
        or _infer_style_from_angles(angles)
    )

    return {
        "product_name": product["name"],
        "niche": product["category"] or "General",
        "key_features": key_features,
        "price": product["price"] or "Varies",
        "affiliate_link": product["url"] or "[YOUR_AFFILIATE_LINK]",
        "keywords": [],
        "target_audience": brief.get("target_audience") or brief.get("who_it_may_help") or "General consumers",
        "product_category": product["category"] or "General",
        "competitors": competitors,
        "unique_selling_point": (angles[0] if angles else "") or brief.get("review_summary", ""),
        "discount_info": _commission_label(product["commission"]),
        "common_complaints": common_complaints,
        "common_praises": "; ".join(str(x) for x in positives) if positives else "",
        "who_not_for": brief.get("who_should_skip_it", ""),
        "series_name": "",
        "price_comparison": brief.get("price_comparison") or brief.get("priceComparison") or "",
        "content_style": content_style,
    }


def _service_headers(config: dict) -> dict:
    secret = config.get("internal_service_secret", "")
    if not secret:
        return {}
    return {"X-Service-Key": secret}


def _parse_trpc_response(data: dict):
    result = data.get("result", {}).get("data", {})
    if isinstance(result, dict) and "json" in result:
        return result["json"]
    return result


async def _apf_trpc_get(client: httpx.AsyncClient, config: dict, procedure: str, input_data: dict):
    trpc_input = json.dumps({"json": input_data})
    r = await client.get(
        f"{config['apf_url']}/api/trpc/{procedure}",
        params={"input": trpc_input},
        headers=_service_headers(config),
    )
    if r.status_code != 200:
        return None
    return _parse_trpc_response(r.json())


async def _fetch_apf_enriched_payload(client: httpx.AsyncClient, config: dict, apf_product_id: int) -> dict:
    payload = await _apf_trpc_get(
        client, config, "products.shadowCastPayload", {"productId": apf_product_id}
    )
    return payload if isinstance(payload, dict) else {}


def _is_thin_product_info(info: dict) -> bool:
    """True when product_info lacks enrichment needed for quality videos."""
    if not isinstance(info, dict) or not info.get("product_name"):
        return True
    features = info.get("key_features") or []
    if isinstance(features, str):
        features = [f for f in features.split(",") if f.strip()]
    has_features = len(features) > 0
    has_competitors = bool(info.get("competitors"))
    has_depth = bool(
        info.get("common_complaints")
        or info.get("common_praises")
        or info.get("unique_selling_point")
        or info.get("price_comparison")
        or info.get("who_not_for")
    )
    # Thin if no features and no enrichment depth (local stub / failed normalize)
    return not has_features and not has_depth and not has_competitors


async def _resolve_shadowcast_product_info(
    client: httpx.AsyncClient, config: dict, product, *, allow_thin: bool = False
) -> tuple[dict, str]:
    stored_info = _json_loads(product["product_info_json"], {})
    if isinstance(stored_info, dict) and stored_info.get("product_name"):
        info = _normalized_to_generate_product_info(stored_info)
        style = _normalize_content_style(info.get("content_style") or "honest_review")
        info["content_style"] = style
        if not allow_thin and _is_thin_product_info(info):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Product '{product['name']}' has thin product_info. "
                    "Re-import from APF after enrichment completes."
                ),
            )
        return info, style

    enriched_payload = _json_loads(product["enriched_payload"], {})
    if enriched_payload:
        try:
            r = await client.post(
                f"{config['shadowcast_url']}/api/import-apf/direct",
                json=enriched_payload,
                headers=_service_headers(config),
            )
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"ShadowCast normalize unreachable: {e}",
            )
        if r.status_code == 200:
            body = r.json()
            normalized = body.get("normalized") or {}
            if normalized:
                info = _normalized_to_generate_product_info(normalized)
                style = _normalize_content_style(
                    body.get("recommended_content_style") or info.get("content_style")
                )
                info["content_style"] = style
                return info, style
            raise HTTPException(
                status_code=422,
                detail=(
                    f"ShadowCast returned empty normalized payload for '{product['name']}'. "
                    "Check APF enrichment."
                ),
            )
        raise HTTPException(
            status_code=502,
            detail=f"ShadowCast normalize failed ({r.status_code}): {r.text[:200]}",
        )

    if not allow_thin:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Product '{product['name']}' has no enriched APF payload. "
                "Import from APF after review enrichment completes; refusing thin stub."
            ),
        )

    info = _local_product_info(product)
    style = _normalize_content_style(info.get("content_style") or "honest_review")
    info["content_style"] = style
    return info, style


def _upsert_product_from_apf(
    conn,
    marketplace: str,
    p: dict,
    enriched_payload: dict,
    recommended_style: str,
    competitors: list,
    review_brief: dict,
    product_info_json: str = "",
    apf_import_token: str = "",
):
    apf_id = str(p.get("id", ""))
    existing = None
    if apf_id:
        existing = conn.execute(
            "SELECT id FROM products WHERE apf_product_id = ? AND marketplace = ?",
            (apf_id, marketplace),
        ).fetchone()

    pid = existing["id"] if existing else str(uuid.uuid4())
    price = _apf_price_from_product(p)
    commission = p.get("commissionRate", "")

    if enriched_payload:
        brief = enriched_payload.get("review_brief") or {}
        if isinstance(brief, dict):
            if brief.get("price_display"):
                price = brief["price_display"]
            elif brief.get("recommended_content_style"):
                recommended_style = _normalize_content_style(brief["recommended_content_style"])

    conn.execute(
        """INSERT INTO products
        (id, apf_product_id, name, marketplace, price, commission, gravity_score,
         category, url, description, scraped_at, status,
         recommended_content_style, competitors, review_brief, enriched_payload,
         product_info_json, apf_import_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            apf_product_id = excluded.apf_product_id,
            name = excluded.name,
            price = excluded.price,
            commission = excluded.commission,
            gravity_score = excluded.gravity_score,
            category = excluded.category,
            url = excluded.url,
            description = excluded.description,
            scraped_at = excluded.scraped_at,
            recommended_content_style = excluded.recommended_content_style,
            competitors = excluded.competitors,
            review_brief = excluded.review_brief,
            enriched_payload = excluded.enriched_payload,
            product_info_json = excluded.product_info_json,
            apf_import_token = excluded.apf_import_token""",
        (
            pid,
            apf_id,
            p.get("name", "Unknown"),
            marketplace,
            price,
            commission,
            float(p.get("hiddenGemScore", 0) or 0),
            p.get("category", ""),
            p.get("affiliateLink", ""),
            p.get("description", ""),
            datetime.now().isoformat(),
            recommended_style,
            _json_dumps(competitors),
            _json_dumps(review_brief),
            _json_dumps(enriched_payload),
            product_info_json,
            apf_import_token,
        ),
    )
    return pid


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
    hook_types: Optional[List[str]] = None
    content_style: Optional[str] = None
    audio_enabled: bool = True
    audio_mood: str = "auto"
    use_tts: bool = False
    tts_provider: str = "auto"
    tts_voice: Optional[str] = None


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
        async with httpx.AsyncClient(timeout=60.0) as client:
            products = await _apf_trpc_get(
                client,
                config,
                "products.list",
                {"platform": req.marketplace, "limit": req.limit, "offset": 0},
            )
            if products is None:
                raise HTTPException(status_code=502, detail="APF products.list request failed")

            if not isinstance(products, list):
                products = []

            conn = get_db()
            imported = 0
            for p in products:
                apf_id = p.get("id")
                enriched_payload = {}
                if apf_id is not None:
                    try:
                        enriched_payload = await _fetch_apf_enriched_payload(
                            client, config, int(apf_id)
                        )
                    except (TypeError, ValueError):
                        enriched_payload = {}

                recommended_style, competitors, review_brief = _extract_enrichment_fields(
                    enriched_payload
                )

                product_info_json = ""
                apf_import_token = ""
                normalize_warning = None
                if enriched_payload:
                    try:
                        r = await client.post(
                            f"{config['shadowcast_url']}/api/import-apf/direct",
                            json=enriched_payload,
                            headers=_service_headers(config),
                        )
                        if r.status_code == 200:
                            body = r.json()
                            normalized = body.get("normalized") or {}
                            if normalized:
                                product_info_json = _json_dumps(
                                    _normalized_to_generate_product_info(normalized)
                                )
                            else:
                                normalize_warning = "empty normalized payload"
                            apf_import_token = body.get("token") or ""
                            if body.get("recommended_content_style"):
                                recommended_style = _normalize_content_style(
                                    body["recommended_content_style"]
                                )
                        else:
                            normalize_warning = f"HTTP {r.status_code}: {r.text[:120]}"
                    except Exception as e:
                        normalize_warning = str(e)

                if normalize_warning:
                    log_activity(
                        "apf_normalize_failed",
                        f"{p.get('name', apf_id)}: {normalize_warning}",
                    )

                _upsert_product_from_apf(
                    conn,
                    req.marketplace,
                    p,
                    enriched_payload,
                    recommended_style,
                    competitors,
                    review_brief,
                    product_info_json,
                    apf_import_token,
                )
                imported += 1

            conn.commit()
            conn.close()
            log_activity(
                "products_imported",
                f"{imported} products from {req.marketplace}",
            )
            return {"status": "ok", "imported": imported}
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

    # Refuse jobs when enrichment is missing (no product_info and no enriched payload)
    stored_info = _json_loads(product["product_info_json"], {})
    enriched_payload = _json_loads(product["enriched_payload"], {})
    if not (isinstance(stored_info, dict) and stored_info.get("product_name")) and not enriched_payload:
        conn.close()
        raise HTTPException(
            status_code=422,
            detail=(
                f"Product '{product['name']}' has no enriched APF payload. "
                "Re-import from APF after enrichment; refusing thin stub job."
            ),
        )
    if isinstance(stored_info, dict) and stored_info.get("product_name"):
        preview = _normalized_to_generate_product_info(stored_info)
        if _is_thin_product_info(preview) and not enriched_payload:
            conn.close()
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Product '{product['name']}' product_info is too thin for video generation. "
                    "Re-import from APF after enrichment."
                ),
            )

    config = get_config()
    job_id = str(uuid.uuid4())
    model = req.script_model or config.get("default_script_model", "llama3.1:8b")

    job_options = {
        "hook_types": req.hook_types or ["curiosity"],
        "content_style": req.content_style,
        "audio_enabled": req.audio_enabled,
        "audio_mood": req.audio_mood or "auto",
        "use_tts": req.use_tts,
        "tts_provider": req.tts_provider or "auto",
        "tts_voice": req.tts_voice,
        "script_model": model,
    }

    conn.execute(
        """INSERT INTO video_jobs
        (id, product_id, product_name, status, job_type, script_model, job_options)
        VALUES (?, ?, ?, 'queued', ?, ?, ?)""",
        (job_id, req.product_id, product["name"], req.job_type, model, _json_dumps(job_options)),
    )
    conn.commit()
    conn.close()

    log_activity("job_created", f"Job {job_id} for {product['name']}")

    # Run the job in background
    background_tasks.add_task(run_video_job, job_id)

    return {"status": "queued", "job_id": job_id, "options": job_options}


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
        async with httpx.AsyncClient(timeout=30.0) as client:
            product_info, content_style = await _resolve_shadowcast_product_info(
                client, config, product, allow_thin=False
            )

            job_options = _json_loads(job["job_options"] if "job_options" in job.keys() else "{}", {})
            if not isinstance(job_options, dict):
                job_options = {}

            hook_types = job_options.get("hook_types") or ["curiosity"]
            if isinstance(hook_types, str):
                hook_types = [h.strip() for h in hook_types.split(",") if h.strip()]
            override_style = job_options.get("content_style")
            if override_style:
                content_style = _normalize_content_style(override_style)
                product_info["content_style"] = content_style

            generate_payload = {
                "product_info": product_info,
                "hook_types": hook_types,
                "formats": formats,
                "content_style": content_style,
                "audio_enabled": bool(job_options.get("audio_enabled", True)),
                "audio_mood": job_options.get("audio_mood") or "auto",
                "use_tts": bool(job_options.get("use_tts", False)),
                "tts_provider": job_options.get("tts_provider") or "auto",
                "tts_voice": job_options.get("tts_voice"),
            }

            r = await client.post(
                f"{config['shadowcast_url']}/api/generate",
                json=generate_payload,
                headers=_service_headers(config),
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

    except HTTPException as e:
        detail = e.detail if isinstance(e.detail, str) else str(e.detail)
        conn.execute(
            "UPDATE video_jobs SET status = 'failed', error_message = ? WHERE id = ?",
            (detail, job_id),
        )
        conn.commit()
        log_activity("job_failed", f"Job {job_id}: {detail}")
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
