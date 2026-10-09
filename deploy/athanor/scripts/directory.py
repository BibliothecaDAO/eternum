"""The identity service owns shard visibility; deployment and the runner use the same lifecycle requests."""
import json
import os
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

PENDING_ROUTE_PREREQUISITE = "The identity service must carry the pending route before a shard from this code starts"


def wait_for_identity(config):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            with urlopen(config["public_herald_url"].rstrip("/") + "/manifest", timeout=3) as response:
                identity = json.load(response)["shard"]
            expected = "0x" + config["chain_id"].encode("ascii").hex()
            if int(identity["chainId"], 16) != int(expected, 16):
                raise RuntimeError("Herald serves a different shard identity")
            return
        except (OSError, KeyError, ValueError):
            time.sleep(1)
    raise RuntimeError("Herald did not serve the prepared shard identity")


def directory_status(config, status):
    if status not in ("pending", "active", "retired"):
        raise ValueError("Deployment can only register pending, activate or retire a shard")
    token = os.environ.get("OPERATOR_TOKEN")
    if not token:
        raise ValueError("OPERATOR_TOKEN required for official directory activation")
    base = config["guardian_url"].removesuffix("/guardian")
    suffix = {
        "pending": "/directory/shards/pending",
        "active": "/directory/shards",
        "retired": "/directory/shards/status",
    }[status]
    body = {"url": config["public_herald_url"]}
    if status == "retired":
        body["status"] = "retired"
    request = Request(
        base + suffix, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + token}, method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
    except HTTPError as error:
        if status == "pending" and error.code == 404:
            error.close()
            raise RuntimeError(PENDING_ROUTE_PREREQUISITE) from None
        raise
    allowed = {"pending": ("pending", "active", "draining"), "active": ("active", "draining"), "retired": ("retired",)}[status]
    if result.get("status") not in allowed:
        raise RuntimeError("Directory returned an unexpected shard status")
    return result
