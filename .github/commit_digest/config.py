from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


DEFAULT_MODEL = "gpt-5.0-mini"
DEFAULT_MAX_COMMITS = 20
DEFAULT_MAPPING_PATH = ".github/commit_digest/user_mapping.json"
DEFAULT_GITHUB_API = "https://api.github.com"
DEFAULT_DISCORD_API = "https://discord.com/api/v10"


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value:
        try:
            return int(value)
        except ValueError:
            pass
    return default


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass
class DigestConfig:
    branch: str
    max_commits: int
    repository_root: Path
    output_directory: Path
    openai_api_key: str
    discord_webhook_url: Optional[str]
    discord_bot_token: Optional[str]
    discord_channel_id: Optional[str]
    discord_api_base: str
    model: str = DEFAULT_MODEL
    dry_run: bool = False
    mapping_file: Optional[Path] = None
    github_token: Optional[str] = None
    repository_slug: Optional[str] = None
    github_api_base: str = DEFAULT_GITHUB_API
    dm_assignees: bool = True

    @property
    def reports_directory(self) -> Path:
        return self.output_directory

    @property
    def has_discord_transport(self) -> bool:
        return bool(self.discord_webhook_url or (self.discord_bot_token and self.discord_channel_id))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a daily commit digest and distribute it via Discord bot or webhook."
    )
    parser.add_argument(
        "--branch",
        default=os.environ.get("DIGEST_BRANCH", "main"),
        help="Branch to fetch commits from (default: env DIGEST_BRANCH or 'main').",
    )
    parser.add_argument(
        "--max-commits",
        type=int,
        default=_env_int("DIGEST_MAX_COMMITS", DEFAULT_MAX_COMMITS),
        help="Maximum number of commits to summarize (default: env DIGEST_MAX_COMMITS or 20).",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
        help="OpenAI model identifier to use for summarization.",
    )
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("DIGEST_OUTPUT_DIR"),
        help="Directory where markdown summaries will be stored (default: .github/commit_digest/reports).",
    )
    parser.add_argument(
        "--mapping-file",
        default=os.environ.get("DIGEST_MAPPING_FILE", DEFAULT_MAPPING_PATH),
        help="Path to JSON mapping between GitHub usernames and Discord identifiers.",
    )
    parser.add_argument(
        "--repo-slug",
        default=os.environ.get("DIGEST_REPOSITORY") or os.environ.get("GITHUB_REPOSITORY"),
        help="Repository slug in 'owner/name' format (default: env DIGEST_REPOSITORY or GITHUB_REPOSITORY).",
    )
    parser.add_argument(
        "--github-api",
        default=os.environ.get("DIGEST_GITHUB_API", DEFAULT_GITHUB_API),
        help="Base URL for the GitHub API.",
    )
    parser.add_argument(
        "--discord-api",
        default=os.environ.get("DIGEST_DISCORD_API", DEFAULT_DISCORD_API),
        help="Base URL for the Discord REST API (when using bot token).",
    )
    parser.add_argument(
        "--no-dm-assignees",
        action="store_true",
        help="Disable direct Discord mentions for assigned issues (overrides env DIGEST_DM_ASSIGNEES).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without calling external services or writing files (for testing).",
    )
    return parser


def resolve_output_directory(repository_root: Path, explicit: Optional[str]) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    return repository_root / ".github" / "commit_digest" / "reports"


def resolve_mapping_path(repository_root: Path, mapping_file: Optional[str]) -> Optional[Path]:
    if not mapping_file:
        return None
    candidate = Path(mapping_file)
    if not candidate.is_absolute():
        candidate = (repository_root / candidate).resolve()
    return candidate if candidate.exists() else None


def load_config(namespace: Optional[argparse.Namespace] = None) -> DigestConfig:
    parser = build_parser()
    args = namespace or parser.parse_args()
    repository_root = Path(os.environ.get("GITHUB_WORKSPACE", Path.cwd())).resolve()
    output_directory = resolve_output_directory(repository_root, args.output_dir)

    openai_api_key = os.environ.get("OPENAI_API_KEY", "")
    if not openai_api_key and not args.dry_run:
        parser.error("OPENAI_API_KEY environment variable must be set unless --dry-run is supplied.")

    discord_webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
    discord_bot_token = os.environ.get("DISCORD_BOT_TOKEN")
    discord_channel_id = os.environ.get("DISCORD_CHANNEL_ID")

    mapping_path = resolve_mapping_path(repository_root, args.mapping_file)
    github_token = os.environ.get("DIGEST_GITHUB_TOKEN") or os.environ.get("GITHUB_TOKEN")

    if args.max_commits <= 0:
        parser.error("--max-commits must be a positive integer.")

    dm_assignees = _env_bool("DIGEST_DM_ASSIGNEES", True)
    if args.no_dm_assignees:
        dm_assignees = False

    config = DigestConfig(
        branch=args.branch,
        max_commits=args.max_commits,
        repository_root=repository_root,
        output_directory=output_directory,
        openai_api_key=openai_api_key,
        discord_webhook_url=discord_webhook_url,
        discord_bot_token=discord_bot_token,
        discord_channel_id=discord_channel_id,
        discord_api_base=args.discord_api,
        model=args.model,
        dry_run=args.dry_run,
        mapping_file=mapping_path,
        github_token=github_token,
        repository_slug=args.repo_slug,
        github_api_base=args.github_api,
        dm_assignees=dm_assignees,
    )

    if not config.dry_run and not config.has_discord_transport:
        parser.error(
            "Provide either DISCORD_WEBHOOK_URL or both DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID for notifications."
        )

    return config


__all__ = [
    "DigestConfig",
    "load_config",
]
