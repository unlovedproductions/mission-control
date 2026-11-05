"""Regression: masked Settings secrets must not wipe or leak real values."""

import os
import tempfile
import unittest


class SecretConfigRoundtripTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        db_path = os.path.join(self._tmpdir.name, "test.db")

        import main as mc

        self.mc = mc
        mc.DB_PATH = db_path
        mc.init_db()

    def test_mask_roundtrip_refused(self):
        conn = self.mc.get_db()
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            ("internal_service_secret", "super-secret-value-99"),
        )
        conn.commit()
        conn.close()

        public = self.mc.get_public_config()
        masked = public["internal_service_secret"]
        self.assertIn("*", masked)
        self.assertNotEqual(masked, "super-secret-value-99")

        import asyncio

        result = asyncio.get_event_loop().run_until_complete(
            self.mc.update_config(
                self.mc.ConfigUpdate(key="internal_service_secret", value=masked)
            )
        )
        self.assertEqual(result["status"], "unchanged")
        self.assertEqual(result["reason"], "refused_masked_secret")

        stored = self.mc.get_config()["internal_service_secret"]
        self.assertEqual(stored, "super-secret-value-99")

    def test_config_update_redacts_secrets_in_activity_log(self):
        import asyncio

        asyncio.get_event_loop().run_until_complete(
            self.mc.update_config(
                self.mc.ConfigUpdate(
                    key="internal_service_secret", value="brand-new-secret-xyz"
                )
            )
        )
        conn = self.mc.get_db()
        row = conn.execute(
            "SELECT details FROM activity_log WHERE action = 'config_updated' "
            "ORDER BY id DESC LIMIT 1"
        ).fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertNotIn("brand-new-secret-xyz", row["details"])
        self.assertIn("[redacted]", row["details"])

    def test_apf_session_cookie_is_masked(self):
        conn = self.mc.get_db()
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            ("apf_session_cookie", "session-cookie-abc123"),
        )
        conn.commit()
        conn.close()

        public = self.mc.get_public_config()
        self.assertNotEqual(public.get("apf_session_cookie"), "session-cookie-abc123")
        self.assertTrue(str(public.get("apf_session_cookie", "")).endswith("c123"))


if __name__ == "__main__":
    unittest.main()
