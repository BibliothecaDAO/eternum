import io
import json
import unittest
from urllib.error import HTTPError, URLError
from unittest.mock import patch

import directory


class FakeIdentity:
    def __init__(self, row=None, chain="0x" + b"TEST".hex()):
        self.row = row
        self.chain = chain
        self.methods = []

    def __call__(self, url, payload=None, timeout=30, *, authenticated=False, method=None):
        if url != "https://identity.test/api/directory/shard" or (payload is None and not authenticated):
            raise AssertionError(f"unexpected directory request {method} {url}")
        self.methods.append(method or "GET")
        if method == "PUT":
            self.row = {"url": payload["url"], "chainId": self.chain}
        if method == "DELETE":
            self.row = None
        return {"shard": self.row}


class DirectoryRowTest(unittest.TestCase):
    CONFIG = {"guardian_url": "https://identity.test/api/guardian", "chain_id": "TEST"}

    def test_registering_twice_leaves_one_row_with_the_latest_url(self):
        identity = FakeIdentity()
        with patch.object(directory, "service_json", side_effect=identity):
            directory.register_shard({**self.CONFIG, "public_herald_url": "https://old.test"})
            for _ in range(2):
                registered = directory.register_shard({**self.CONFIG, "public_herald_url": "https://herald.test"})
            self.assertEqual(directory.registered_shard(self.CONFIG), {"url": "https://herald.test", "chainId": identity.chain})
        self.assertEqual(registered, identity.row)
        self.assertEqual(identity.methods, ["PUT", "PUT", "PUT", "GET"])

    def test_a_registration_naming_another_chain_is_refused(self):
        identity = FakeIdentity(chain="0x1")
        with patch.object(directory, "service_json", side_effect=identity), \
                self.assertRaisesRegex(RuntimeError, "different shard identity"):
            directory.register_shard({**self.CONFIG, "public_herald_url": "https://herald.test"})

    def test_removing_twice_ends_with_no_row_and_no_error(self):
        identity = FakeIdentity({"url": "https://herald.test", "chainId": "0x1"})
        with patch.object(directory, "service_json", side_effect=identity):
            for _ in range(2):
                directory.remove_shard(self.CONFIG)
            self.assertIsNone(directory.registered_shard(self.CONFIG))
        self.assertEqual(identity.methods, ["DELETE", "DELETE", "GET"])


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
