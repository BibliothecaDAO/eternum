# Taskmarket bounties

Open briefs for work we pay for on [Taskmarket](https://taskmarket.dev). Each folder is one bounty. Its `BRIEF.md` is
what entrants read, its `TASK.txt` is the task's description, and its kit lives beside it or in the game's own assets,
never copied. [FRONTIER.md](FRONTIER.md) is the primer the Frontier bounties share.

| Bounty                                   | Asks for                                | Reward          | Open for |
| ---------------------------------------- | --------------------------------------- | --------------- | -------- |
| [frontier-cinematic](frontier-cinematic) | A 15 s cinematic made with video models | 100 OUSD, Tempo | 5 days   |

## Posting one

Everything about these bounties is public, because running them in the open is part of the marketing: the task, its
brief and kit, and every entry from the moment it is submitted. Each is a `bounty`-mode task on Tempo, paid in OUSD,
posted with public task and submission visibility. Entries stay different because distinctiveness is judged against the
entries posted before.

Tempo needs Taskmarket CLI 1.35 or later. Fund the wallet with the reward plus a little for fees; from Base USDC,
`taskmarket --network tempo deposit --relay-route base-usdc-to-tempo-ousd --amount <n>` gives a deposit address.

Pin the link to the commit the brief landed in, so the brief an entrant reads cannot change under them:

```sh
ref=$(git rev-parse origin/next)

taskmarket --network tempo task create --mode bounty --reward 100 --duration 120 \
  --task-visibility public --submission-visibility public \
  --tags realms,frontier,marketing,cinematic,video,ai-video \
  --description "$(sed "s/{REF}/$ref/" docs/taskmarket/frontier-cinematic/TASK.txt)"
```

## Judging and paying

```sh
taskmarket --network tempo task submissions <taskId>
taskmarket --network tempo task download <taskId>
node docs/taskmarket/frontier-cinematic/check.mjs <film.mp4>   # the cinematic's gate

taskmarket --network tempo task accept-submissions <taskId> \
  --winner <first>:5000 --winner <second>:3000 --winner <third>:2000
```

Reject spam with `task reject-submission`. With fewer than three good entries, split the shares among those there are.
