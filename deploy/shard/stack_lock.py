"""The isolated-stack lock our box holds around anything that deploys to it, loads it, or stops or starts shard
services: deploy.py, shard.py and backup.py take it through this one helper."""
import os
from pathlib import Path
import time

LOCK = Path("/opt/athanor/isolated-stack.lock")


class isolated_stack_lock:
    """The shared box lock, taken in one atomic step: the holder and time are written to a private file beside the lock
    and hard-linked into place, so the lock never exists empty. A held lock is refused naming its holder, never waited
    on, and the lock is removed when the holder's work ends."""

    def __init__(self, holder, path=LOCK):
        self.holder, self.path = holder, path

    def __enter__(self):
        draft = self.path.with_name(f".{self.path.name}.{os.getpid()}")
        draft.write_text(f"{self.holder} {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}\n")
        try:
            os.link(draft, self.path)
        except FileExistsError:
            raise RuntimeError(f"{self.path} is held: {self.path.read_text().strip()}") from None
        finally:
            draft.unlink()

    def __exit__(self, *_):
        self.path.unlink()
