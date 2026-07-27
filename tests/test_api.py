"""Narrow API tests for Mission Control orchestration layer."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_config_redacts_secret(client):
    client.put("/api/config", json={"key": "internal_service_secret", "value": "super-secret-key"})
    cfg = client.get("/api/config").json()
    assert "super-secret-key" not in cfg.get("internal_service_secret", "")
    assert cfg["internal_service_secret"].endswith("-key")


def test_config_rejects_unknown_key(client):
    r = client.put("/api/config", json={"key": "evil_key", "value": "x"})
    assert r.status_code == 400


def test_products_filtered_total(client):
    client.post(
        "/api/products/import",
        json={"marketplace": "clickbank", "limit": 1},
    )
    # Import may fail without APF; test list endpoint shape with empty DB
    r = client.get("/api/products?status=new&marketplace=clickbank")
    assert r.status_code == 200
    data = r.json()
    assert "products" in data
    assert "total" in data
    assert data["total"] >= len(data["products"])


def test_products_search_query_param(client):
    r = client.get("/api/products?q=test")
    assert r.status_code == 200
    assert "total" in r.json()


def test_apply_ai_analysis_helper():
    from main import _apply_ai_analysis

    product = {"ai_analysis": "Strong hook: budget angle"}
    info = {"product_name": "Widget", "unique_selling_point": "Fast"}
    out = _apply_ai_analysis(product, info)
    assert out["ai_analysis"] == "Strong hook: budget angle"
    assert "Mission Control analysis" in out["unique_selling_point"]


def test_concurrent_job_limit(client):
    from main import MAX_CONCURRENT_JOBS, get_db

    conn = get_db()
    conn.execute(
        """INSERT INTO products (id, name, marketplace, status, product_info_json)
           VALUES ('prod-x', 'Test Product', 'clickbank', 'approved', '{"product_name":"Test Product","key_features":["a"]}')"""
    )
    for i in range(MAX_CONCURRENT_JOBS):
        conn.execute(
            """INSERT INTO video_jobs (id, product_id, product_name, status)
               VALUES (?, ?, ?, 'queued')""",
            (f"job-{i}", "prod-x", "Test Product"),
        )
    conn.commit()
    conn.close()

    r = client.post(
        "/api/jobs",
        json={"product_id": "prod-x", "job_type": "short"},
    )
    assert r.status_code == 429


def test_marketplaces_and_auth_status(client):
    r = client.get("/api/apf/marketplaces")
    assert r.status_code == 200
    markets = r.json()["marketplaces"]
    assert "clickbank" in markets
    assert "amazon" in markets
    assert len(markets) == 8

    auth = client.get("/api/auth/status")
    assert auth.status_code == 200
    assert "required" in auth.json()


def test_ops_overview_shape(client):
    r = client.get("/api/ops/overview")
    assert r.status_code == 200
    data = r.json()
    assert "services" in data
    assert "schedules" in data
    assert "refresh_runs" in data
    assert "problem_jobs" in data
    names = {s["name"] for s in data["services"]}
    assert "shadowcast" in names
    assert "apf" in names


def test_services_registry_health(client):
    r = client.get("/api/status/services")
    assert r.status_code == 200
    data = r.json()
    assert "shadowcast" in data
    assert "apf" in data
    assert "status" in data["shadowcast"]
    assert "ui_url" in data["shadowcast"]


def test_refresh_runs_endpoint(client):
    r = client.get("/api/apf/refresh-runs/latest")
    assert r.status_code == 200
    assert "runs" in r.json()


def test_dashboard_token_gate(monkeypatch, tmp_path):
    """When MC_DASHBOARD_TOKEN is set, protected routes require the header."""
    import main as main_mod
    from fastapi.testclient import TestClient

    main_mod.MC_DASHBOARD_TOKEN = "test-dash-token"
    try:
        with TestClient(main_mod.app) as c:
            denied = c.get("/api/config")
            assert denied.status_code == 401
            ok = c.get("/api/config", headers={"X-Dashboard-Token": "test-dash-token"})
            assert ok.status_code == 200
            health = c.get("/api/health")
            assert health.status_code == 200
    finally:
        main_mod.MC_DASHBOARD_TOKEN = ""
