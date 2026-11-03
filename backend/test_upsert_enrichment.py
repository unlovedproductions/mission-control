"""Regression: failed re-import/re-enrich must not wipe stored enrichment."""

import os
import tempfile
import unittest


class UpsertEnrichmentPreserveTests(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        db_path = os.path.join(self._tmpdir.name, "test.db")

        import main as mc

        self.mc = mc
        mc.DB_PATH = db_path
        mc.init_db()
        self.conn = mc.get_db()

    def tearDown(self):
        self.conn.close()

    def test_empty_reenrich_preserves_product_info(self):
        good_info = self.mc._json_dumps(
            {
                "product_name": "CircO2",
                "niche": "Health",
                "key_features": ["oxygen support"],
                "price": "$49",
                "affiliate_link": "https://example.com/aff",
                "keywords": ["oxygen"],
                "target_audience": "Adults",
                "product_category": "Health",
                "competitors": ["RivalX"],
                "unique_selling_point": "USP",
                "content_style": "honest_review",
            }
        )
        good_payload = {"product": {"name": "CircO2"}, "review_brief": {"price_display": "$49"}}

        pid, was_update = self.mc._upsert_product_from_apf(
            self.conn,
            "digistore24",
            {
                "id": 42,
                "name": "CircO2",
                "category": "Health",
                "commissionRate": "50%",
                "hiddenGemScore": 8.5,
                "affiliateLink": "https://example.com/aff",
                "description": "desc",
            },
            good_payload,
            "honest_review",
            ["RivalX"],
            {"price_display": "$49"},
            good_info,
            "token-abc",
        )
        self.conn.commit()
        self.assertFalse(was_update)

        _, was_update = self.mc._upsert_product_from_apf(
            self.conn,
            "digistore24",
            {
                "id": 42,
                "name": "CircO2",
                "category": "Health",
                "commissionRate": "50%",
                "hiddenGemScore": 8.5,
                "affiliateLink": "https://example.com/aff",
                "description": "desc",
            },
            {},
            "",
            [],
            {},
            "",
            "",
        )
        self.conn.commit()
        self.assertTrue(was_update)

        row = self.conn.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
        self.assertEqual(row["product_info_json"], good_info)
        self.assertEqual(row["apf_import_token"], "token-abc")
        self.assertEqual(row["recommended_content_style"], "honest_review")
        self.assertIn("RivalX", row["competitors"])
        self.assertIn("CircO2", row["enriched_payload"])

    def test_apf_session_cookie_is_masked_in_public_config(self):
        conn = self.mc.get_db()
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
            ("apf_session_cookie", "super-secret-session-id"),
        )
        conn.commit()
        conn.close()

        public = self.mc.get_public_config()
        self.assertNotEqual(public.get("apf_session_cookie"), "super-secret-session-id")
        self.assertTrue(str(public.get("apf_session_cookie", "")).endswith("n-id"))


if __name__ == "__main__":
    unittest.main()
