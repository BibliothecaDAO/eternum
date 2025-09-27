from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

import requests


@dataclass
class Issue:
    number: int
    title: str
    url: str


@dataclass
class IssueAlert:
    github_login: str
    discord_mention: str
    issues: List[Issue]

    def summary_line(self) -> str:
        issue_snippets = ", ".join(f"#{issue.number}" for issue in self.issues[:5])
        return f"{self.discord_mention} has {len(self.issues)} open issue(s): {issue_snippets}" if issue_snippets else f"{self.discord_mention} has {len(self.issues)} open issue(s)."


class GitHubIssueError(RuntimeError):
    pass


def fetch_open_issues(
    *,
    repository_slug: Optional[str],
    github_api_base: str,
    assignees: Iterable[str],
    token: Optional[str] = None,
) -> Dict[str, List[Issue]]:
    if not repository_slug:
        return {}

    base = github_api_base.rstrip("/")
    endpoint = f"{base}/repos/{repository_slug}/issues"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "commit-digest-bot",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    assignments: Dict[str, List[Issue]] = {}
    for assignee in assignees:
        login = assignee.lower()
        params = {"state": "open", "assignee": login, "per_page": "100"}
        response = requests.get(endpoint, headers=headers, params=params, timeout=30)
        if response.status_code >= 400:
            raise GitHubIssueError(
                f"GitHub API returned {response.status_code} for {repository_slug} assignee {assignee}: {response.text}"
            )
        data = response.json()
        user_issues = [
            Issue(number=item["number"], title=item.get("title", ""), url=item.get("html_url", ""))
            for item in data
            if item.get("assignee") and item["assignee"].get("login", "").lower() == login
        ]
        if user_issues:
            assignments[login] = user_issues
    return assignments


__all__ = ["Issue", "IssueAlert", "fetch_open_issues", "GitHubIssueError"]
