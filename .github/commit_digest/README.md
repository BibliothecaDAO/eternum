# Commit Digest Tool

This utility builds a daily engineering digest from commits on a target branch, summarizes the work via OpenAI GPT-5,
stores the rendered markdown inside the repo, and optionally notifies a Discord channel.

## Capabilities

- Fetches the latest commits from `origin/<branch>`.
- Collects author metadata, commit messages, and touched files.
- Calls OpenAI GPT-5 (configurable model) to produce a structured summary.
- Writes a markdown report under `.github/commit_digest/reports` with highlights, contributor spotlight, assigned issue
  links, and commit log.
- Sends Discord notifications via webhook or bot token with the day's highlights and contributor list, and can DM
  assigned engineers when a bot token is configured. Bot delivery unlocks richer embeds and author mentions.
- Pings Discord members that have open GitHub issues assigned (via mapping file) and includes issue links in the
  published report.

## Setup

1. Install dependencies (in CI this can run inside a Python step):
   ```bash
   pip install -r .github/commit_digest/requirements.txt
   ```
2. Provide secrets via environment variables:
   - `OPENAI_API_KEY` – API key with access to the selected GPT-5 model.
   - `DISCORD_WEBHOOK_URL` – Discord channel webhook (legacy fallback when a bot token is unavailable).
   - `DISCORD_BOT_TOKEN` / `DISCORD_CHANNEL_ID` – Bot credentials for posting to a channel, enabling direct DMs, and
     unlocking embed formatting with per-author mentions.
   - `DIGEST_GITHUB_TOKEN` / `GITHUB_TOKEN` – GitHub token for issue lookups (required for private repos and recommended
     for rate limits).
3. (Optional) Override defaults:
   - `DIGEST_BRANCH` – branch to monitor (`main` by default).
   - `DIGEST_MAX_COMMITS` – max commits to include (default `20`).
   - `OPENAI_MODEL` – OpenAI model id (default `gpt-5.0-mini`).
   - `DIGEST_OUTPUT_DIR` – custom output directory for markdown reports.
   - `DIGEST_MAPPING_FILE` – path to GitHub→Discord mapping JSON (default `.github/commit_digest/user_mapping.json`).
   - `DIGEST_REPOSITORY` – repository slug (`owner/name`); inferred from `origin` when unset.
   - `DIGEST_GITHUB_API` – override GitHub API base URL if needed.
   - `DIGEST_DM_ASSIGNEES` – set to `false` to skip direct mention follow-ups; `--no-dm-assignees` CLI flag also
     supported.
   - `DIGEST_LOG_LEVEL` – override logging level (`INFO` by default; try `DEBUG` when diagnosing issues).

### Discord ↔ GitHub Mapping

Create a JSON file that maps GitHub usernames to Discord mentions. The file may contain either raw strings or objects
with a `discord` field. Example (`.github/commit_digest/user_mapping.example.json`):

```json
{
  "octocat": "<@1234567890>",
  "alice": { "discord": "<@0987654321>" }
}
```

Save your production mapping as `.github/commit_digest/user_mapping.json` (ignored from commits) or point
`DIGEST_MAPPING_FILE` to the correct path. During runs the tool will look up open issues assigned to each GitHub login,
mention them in Discord, optionally send a dedicated ping, and add a public table of linked issues to the markdown
digest.

The same mapping powers contributor mentions in both the Discord digest embed and the markdown "Contributor Spotlight"
table, so authors are tagged alongside their summaries where possible.

If no mapping file is found or GitHub lookups fail, the digest proceeds without the mention workflow.

## Usage

Run locally from the repository root:

```bash
python .github/commit_digest/__main__.py --branch develop --max-commits 30
```

Use `--dry-run` to skip writing files and hitting external services while still producing output:

```bash
python .github/commit_digest/__main__.py --dry-run
```

Add `--no-dm-assignees` if you want to inspect the issue table without pinging anyone.

### Output

Reports are written to `.github/commit_digest/reports/daily-digest-YYYYMMDD.md`. The Discord notification includes
condensed highlights plus the contributor list, issue mentions, and optional direct follow-up messages to each assignee.

## GitHub Actions Integration

A ready-to-run workflow lives in `.github/workflows/daily-digest.yml`. It triggers daily at 17:00 UTC and on manual
dispatch.

```yaml
name: daily-digest

on:
  schedule:
    - cron: "0 17 * * *"
  workflow_dispatch:

jobs:
  digest:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r .github/commit_digest/requirements.txt
      - name: Generate digest
        run: python .github/commit_digest/__main__.py --branch main
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          DIGEST_GITHUB_TOKEN: ${{ secrets.DIGEST_GITHUB_TOKEN }}
          DIGEST_REPOSITORY: ${{ github.repository }}
```

## Notes

- The tool gracefully falls back to a deterministic summary if the OpenAI call fails or `--dry-run` is supplied.
- Discord webhook failures cause the job to error unless `--dry-run` is active.
- Reports are overwritten when generated multiple times per day unless you override the filename.
- Issue mentions are skipped when the mapping file is absent, malformed, or the GitHub request fails.
- Webhook-only setups still post follow-up mentions in the configured channel; providing bot credentials enables
  direct-message alerts to assignees and richer digest embeds. Dry runs skip all outbound Discord traffic but log that
  they did so.
