"""Read the official operator credential without copying it into deployment artifacts."""
import os
from pathlib import Path
import stat


OPERATOR_TOKEN_FILE = Path("/opt/athanor/operator-token")


def read_protected_text(path):
    try:
        descriptor = os.open(Path(path), os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    except OSError:
        raise ValueError("Operator credential file is unavailable") from None
    with os.fdopen(descriptor, "rb") as source:
        metadata = os.fstat(source.fileno())
        if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
            raise ValueError("Protected credential must be a regular owner-only mode 0600 file")
        if metadata.st_uid != os.geteuid():
            raise ValueError("Protected credential must belong to the reading process effective uid")
        try:
            value = source.read(4097).decode("utf8")
        except UnicodeDecodeError:
            raise ValueError("Operator credential has invalid encoding") from None
        if len(value) > 4096:
            raise ValueError("Protected credential exceeds its size bound")
        return value


def operator_environment():
    token = read_protected_text(OPERATOR_TOKEN_FILE).rstrip("\n")
    if not token or any(character.isspace() for character in token):
        raise ValueError("Operator credential has invalid length or whitespace")
    return {"OPERATOR_TOKEN": token, "OPERATOR_TOKEN_FILE": str(OPERATOR_TOKEN_FILE)}
