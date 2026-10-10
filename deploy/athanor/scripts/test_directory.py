import io
import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

import directory


class RetirementTest(unittest.TestCase):
    CONFIG = {"guardian_url": "https://identity.test/api/guardian", "public_herald_url": "https://herald.test"}

    def test_an_absent_listing_is_already_retired(self):
        for code, reason in ((404, "shard_not_listed"), (409, "shard_status_change_refused")):
            with self.subTest(code=code):
                body = io.BytesIO(json.dumps({"error": reason}).encode())
                error = HTTPError("https://identity.test", code, "Conflict", {}, body)
                with patch.dict(directory.os.environ, {"OPERATOR_TOKEN": "test-token"}), patch.object(directory, "urlopen", side_effect=error):
                    self.assertEqual(directory.directory_status(self.CONFIG, "retired"), {"url": self.CONFIG["public_herald_url"], "status": "retired"})
                self.assertTrue(body.closed)

    def test_other_errors_and_other_operations_remain_failures(self):
        for status, code, body in [("pending", 409, {"error": "shard_status_change_refused"}), ("retired", 403, {"error": "shard_status_change_refused"}), ("retired", 409, {"error": "other_conflict"}), ("retired", 500, {"error": "unavailable"}), ("retired", 404, {"error": "route_missing"})]:
            with self.subTest(status=status, code=code):
                error = HTTPError("https://identity.test", code, "Failure", {}, io.BytesIO(json.dumps(body).encode()))
                with patch.dict(directory.os.environ, {"OPERATOR_TOKEN": "test-token"}), patch.object(directory, "urlopen", side_effect=error), self.assertRaises(HTTPError):
                    directory.directory_status(self.CONFIG, status)
                error.close()
