from __future__ import annotations

import json
from typing import Iterable, Optional, Sequence

import requests

try:
    from .issues import IssueAlert
except ImportError:  # pragma: no cover
    from issues import IssueAlert  # type: ignore


class DiscordNotificationError(RuntimeError):
    pass


def _build_issue_lines(issue_alerts: Sequence[IssueAlert]) -> list[str]:
    lines: list[str] = []
    for alert in issue_alerts:
        issue_links = ", ".join(
            f"[#{issue.number}]({issue.url})" if issue.url else f"#{issue.number}"
            for issue in alert.issues[:5]
        )
        if not issue_links:
            issue_links = "(no linked issues)"
        lines.append(f"{alert.discord_mention} • {issue_links}")
    return lines


def post_digest(
    webhook_url: str,
    *,
    branch: str,
    highlights: Iterable[str],
    authors: Iterable[str],
    report_path: Optional[str] = None,
    issue_alerts: Optional[Sequence[IssueAlert]] = None,
    dm_assignees: bool = False,
    dry_run: bool = False,
) -> None:
    if dry_run:
        return

    highlight_lines = "\n".join(f"• {item}" for item in highlights)
    authors_line = ", ".join(authors) or "(no authors detected)"

    description_lines = [highlight_lines] if highlight_lines else []
    description_lines.append(f"Contributors: {authors_line}")
    if report_path:
        description_lines.append(f"Report: {report_path}")

    if issue_alerts:
        formatted = "\n".join(f"• {line}" for line in _build_issue_lines(issue_alerts))
        if formatted:
            description_lines.append("Issues awaiting attention:\n" + formatted)

    description = "\n".join([line for line in description_lines if line])

    base_content = f"Daily update for `{branch}`"
    if issue_alerts:
        mentions = " ".join(alert.discord_mention for alert in issue_alerts)
        if mentions:
            base_content = f"{base_content} {mentions}"

    payload = {
        "username": "Eternum CI Digest",
        "content": base_content,
        "allowed_mentions": {"parse": ["users"]},
        "embeds": [
            {
                "title": "Daily Engineering Digest",
                "description": description,
                "color": 0x5865F2,
            }
        ],
    }

    response = requests.post(
        webhook_url,
        data=json.dumps(payload),
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    if response.status_code >= 400:
        raise DiscordNotificationError(
            f"Discord webhook failed with {response.status_code}: {response.text}"
        )

    if dm_assignees and issue_alerts:
        for alert in issue_alerts:
            issue_links = " ".join(
                f"[#{issue.number}]({issue.url})" if issue.url else f"#{issue.number}"
                for issue in alert.issues[:5]
            )
            dm_message = (
                f"{alert.discord_mention} heads up! You have {len(alert.issues)} open issue(s). "
                f"Focus: {issue_links}"
            ).strip()
            dm_payload = {
                "username": "Eternum CI Digest",
                "content": dm_message,
                "allowed_mentions": {"parse": ["users"]},
            }
            dm_response = requests.post(
                webhook_url,
                data=json.dumps(dm_payload),
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            if dm_response.status_code >= 400:
                raise DiscordNotificationError(
                    f"Discord DM via webhook failed with {dm_response.status_code}: {dm_response.text}"
                )


__all__ = ["post_digest", "DiscordNotificationError"]
