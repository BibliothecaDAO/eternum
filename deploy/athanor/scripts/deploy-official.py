#!/usr/bin/env python3
"""Deploy an official shard using its owner's protected operator credential file."""
import argparse
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shard"))
from operator_token import read_operator_token
import deploy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment")
    parser.add_argument("directory", type=Path)
    parser.add_argument("--operator-token-file", type=Path, default=Path("/opt/athanor/operator-token"))
    arguments = parser.parse_args()
    path = arguments.operator_token_file.absolute()
    if any(character in str(path) for character in ("\n", "\r", "$")):
        raise ValueError("Operator credential path cannot be rendered safely")
    os.environ["OPERATOR_TOKEN"] = read_operator_token(path)
    os.environ["OPERATOR_TOKEN_FILE"] = str(path)
    try:
        return deploy.main(arguments.environment, arguments.directory.resolve())
    finally:
        os.environ.pop("OPERATOR_TOKEN", None)


if __name__ == "__main__":
    os.umask(0o077)
    try:
        raise SystemExit(main())
    except Exception:
        raise SystemExit("Official deployment failed; inspect its fixed-status checks") from None
