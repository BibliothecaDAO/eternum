import time
from urllib.error import HTTPError, URLError
from service_requests import identity_service_base, service_json


class HeraldIdentityRefused(RuntimeError):
    def __init__(self, status):
        self.status = status
        super().__init__(f"Herald identity read refused: HTTP {status}")


def wait_for_identity(config):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            identity = service_json(config["public_herald_url"].rstrip("/") + "/manifest", timeout=3)
            if not isinstance(identity, dict) or identity.get("version") != 1:
                raise ValueError("Invalid public shard manifest")
            expected = "0x" + config["chain_id"].encode("ascii").hex()
            if int(identity["chainId"], 16) != int(expected, 16):
                raise RuntimeError("Herald serves a different shard identity")
            return
        except HTTPError as error:
            error.close()
            if not 500 <= error.code < 600:
                raise HeraldIdentityRefused(error.code) from None
        except (URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(1)
    raise RuntimeError("Herald did not serve the prepared shard identity")


def register_shard(config):
    listing = service_json(directory_route(config), {"url": config["public_herald_url"]}, method="PUT")
    shard = listing.get("shard") if isinstance(listing, dict) else None
    expected = "0x" + config["chain_id"].encode("ascii").hex()
    if not isinstance(shard, dict) or int(shard.get("chainId", "0x0"), 16) != int(expected, 16):
        raise RuntimeError("Directory registered a different shard identity")
    return shard


def registered_shard(config):
    listing = service_json(directory_route(config), authenticated=True)
    if not isinstance(listing, dict) or "shard" not in listing:
        raise RuntimeError("Directory read is malformed")
    return listing["shard"]


def remove_shard(config):
    service_json(directory_route(config), authenticated=True, method="DELETE")


def directory_route(config):
    return identity_service_base(config["guardian_url"]) + "/directory/shard"
