from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Sequence

try:
    from openai import OpenAI  # type: ignore
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore

try:
    from .git_utils import Commit
except ImportError:  # pragma: no cover - fallback for script execution
    from git_utils import Commit  # type: ignore


SUMMARY_INSTRUCTIONS = """
You are an assistant that prepares daily engineering digests for stakeholders.
Analyze the commit list and produce a JSON object with the following shape:
{
  "overview": ["concise bullet point", ...],   // 2-5 items highlighting outcomes and shipped value
  "authors": [
    {
      "name": "Author Name",
      "summary": "2-3 sentence description of their work impact.",
      "commits": ["short_sha – human friendly commit title", ...]
    }
  ],
  "callouts": ["optional risks, blockers, follow-ups"] // omit when none
}
Guidelines:
- Focus on impact and user-facing outcomes rather than implementation steps.
- If multiple authors contributed the same initiative, reflect collaboration in summaries.
- Mention testing or verification effort when explicitly referenced.
- Keep tone professional and informative.
- Return ONLY valid JSON. Do not include markdown or prose outside of the JSON object.
"""


@dataclass
class AuthorDigest:
    name: str
    summary: str
    commits: List[str]


@dataclass
class ModelDigest:
    overview: List[str]
    authors: List[AuthorDigest]
    callouts: List[str]


class SummarizationError(RuntimeError):
    pass


class GPTDigestor:
    def __init__(self, api_key: str, model: str) -> None:
        if OpenAI is None:
            raise ImportError(
                "The 'openai' package is required. Install dependencies from requirements.txt."
            )
        self._client = OpenAI(api_key=api_key)
        self._model = model

    def summarize(self, *, branch: str, commits: Sequence[Commit]) -> ModelDigest:
        commit_payload = self._serialize_commits(commits)
        response = self._client.responses.create(
            model=self._model,
            temperature=0.2,
            top_p=0.9,
            input=[
                {
                    "role": "system",
                    "content": SUMMARY_INSTRUCTIONS.strip(),
                },
                {
                    "role": "user",
                    "content": self._build_user_prompt(branch=branch, commits_json=commit_payload),
                },
            ],
        )
        content = response.output_text.strip()
        return self._parse_response(content)

    @staticmethod
    def _build_user_prompt(*, branch: str, commits_json: str) -> str:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        return (
            f"Repository branch: {branch}\n"
            f"Reporting window ending: {today}\n"
            "Commit data (JSON array):\n"
            f"{commits_json}"
        )

    @staticmethod
    def _serialize_commits(commits: Sequence[Commit]) -> str:
        payload = [
            {
                "sha": commit.sha,
                "short_sha": commit.short_sha,
                "author": commit.author,
                "email": commit.author_email,
                "timestamp": commit.authored_at.isoformat(),
                "title": commit.title,
                "body": commit.body,
                "files": commit.files[:25],
            }
            for commit in commits
        ]
        return json.dumps(payload, indent=2)

    @staticmethod
    def _parse_response(raw: str) -> ModelDigest:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SummarizationError("Unable to parse OpenAI response as JSON") from exc

        overview = [item.strip() for item in payload.get("overview", []) if item.strip()]
        author_entries = payload.get("authors", [])
        authors: List[AuthorDigest] = []
        for entry in author_entries:
            name = entry.get("name", "Unknown")
            summary = entry.get("summary", "")
            commits = entry.get("commits", [])
            authors.append(AuthorDigest(name=name, summary=summary.strip(), commits=list(commits)))

        callouts = [item.strip() for item in payload.get("callouts", []) if item.strip()]
        return ModelDigest(overview=overview, authors=authors, callouts=callouts)


def fallback_digest(commits: Iterable[Commit], *, branch: str) -> ModelDigest:
    """Produce a deterministic digest when the model call fails."""
    sorted_commits = sorted(commits, key=lambda commit: commit.authored_at)
    overview = [
        f"{len(sorted_commits)} commits landed on {branch}.",
        "Authors: " + ", ".join(sorted({commit.author for commit in sorted_commits})) if sorted_commits else "No commits in window.",
    ]
    authors: List[AuthorDigest] = []
    for author in sorted({commit.author for commit in sorted_commits}):
        authored_commits = [commit for commit in sorted_commits if commit.author == author]
        flattened = [f"{commit.short_sha} – {commit.title}" for commit in authored_commits]
        authors.append(
            AuthorDigest(
                name=author,
                summary="; ".join(flattened[:3]) or "Commit activity recorded.",
                commits=flattened,
            )
        )
    return ModelDigest(overview=overview, authors=authors, callouts=[])


__all__ = [
    "GPTDigestor",
    "ModelDigest",
    "AuthorDigest",
    "SummarizationError",
    "fallback_digest",
]
