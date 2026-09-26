#!/usr/bin/env python3
"""Print a single-use sign-in link for a staging playtest account, and nothing else.

    sudo -n /usr/local/bin/playtest-sign-in-link

A headless playtest captures stdout into its own process and opens the link there, so the link never reaches a chat,
a transcript or a file, and the operator token never leaves the box: this script reads it from the root-only file
itself. Installed root-owned as /usr/local/bin/playtest-sign-in-link on the box that holds the staging token.
Anything but a well-formed link on the staging origin is refused with a message that names neither token nor link.
"""
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qsl, urlparse
from urllib.request import Request, urlopen

TOKEN_FILE = Path("/opt/athanor/config/staging-operator-token")
ORIGIN = "staging.realms.party"
ROUTE = f"https://{ORIGIN}/api/test/sign-in-link"
LINK_PATH = "/api/test/sign-in"


def main(post=None):
    token = TOKEN_FILE.read_text().strip()
    status, body = (post or post_route)(ROUTE, token)
    if status != 200:
        raise SystemExit(f"The sign-in link route answered {status}")
    link = parse_link(body)
    if link is None:
        raise SystemExit("The sign-in link route answered without a staging link")
    print(link)


def post_route(url, token):
    request = Request(url, method="POST", headers={"authorization": f"Bearer {token}"})
    try:
        with urlopen(request, timeout=20) as response:
            return response.status, response.read()
    except HTTPError as error:
        return error.code, b""


def parse_link(body):
    try:
        link = json.loads(body).get("link")
    except (ValueError, AttributeError):
        return None
    if not isinstance(link, str) or any(character.isspace() for character in link):
        return None
    url = urlparse(link)
    query = parse_qsl(url.query, keep_blank_values=True)
    single_token = len(query) == 1 and query[0][0] == "token" and query[0][1] != ""
    staging = url.scheme == "https" and url.netloc == ORIGIN and url.path == LINK_PATH
    return link if staging and single_token and not url.params and not url.fragment else None


if __name__ == "__main__":
    main()
