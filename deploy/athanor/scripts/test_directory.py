import io
import json
import unittest
from urllib.error import HTTPError, URLError
from unittest.mock import patch

import directory


class HeraldIdentityTest(unittest.TestCase):
    CONFIG = {"public_herald_url": "https://herald.test/", "chain_id": "TEST"}
    IDENTITY = {"version": 1, "chainId": hex(int.from_bytes(b"TEST", "big"))}

    def test_public_read_uses_named_agent_without_credential(self):
        with patch("service_requests.build_opener") as opener:
            opener.return_value.open.return_value.__enter__.return_value = io.BytesIO(json.dumps(self.IDENTITY).encode())
            directory.wait_for_identity(self.CONFIG)
        request = opener.return_value.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://herald.test/manifest")
        self.assertEqual(request.get_header("User-agent"), "realms-shard-init")
        self.assertIsNone(request.get_header("Authorization"))
        self.assertIsNone(request.data)

    def test_client_errors_stop_immediately_and_name_only_the_status(self):
        for code in (301, 400, 401, 403, 404, 429):
            with self.subTest(code=code):
                error = HTTPError("https://herald.test", code, "private message", {}, io.BytesIO(b"private body"))
                with patch.object(directory, "service_json", side_effect=error) as read, patch.object(directory.time, "sleep") as sleep:
                    with self.assertRaisesRegex(RuntimeError, f"^Herald identity read refused: HTTP {code}$"):
                        directory.wait_for_identity(self.CONFIG)
                    read.assert_called_once_with("https://herald.test/manifest", timeout=3)
                    sleep.assert_not_called()
                self.assertTrue(error.fp.closed)

    def test_connection_errors_and_server_errors_retry(self):
        for error in (URLError("connection refused"), TimeoutError(), ConnectionError(), HTTPError("https://herald.test", 503, "not ready", {}, io.BytesIO())):
            with self.subTest(error=type(error).__name__), patch.object(directory, "service_json", side_effect=[error, self.IDENTITY]) as read, patch.object(directory.time, "sleep") as sleep:
                directory.wait_for_identity(self.CONFIG)
                self.assertEqual(read.call_count, 2)
                sleep.assert_called_once_with(1)

    def test_invalid_and_different_identity_are_not_transient(self):
        for identity in ({}, {"version": 1, "chainId": "0x1"}):
            with self.subTest(identity=identity), patch.object(directory, "service_json", return_value=identity), patch.object(directory.time, "sleep") as sleep:
                with self.assertRaises((ValueError, RuntimeError)):
                    directory.wait_for_identity(self.CONFIG)
                sleep.assert_not_called()
