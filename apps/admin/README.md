# Admin

The operator page of one environment, at its admin hostname in `deploy/first/environments.json` (`admin`):
`admin.dev-realms.party` for dev, `admin.realms.party` for production. It reads the environment's launch service and
status-monitor record, sends the launch service's operator actions with the environment's operator token, and logs every
action with the Cloudflare Access identity that sent it. It deploys nothing. The page's Dev/Prod switch opens the other
environment's admin.

| Screen  | Its job                                           | What it calls                                                                                             |
| ------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Games   | See the environment's health and games, start one | status-monitor's `state.json` (R2); launch `GET /api/factory/calendar`, `/api/slots`, `/api/factory/runs` |
| Deploys | Show what runs, and the deploy commands           | launch `GET /api/factory/version` (its published revision), the client's `/sw.js` release, R2 shard list  |
| Audit   | Show who did what                                 | this Worker's D1 `actions`                                                                                |

Actions, all under `/api/actions/`, each logged before it is sent and completed after:

| Action                  | Launch route                                                         | Environments |
| ----------------------- | -------------------------------------------------------------------- | ------------ |
| Free test Blitz         | `POST /api/factory/test-blitz`                                       | dev only     |
| Open a paid Blitz slot  | `POST /api/slots`                                                    | both         |
| Refund a slot           | `POST /api/slots/:name/refund`                                       | both         |
| Set a phase             | `PUT /api/factory/calendar/frontier\|blitz`                          | both         |
| Continue / delete a run | `POST /api/factory/runs/:environment/:name/actions/continue\|delete` | both         |
| Continue a result       | `POST /api/factory/results/:environment/:name/actions/continue`      | both         |

The request and answer types come from `@bibliothecadao/launch-service/operator-api`; the status record's from
`@realms-world/status-monitor/model`.

## Who may use it

Cloudflare Access decides, and the Worker checks again on every API call: the `Cf-Access-Jwt-Assertion` token's RS256
signature against the team's published keys, its issuer, the route's audience and its expiry; the operator's email comes
from it. The lists live in the environment's private directory as `admin-access.json`; `deploy/first` setup makes Access
match them (README step 9):

- `operators` may open the page. On dev they may also act.
- `writers` (production only, each also an operator) alone may act on production. The Worker holds this list and checks
  the verified email on every `/api/actions/` call. One Access application covers the page: its writes are fetches,
  which could not follow a second application's sign-in.

To grant, add the email and rerun setup with `--apply`. To revoke, remove it and rerun: setup also ends that person's
sessions.

## Secrets

Setup installs them as Worker secrets, never in the repo, the page or the browser: `OPERATOR_TOKEN` (the environment's
own, from its private directory), `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and, on production, `ADMIN_WRITERS`. The Worker
refuses every call while one is blank. `deploy:cloudflare` creates nothing for it beyond what setup made: it migrates
its D1 database and publishes it with the other Workers.

## Lab

```sh
node apps/admin/scripts/lab.mjs <directory>   # then serve <directory> with any static server
```

It writes the page as the Worker serves it, with `lab/fixtures.js` answering its API calls from fixtures for either
environment (`?environment=production`).
