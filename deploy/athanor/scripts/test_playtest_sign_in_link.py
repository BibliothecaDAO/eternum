import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import playtest_sign_in_link as helper

TOKEN = "operator-token-value"
LINK = "https://staging.realms.party/api/test/sign-in?token=c2luZ2xlLXVzZS1yYW5kb20tYnl0ZXMtMzItYnl0ZXM"


class PlaytestSignInLinkTest(unittest.TestCase):
    def run_helper(self, status, body):
        sent = []

        def post(url, token):
            sent.append((url, token))
            return status, json.dumps(body).encode() if not isinstance(body, bytes) else body

        with tempfile.TemporaryDirectory() as temporary:
            token_file = Path(temporary) / "staging-operator-token"
            token_file.write_text(TOKEN + "\n")
            output = io.StringIO()
            with patch.object(helper, "TOKEN_FILE", token_file), redirect_stdout(output):
                try:
                    helper.main(post)
                    refusal = None
                except SystemExit as exit:
                    refusal = str(exit.code)
        return output.getvalue(), refusal, sent

    def test_prints_only_the_link_and_sends_the_token_only_to_the_route(self):
        output, refusal, sent = self.run_helper(200, {"link": LINK})
        self.assertIsNone(refusal)
        self.assertEqual(output, LINK + "\n")
        self.assertEqual(sent, [(helper.ROUTE, TOKEN)])

    def test_refuses_anything_but_a_staging_link_without_naming_token_or_link(self):
        for status, body in (
            (404, {"error": "not_found"}),
            (401, {"error": "unauthorized"}),
            (200, {"link": "http://staging.realms.party/api/test/sign-in?token=a"}),
            (200, {"link": "https://play.realms.party/api/test/sign-in?token=a"}),
            (200, {"link": "https://staging.realms.party:8443/api/test/sign-in?token=a"}),
            (200, {"link": "https://user@staging.realms.party/api/test/sign-in?token=a"}),
            (200, {"link": "https://staging.realms.party/api/other?token=a"}),
            (200, {"link": "https://staging.realms.party/api/test/sign-in"}),
            (200, {"link": "https://staging.realms.party/api/test/sign-in?token="}),
            (200, {"link": "https://staging.realms.party/api/test/sign-in?token=a&token=b"}),
            (200, {"link": "https://staging.realms.party/api/test/sign-in?token=a&next=/x"}),
            (200, {"link": "https://staging.realms.party/api/test/sign-in?token=a#fragment"}),
            (200, {"link": LINK + " extra"}),
            (200, {"url": LINK}),
            (200, b"not json"),
        ):
            with self.subTest(status=status, body=body):
                output, refusal, _ = self.run_helper(status, body)
                self.assertEqual(output, "")
                self.assertIsNotNone(refusal)
                self.assertNotIn(TOKEN, refusal)
                self.assertNotIn("sign-in?token", refusal)


if __name__ == "__main__":
    unittest.main()
