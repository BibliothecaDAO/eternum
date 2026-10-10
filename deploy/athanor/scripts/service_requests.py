"""One HTTPS, non-redirecting boundary for the environment's authenticated services."""
import json
import os
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


class RefuseRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def require_service_url(url):
    parsed = urlparse(url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment):
        raise ValueError("Identity service endpoint must use HTTPS without credentials, query or fragment")
    return url


def identity_service_base(guardian_url):
    require_service_url(guardian_url)
    if not urlparse(guardian_url).path.endswith("/guardian"):
        raise ValueError("guardian_url must be an identity API's /guardian route")
    return guardian_url.removesuffix("/guardian")


def service_json(url, payload=None, timeout=30):
    require_service_url(url)
    headers = {"Content-Type": "application/json", "User-Agent": "realms-shard-init"}
    if payload is not None:
        token = os.environ.get("OPERATOR_TOKEN")
        if not token:
            raise ValueError("Protected operator credential required for service request")
        headers["Authorization"] = "Bearer " + token
    request = Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
    with build_opener(RefuseRedirects()).open(request, timeout=timeout) as response:
        return json.load(response)
