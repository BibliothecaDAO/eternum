# Admin

One operator page for dev and production, at `ADMIN_HOSTNAME` (`admin.realms.party`). It reads each environment's launch
service and status-monitor record, sends the launch service's operator actions with that environment's operator token,
and logs every action with the Cloudflare Access identity that sent it. It deploys nothing.

| Screen  | Its job                                          | What it calls                                                                                             |
| ------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Games   | See an environment's health and games, start one | status-monitor's `state.json` (R2); launch `GET /api/factory/calendar`, `/api/slots`, `/api/factory/runs` |
| Deploys | Show what runs where, and the deploy commands    | launch `GET /api/factory/version` (its published revision), the client's `/sw.js` release, R2 shard list  |
| Audit   | Show who did what                                | this Worker's D1 `actions`                                                                                |

Actions (each on the environment the page shows, each logged before it is sent and completed after):

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

Cloudflare Access decides, and the Worker checks again on every API call:

- An Access application on `ADMIN_HOSTNAME` whose allow policy is the list of operators. Its audience tag is
  `ACCESS_AUD`.
- A second Access application on the path `ADMIN_HOSTNAME/api/production/*` whose list is the owner alone. Its audience
  tag is `ACCESS_PRODUCTION_AUD`. Production screens and actions answer 403 to anyone else.
- `ACCESS_TEAM_DOMAIN` is the team's `<team>.cloudflareaccess.com`.

The Worker verifies the `Cf-Access-Jwt-Assertion` token's RS256 signature against the team's published keys, its issuer,
the route's audience and its expiry, and takes the operator's email from it. To grant access, add the email to the list.
To revoke it, remove the email and revoke the user's sessions in Zero Trust → Users.

## Secrets

Only the two operator tokens, as Worker secrets, never in the repo, the page or the browser:

```sh
pnpm --dir apps/admin exec wrangler secret put OPERATOR_TOKEN_DEV --env production
pnpm --dir apps/admin exec wrangler secret put OPERATOR_TOKEN_PRODUCTION --env production
```

The Worker refuses every call while any setting is blank. Deploy credentials stay on the owner's machine; the Deploys
screen shows the commands to run there.

## Lab

```sh
node apps/admin/scripts/lab.mjs <directory>   # then serve <directory> with any static server
```

It writes the page as the Worker serves it, with `lab/fixtures.js` answering its API calls from fixtures.

## Not done yet

Nothing creates the Access applications, the D1 database `realms-admin`, or the Worker. This app is not in
`deploy/first/platform.ts`, so no deploy publishes it.
