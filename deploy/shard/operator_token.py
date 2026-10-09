"""Read the official operator credential without copying it into deployment artifacts."""
import os
from pathlib import Path
import stat


def read_operator_token(path, owner_uid=None):
    try:
        descriptor = os.open(Path(path), os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    except OSError:
        raise ValueError("Operator credential file is unavailable") from None
    with os.fdopen(descriptor, "rb") as source:
        metadata = os.fstat(source.fileno())
        if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
            raise ValueError("Operator credential must be a regular 0600 file")
        if metadata.st_uid != (os.geteuid() if owner_uid is None else owner_uid):
            raise ValueError("Operator credential must belong to the deployment owner")
        try:
            token = source.read(4097).decode("utf8").rstrip("\n")
        except UnicodeDecodeError:
            raise ValueError("Operator credential has invalid encoding") from None
        if not token or len(token) > 4096 or any(character.isspace() for character in token):
            raise ValueError("Operator credential has invalid length or whitespace")
        return token
