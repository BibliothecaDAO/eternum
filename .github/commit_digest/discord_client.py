from __future__ import annotations

import logging
import re
from typing import Iterable, Optional, Sequence

import requests

try:
    from .issues import IssueAlert
    from .summary import AuthorDigest
except ImportError:  # pragma: no cover
    from issues import IssueAlert  # type: ignore
    from summary import AuthorDigest  # type: ignore


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


logger = logging.getLogger(__name__)


def _post_webhook_message(webhook_url: str, payload: dict) -> None:
    logger.info("Posting digest via Discord webhook")
    response = requests.post(webhook_url, json=payload, timeout=30)
    if response.status_code >= 400:
        raise DiscordNotificationError(
            f"Discord webhook failed with {response.status_code}: {response.text}"
        )
    logger.debug("Discord webhook post succeeded")


def _bot_headers(bot_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bot {bot_token}",
    }


def _post_bot_channel_message(
    *,
    bot_token: str,
    channel_id: str,
    api_base: str,
    payload: dict,
) -> None:
    endpoint = f"{api_base.rstrip('/')}/channels/{channel_id}/messages"
    logger.info("Posting digest to Discord channel %s via bot token", channel_id)
    response = requests.post(endpoint, headers=_bot_headers(bot_token), json=payload, timeout=30)
    if response.status_code >= 400:
        raise DiscordNotificationError(
            f"Discord channel message failed with {response.status_code}: {response.text}"
        )
    logger.debug("Discord channel post succeeded")


def _extract_user_id(mention: str) -> Optional[str]:
    match = re.search(r"<@!?(\d+)>", mention)
    if not match:
        return None
    return match.group(1)


def _create_dm_channel(*, bot_token: str, user_id: str, api_base: str) -> str:
    endpoint = f"{api_base.rstrip('/')}/users/@me/channels"
    logger.info("Opening DM channel with Discord user %s", user_id)
    response = requests.post(
        endpoint,
        headers=_bot_headers(bot_token),
        json={"recipient_id": user_id},
        timeout=30,
    )
    if response.status_code >= 400:
        raise DiscordNotificationError(
            f"Discord DM channel creation failed with {response.status_code}: {response.text}"
        )

    try:
        channel_id = response.json().get("id")
    except ValueError as exc:  # pragma: no cover - defensive
        raise DiscordNotificationError("Discord DM channel creation returned invalid JSON") from exc

    if not channel_id:
        raise DiscordNotificationError("Discord DM channel creation did not return a channel id")
    logger.debug("Discord DM channel %s ready", channel_id)
    return channel_id


def _post_bot_dm(*, bot_token: str, user_id: str, api_base: str, payload: dict) -> None:
    channel_id = _create_dm_channel(bot_token=bot_token, user_id=user_id, api_base=api_base)
    _post_bot_channel_message(
        bot_token=bot_token,
        channel_id=channel_id,
        api_base=api_base,
        payload=payload,
    )


def post_digest(
    *,
    branch: str,
    highlights: Iterable[str],
    authors: Iterable[str],
    report_path: Optional[str] = None,
    issue_alerts: Optional[Sequence[IssueAlert]] = None,
    dm_assignees: bool = False,
    dry_run: bool = False,
    author_digests: Optional[Sequence[AuthorDigest]] = None,
    author_mentions: Optional[dict[str, str]] = None,
    webhook_url: Optional[str] = None,
    bot_token: Optional[str] = None,
    channel_id: Optional[str] = None,
    discord_api_base: str = "https://discord.com/api/v10",
) -> None:
    if dry_run:
        logger.info("Dry run enabled; skipping Discord notifications")
        return

    if not webhook_url and not (bot_token and channel_id):
        raise DiscordNotificationError("No Discord transport configured for digest notification")

    highlight_lines = "\n".join(f"• {item}" for item in highlights)

    author_labels: list[str] = []
    for author in authors:
        mention = (author_mentions or {}).get(author)
        if mention:
            author_labels.append(f"{author} {mention}")
        else:
            author_labels.append(author)
    authors_line = ", ".join(author_labels) or "(no authors detected)"

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

    fields: list[dict[str, object]] = []
    if author_digests:
        for author in author_digests:
            name = author.name
            if not name:
                continue
            mention = (author_mentions or {}).get(name)
            field_name = f"{name} {mention}" if mention else name
            value_parts: list[str] = []
            if author.summary:
                value_parts.append(author.summary)
            if author.commits:
                commit_preview = author.commits[:5]
                value_parts.append("\n".join(f"• {commit}" for commit in commit_preview))
            value = "\n".join(value_parts).strip() or "—"
            fields.append({"name": field_name[:256], "value": value[:1024], "inline": False})
            if len(fields) >= 10:
                logger.debug("Author field limit reached; truncating additional contributors")
                break
    if fields:
        payload["embeds"][0]["fields"] = fields

    if bot_token and channel_id:
        _post_bot_channel_message(
            bot_token=bot_token,
            channel_id=channel_id,
            api_base=discord_api_base,
            payload=payload,
        )
    elif webhook_url:
        _post_webhook_message(webhook_url, payload)
    else:  # pragma: no cover - defensive fallback
        raise DiscordNotificationError("No Discord transport configured for digest notification")

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
            if bot_token:
                user_id = _extract_user_id(alert.discord_mention)
                if user_id:
                    logger.info(
                        "Sending Discord DM to %s (%s) about %d issue(s)",
                        alert.github_login,
                        user_id,
                        len(alert.issues),
                    )
                    _post_bot_dm(
                        bot_token=bot_token,
                        user_id=user_id,
                        api_base=discord_api_base,
                        payload=dm_payload,
                    )
                    continue
                logger.info(
                    "Discord mention for %s lacked a resolvable user id; falling back to channel ping",
                    alert.github_login,
                )

            if webhook_url:
                logger.info(
                    "Sending follow-up mention for %s via webhook in channel", alert.github_login
                )
                _post_webhook_message(webhook_url, dm_payload)
            elif bot_token and channel_id:
                logger.info(
                    "Sending follow-up mention for %s to channel %s via bot token",
                    alert.github_login,
                    channel_id,
                )
                _post_bot_channel_message(
                    bot_token=bot_token,
                    channel_id=channel_id,
                    api_base=discord_api_base,
                    payload=dm_payload,
                )
            else:  # pragma: no cover - defensive fallback
                raise DiscordNotificationError("Unable to deliver Discord alert; no transport available")
    elif dm_assignees:
        logger.info("Issue alerts empty; no Discord DMs or follow-up mentions to send")


__all__ = ["post_digest", "DiscordNotificationError"]
