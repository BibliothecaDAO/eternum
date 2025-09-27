from __future__ import annotations

import sys
from pathlib import Path
from typing import List

if __package__ in (None, ""):
    PACKAGE_ROOT = Path(__file__).resolve().parent
    if str(PACKAGE_ROOT) not in sys.path:
        sys.path.insert(0, str(PACKAGE_ROOT))
    from config import DigestConfig, load_config  # type: ignore  # noqa: E402
    from discord_client import DiscordNotificationError, post_digest  # type: ignore  # noqa: E402
    from git_utils import GitExecutionError, collect_commits, fetch_branch  # type: ignore  # noqa: E402
    from issues import GitHubIssueError, IssueAlert, fetch_open_issues  # type: ignore  # noqa: E402
    from markdown_builder import build_markdown, write_markdown  # type: ignore  # noqa: E402
    from summary import GPTDigestor, SummarizationError, fallback_digest  # type: ignore  # noqa: E402
    from user_mapping import MappingLoadError, load_mapping  # type: ignore  # noqa: E402
else:
    from .config import DigestConfig, load_config
    from .discord_client import DiscordNotificationError, post_digest
    from .git_utils import GitExecutionError, collect_commits, fetch_branch
    from .issues import GitHubIssueError, IssueAlert, fetch_open_issues
    from .markdown_builder import build_markdown, write_markdown
    from .summary import GPTDigestor, SummarizationError, fallback_digest
    from .user_mapping import MappingLoadError, load_mapping


def build_issue_alerts(config: DigestConfig) -> List[IssueAlert]:
    if config.dry_run or not config.mapping_file:
        return []

    try:
        mapping = load_mapping(config.mapping_file)
    except MappingLoadError as exc:
        print(f"Skipping issue mapping due to error: {exc}", file=sys.stderr)
        return []

    if not mapping:
        return []

    try:
        assignments = fetch_open_issues(
            repository_slug=config.repository_slug,
            github_api_base=config.github_api_base,
            assignees=mapping.keys(),
            token=config.github_token,
        )
    except GitHubIssueError as exc:
        print(f"GitHub issue lookup failed: {exc}", file=sys.stderr)
        return []

    alerts: List[IssueAlert] = []
    for login, issues in assignments.items():
        discord_mention = mapping.get(login)
        if not discord_mention:
            continue
        alerts.append(IssueAlert(github_login=login, discord_mention=discord_mention, issues=issues))
    return alerts


def run(config: DigestConfig) -> Path | None:
    if not config.dry_run:
        fetch_branch(config.branch, repo=config.repository_root)
    commits = collect_commits(config.branch, config.max_commits, repo=config.repository_root)

    if config.dry_run:
        digest = fallback_digest(commits, branch=config.branch)
    else:
        digestor = GPTDigestor(api_key=config.openai_api_key, model=config.model)
        try:
            digest = digestor.summarize(branch=config.branch, commits=commits)
        except (SummarizationError, Exception) as exc:  # noqa: BLE001 broad fallback by design
            print(f"Summarization fallback engaged: {exc}", file=sys.stderr)
            digest = fallback_digest(commits, branch=config.branch)

    issue_alerts = build_issue_alerts(config)

    markdown = build_markdown(config.branch, digest, commits, issue_alerts=issue_alerts)
    report_path: Path | None = None
    if not config.dry_run:
        report_path = write_markdown(markdown, config.reports_directory)

    if config.discord_webhook_url:
        try:
            post_digest(
                config.discord_webhook_url,
                branch=config.branch,
                highlights=digest.overview,
                authors=[author.name for author in digest.authors],
                report_path=str(report_path) if report_path else None,
                issue_alerts=issue_alerts,
                dm_assignees=config.dm_assignees,
                dry_run=config.dry_run,
            )
        except DiscordNotificationError as exc:
            if not config.dry_run:
                raise
            print(f"Discord webhook skipped due to error: {exc}")

    return report_path


def main() -> int:
    try:
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
