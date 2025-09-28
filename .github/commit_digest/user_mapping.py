from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict


DISCORD_ID_PATTERN = re.compile(r"\d+")


@dataclass
class MappingEntry:
    mention: str
    user_id: str


logger = logging.getLogger(__name__)


class MappingLoadError(RuntimeError):
    pass


def _extract_user_id(value: str) -> str | None:
    match = DISCORD_ID_PATTERN.search(value)
    return match.group(0) if match else None


def load_mapping(path: Path) -> Dict[str, MappingEntry]:
    """Load a GitHub-to-Discord mapping from JSON.

    Supported shapes:
    - {"octocat": "<@123>"}
    - {"octocat": {"discord": "<@123>", "id": "123"}}
    """
    logger.info("Loading user mapping from %s", path)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:  # pragma: no cover - surface IO issues
        raise MappingLoadError(f"Unable to open mapping file: {exc}") from exc
    except json.JSONDecodeError as exc:  # pragma: no cover
        raise MappingLoadError(f"Mapping file is not valid JSON: {exc}") from exc

    mapping: Dict[str, MappingEntry] = {}
    for key, value in raw.items():
        mention: str | None = None
        user_id: str | None = None

        if isinstance(value, str):
            mention = value
            user_id = _extract_user_id(value)
        elif isinstance(value, dict):
            mention_value = value.get("mention") or value.get("discord")
            id_value = value.get("id") or value.get("discord_id")
            if isinstance(mention_value, str):
                mention = mention_value
            if isinstance(id_value, str) and id_value.isdigit():
                user_id = id_value
            if mention and not user_id:
                user_id = _extract_user_id(mention)

        if mention and user_id:
            mapping[key.lower()] = MappingEntry(mention=mention, user_id=user_id)
            logger.debug(
                "Mapped GitHub user %s to Discord mention %s (id %s)", key.lower(), mention, user_id
            )
        else:
            logger.warning(
                "Mapping entry for %s missing mention or Discord id; mention=%s id=%s",
                key,
                mention,
                user_id,
            )

    logger.info("Loaded %d mapping entries", len(mapping))
    return mapping


__all__ = ["MappingEntry", "load_mapping", "MappingLoadError"]
