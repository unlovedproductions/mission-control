"""Regression: ShadowCast partial/cancelled terminals + startup job recovery."""

import os
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, patch


class RecoverStuckJobsTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        db_path = os.path.join(self._tmpdir.name, "test.db")

        import main as mc

        self.mc = mc
        mc.DB_PATH = db_path
        mc.init_db()
        self.conn = mc.get_db()
        self.conn.execute(
            """INSERT INTO products (id, name, marketplace)
            VALUES ('prod-1', 'CircO2', 'digistore')"""
        )
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def _insert_job(self, job_id: str, status: str, started_at: str = ""):
        self.conn.execute(
            """INSERT INTO video_jobs
            (id, product_id, product_name, job_type, status, script_model, started_at, job_options)
            VALUES (?, 'prod-1', 'CircO2', 'both', ?, 'llama3.1:8b', ?, '{}')""",
            (job_id, status, started_at),
        )
        self.conn.commit()

    def test_recover_fails_recent_rendering_and_queued(self):
        self._insert_job("j-render", "rendering")
        self.conn.execute(
            "UPDATE video_jobs SET started_at = datetime('now', '-5 minutes') WHERE id = 'j-render'"
        )
        self._insert_job("j-queued", "queued")
        self.conn.commit()

        self.mc._recover_stuck_jobs(self.conn)
        self.conn.commit()

        rows = {
            r["id"]: r["status"]
            for r in self.conn.execute(
                "SELECT id, status FROM video_jobs WHERE id IN ('j-render', 'j-queued')"
            ).fetchall()
        }
        self.assertEqual(rows["j-render"], "failed")
        self.assertEqual(rows["j-queued"], "failed")


class PartialStatusPollTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = os.path.join(self._tmpdir.name, "test.db")

        import main as mc

        self.mc = mc
        mc.DB_PATH = db_path
        mc.init_db()
        self.conn = mc.get_db()
        self.conn.execute(
            """INSERT INTO products (id, name, marketplace)
            VALUES ('prod-1', 'CircO2', 'digistore')"""
        )
        self.conn.execute(
            """INSERT INTO video_jobs
            (id, product_id, product_name, job_type, status, script_model, job_options)
            VALUES ('job-1', 'prod-1', 'CircO2', 'both', 'queued', 'llama3.1:8b', '{}')"""
        )
        self.conn.commit()

    async def asyncTearDown(self):
        self.conn.close()
        self._tmpdir.cleanup()

    async def test_partial_status_completes_job_with_paths(self):
        status_payload = {
            "status": "partial",
            "progress": 100,
            "current_step": "Done! (review warnings)",
            "warnings": ["CircO2: No product image — thumbs will be text-only"],
            "errors": [],
        }
        results_payload = {
            "results": {
                "curiosity": {
                    "videos": {
                        "short_form": "curiosity_short_form.mp4",
                        "long_form": "curiosity_long_form.mp4",
                    }
                }
            }
        }

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        generate_resp = MagicMock(status_code=200)
        generate_resp.json.return_value = {"job_id": "sc-1"}
        generate_resp.text = ""

        status_resp = MagicMock(status_code=200)
        status_resp.json.return_value = status_payload

        results_resp = MagicMock(status_code=200)
        results_resp.json.return_value = results_payload

        async def fake_post(url, **kwargs):
            return generate_resp

        async def fake_get(url, **kwargs):
            if "/api/status/" in url:
                return status_resp
            if "/api/results/" in url:
                return results_resp
            return MagicMock(status_code=404)

        mock_client.post = AsyncMock(side_effect=fake_post)
        mock_client.get = AsyncMock(side_effect=fake_get)

        with patch.object(self.mc.httpx, "AsyncClient", return_value=mock_client), patch.object(
            self.mc, "_configure_shadowcast_llm", new=AsyncMock()
        ), patch.object(
            self.mc,
            "_resolve_shadowcast_product_info",
            new=AsyncMock(
                return_value=(
                    {
                        "product_name": "CircO2",
                        "niche": "Health",
                        "key_features": ["oxygen"],
                        "price": "$49",
                        "affiliate_link": "https://example.com",
                        "keywords": ["oxygen"],
                        "target_audience": "Adults",
                        "product_category": "Health",
                    },
                    "honest_review",
                )
            ),
        ), patch.object(self.mc.asyncio, "sleep", new=AsyncMock()):
            await self.mc.run_video_job("job-1")

        # Re-open: run_video_job closes its own connection
        conn = self.mc.get_db()
        try:
            row = conn.execute(
                "SELECT status, short_form_path, long_form_path, error_message, script_json "
                "FROM video_jobs WHERE id = 'job-1'"
            ).fetchone()
            self.assertEqual(row["status"], "completed")
            self.assertIn("curiosity_short_form.mp4", row["short_form_path"] or "")
            self.assertIn("curiosity_long_form.mp4", row["long_form_path"] or "")
            self.assertTrue(not row["error_message"])
            meta = self.mc._json_loads(row["script_json"], {})
            self.assertEqual(meta.get("shadowcast_status"), "partial")
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
