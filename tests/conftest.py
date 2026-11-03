import os
import sys
import tempfile

import pytest

# Isolated SQLite for tests — must be set before importing main
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_test_db.close()
os.environ["MC_DB_PATH"] = _test_db.name
os.environ.setdefault("INTERNAL_SERVICE_SECRET", "test-secret")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
