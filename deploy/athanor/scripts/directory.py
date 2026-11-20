import time
from urllib.error import HTTPError, URLError
from service_requests import service_json


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
