import io
import json
import os
from email.message import Message
import unittest
from urllib.error import HTTPError
from urllib.request import HTTPHandler, HTTPSHandler
from urllib.response import addinfourl
from unittest.mock import patch

import deploy
import directory
import shard
import service_requests
from service_requests import service_json
from test_shard import configuration


class ServiceTransportTest(unittest.TestCase):
    def test_guardian_reads_and_authenticated_writes_carry_the_service_user_agent(self):
        for payload in (None, {"status": "pending"}):
            with self.subTest(payload=payload):
                response = io.BytesIO(b'{"ok": true}')
                with patch.dict(os.environ, {"OPERATOR_TOKEN": "test-token"}), \
                        patch("service_requests.build_opener") as opener:
                    opener.return_value.open.return_value.__enter__.return_value = response
                    self.assertEqual(service_json("https://identity.test/api/guardian", payload), {"ok": True})
                    request = opener.return_value.open.call_args.args[0]
                    self.assertEqual(request.get_header("User-agent"), "realms-shard-init")
                    self.assertEqual(request.get_header("Authorization"), None if payload is None else "Bearer test-token")

    def test_config_refuses_http_guardian_before_any_authenticated_request(self):
        config = {**configuration(), "guardian_url": "http://identity.test/api/guardian"}
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            shard.validate_shard_identity(config)

    def test_directory_and_launcher_never_follow_even_same_origin_redirects(self):
        config = {"guardian_url": "https://identity.test/api/guardian", "public_herald_url": "https://herald.test"}
        for target in ("https://identity.test/elsewhere", "https://other.test/steal", "http://other.test/steal"):
            for operation in (lambda: directory.directory_status(config, "pending"),
                              lambda: deploy.launcher_service(config, "enrol", {})):
                with self.subTest(target=target):
                    requests = []

                    def transport(request):
                        requests.append(request.full_url)
                        headers = Message()
                        if len(requests) == 1:
                            headers["Location"] = target
                            status = 302
                        else:
                            status = 200
                        response = addinfourl(io.BytesIO(json.dumps({"status": "pending"}).encode()), headers, request.full_url, status)
                        response.msg = "Fixture response"
                        return response

                    with patch.dict(os.environ, {"OPERATOR_TOKEN": "test-token"}), \
                            patch.object(HTTPSHandler, "https_open", side_effect=transport), \
                            patch.object(HTTPHandler, "http_open", side_effect=transport):
                        with self.assertRaises((HTTPError, RuntimeError)):
                            operation()
                    self.assertEqual(len(requests), 1)

class AuthenticatedReadTest(unittest.TestCase):
    def test_operator_read_has_a_token_without_turning_into_a_post(self):
        with patch.dict(os.environ, {'OPERATOR_TOKEN': 'throwaway'}), \
                patch.object(service_requests, 'build_opener') as transport:
            transport.return_value.open.return_value.__enter__.return_value = io.BytesIO(b'{"shards":[]}')
            self.assertEqual(service_requests.service_json('https://identity.test/api/directory/shards', authenticated=True), {'shards': []})
            request = transport.return_value.open.call_args.args[0]
            self.assertEqual(request.get_method(), 'GET')
            self.assertEqual(request.get_header('Authorization'), 'Bearer throwaway')


class ServiceFailureTest(unittest.TestCase):
    def test_status_and_fixed_code_survive_without_printing_the_body(self):
        failure = HTTPError("https://identity.test/api/value/operator/shard/enrol", 409, "Conflict", {}, io.BytesIO(b'{"error":"relay_target_differs","detail":"private"}'))
        with patch.dict(os.environ, {"OPERATOR_TOKEN": "throwaway"}), patch.object(service_requests, "build_opener") as transport:
            transport.return_value.open.side_effect = failure
            with self.assertRaises(HTTPError) as raised:
                service_json("https://identity.test/api/value/operator/shard/enrol", {})
        self.assertEqual(raised.exception.code, 409)
        self.assertEqual(raised.exception.service_code, "relay_target_differs")
        self.assertNotIn("private", str(raised.exception))
