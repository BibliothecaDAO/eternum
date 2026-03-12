to run and develop(READ THE COMMON ISSUES AT BOTTOM TOO):

from repo root `pnpm i`

```bash
pnpm build:packages
pnpm --dir packages/client build
pnpm --dir packages/game-agent build
cd client/apps/onchain-agent
cp .env.example .env #update the world name and add your api key
pnpm dev
```

Variables: `.env` in the `client/apps/onchain-agent directory`, `cp .env.example .env`

add your `ANTHROPIC_API_KEY`

Mine looks exactly like this when testing:

```bash
CHAIN=slot
MODEL_ID=claude-haiku-4-5-20251001
ANTHROPIC_API_KEY=
WORLD_NAME=xbt5
```

When running, the `.axis` directory will be created from your machine's home directory. The `.axis` data structure looks
like this, and follows this format automatically according to the `WORLD_NAME` that you pass into your env:

```bash
~/.axis ❯ tree -L 5 -all
.
└── worlds
    └── 0x03b060cd79fc792c601bc83648c56958c8c69e5f96511880dcf2ddbf48907688
        ├── .cartridge
        │   └── session.json
        ├── automation-status.txt
        ├── map.txt
        ├── soul.md
        └── tasks
            ├── combat.md
            ├── economy.md
            ├── exploration.md
            ├── priorities.md
            └── reflection.md

5 directories, 9 files
```

**README - COMMON ISSUES:**

1. the URL is annoyingly long and sometimes is displayed with a linebreak in it. My flow is copy it, google "whitespace
   remover", paste url > remove whitespace.
2. Paste the URL in an incognito tab. and do your login stuff from there. If you want to watch the agent from the game
   client, clear all cookies and data or spectate from an incognito tab. Session stuff is finnicky.
3. If you are restarting an agent previously run on the world, give it 1 full tick to catch up (60 seconds).
