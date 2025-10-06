from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Dict, List

if __package__ in (None, ""):
    PACKAGE_ROOT = Path(__file__).resolve().parent
    if str(PACKAGE_ROOT) not in sys.path:
        sys.path.insert(0, str(PACKAGE_ROOT))
    from config import DigestConfig, load_config  # type: ignore  # noqa: E402
    from discord_client import DiscordNotificationError, post_digest  # type: ignore  # noqa: E402
    from git_utils import GitExecutionError, collect_commits, fetch_branch  # type: ignore  # noqa: E402
    from issues import GitHubIssueError, IssueAlert, fetch_open_issues  # type: ignore  # noqa: E402
    from markdown_builder import build_markdown, write_markdown  # type: ignore  # noqa: E402
    from summary import GPTDigestor, ModelDigest, SummarizationError, fallback_digest  # type: ignore  # noqa: E402
    from user_mapping import MappingEntry, MappingLoadError, load_mapping  # type: ignore  # noqa: E402
else:
    from .config import DigestConfig, load_config
    from .discord_client import DiscordNotificationError, post_digest
    from .git_utils import GitExecutionError, collect_commits, fetch_branch
    from .issues import GitHubIssueError, IssueAlert, fetch_open_issues
    from .markdown_builder import build_markdown, write_markdown
    from .summary import GPTDigestor, ModelDigest, SummarizationError, fallback_digest
    from .user_mapping import MappingEntry, MappingLoadError, load_mapping


logger = logging.getLogger(__name__)



def build_issue_alerts(config: DigestConfig, mapping: Dict[str, MappingEntry]) -> List[IssueAlert]:
    if config.dry_run:
        logger.info("Dry run enabled; skipping issue alert lookup")
        return []

    if not mapping:
        logger.info("No mapping entries available; skipping issue alert lookup")
        return []

    logger.info("Attempting issue lookup for %d mapped assignee(s)", len(mapping))

    try:
        assignments = fetch_open_issues(
            repository_slug=config.repository_slug,
            github_api_base=config.github_api_base,
            assignees=mapping.keys(),
            token=config.github_token,
        )
    except GitHubIssueError as exc:
        logger.warning("GitHub issue lookup failed: %s", exc)
        return []

    alerts: List[IssueAlert] = []
    for login, issues in assignments.items():
        entry = mapping.get(login)
        if not entry:
            logger.debug("No Discord mapping found for %s; skipping alert", login)
            continue
        alerts.append(IssueAlert(github_login=login, discord_mention=entry.mention, issues=issues))
        logger.debug("Prepared alert for %s with %d issue(s)", login, len(issues))

    if not alerts:
        logger.info("Issue lookup produced no assignments for mapped users")
    else:
        logger.info("Prepared %d issue alert(s)", len(alerts))
    return alerts


def build_author_mentions(digest: ModelDigest, mapping: Dict[str, MappingEntry]) -> Dict[str, str]:
    mentions: Dict[str, str] = {}
    if not mapping:
        return mentions

    for author in getattr(digest, "authors", []):
        name = getattr(author, "name", "").strip()
        if not name:
            continue
        lookup = name.lower()
        entry = mapping.get(lookup)
        if entry:
            mentions[name] = entry.mention
            logger.debug("Matched digest author %s to Discord mention %s", name, entry.mention)
        else:
            logger.debug("No Discord mention mapping found for digest author %s", name)
    return mentions


def configure_logging() -> None:
    level_name = os.environ.get("DIGEST_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(level=level, format="%(levelname)s %(name)s: %(message)s")


def run(config: DigestConfig) -> Path | None:
    if not config.dry_run:
        fetch_branch(config.branch, repo=config.repository_root)
    commits = collect_commits(config.branch, config.max_commits, repo=config.repository_root)

    mapping: Dict[str, MappingEntry] = {}
    if config.mapping_file:
        try:
            mapping = load_mapping(config.mapping_file)
        except MappingLoadError as exc:
            logger.warning("User mapping unavailable: %s", exc)
    else:
        logger.info("No mapping file configured; user mentions disabled")

    if config.dry_run:
        digest = fallback_digest(commits, branch=config.branch)
    else:
        digestor = GPTDigestor(api_key=config.openai_api_key, model=config.model)
        try:
            digest = digestor.summarize(branch=config.branch, commits=commits)
        except (SummarizationError, Exception) as exc:  # noqa: BLE001 broad fallback by design
            print(f"Summarization fallback engaged: {exc}", file=sys.stderr)
            digest = fallback_digest(commits, branch=config.branch)

    issue_alerts = build_issue_alerts(config, mapping)

    author_mentions = build_author_mentions(digest, mapping)

    markdown = build_markdown(
        config.branch,
        digest,
        commits,
        issue_alerts=issue_alerts,
        author_mentions=author_mentions,
    )
    report_path: Path | None = None
    if not config.dry_run:
        report_path = write_markdown(markdown, config.reports_directory)

    if config.has_discord_transport:
        try:
            post_digest(
                branch=config.branch,
                highlights=digest.overview,
                authors=[author.name for author in digest.authors],
                report_path=str(report_path) if report_path else None,
                issue_alerts=issue_alerts,
                dm_assignees=config.dm_assignees,
                dry_run=config.dry_run,
                author_digests=digest.authors,
                author_mentions=author_mentions,
                webhook_url=config.discord_webhook_url,
                bot_token=config.discord_bot_token,
                channel_id=config.discord_channel_id,
                discord_api_base=config.discord_api_base,
            )
        except DiscordNotificationError as exc:
            if not config.dry_run:
                raise
            print(f"Discord notification skipped due to error: {exc}")

    return report_path


def main() -> int:
    try:
        configure_logging()
        config = load_config()
        run(config)
        return 0
    except GitExecutionError as exc:
        print(f"Git command failed: {exc}", file=sys.stderr)
        return 1
    except DiscordNotificationError as exc:
        print(f"Discord notification failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
