# Installation and update delivery

Install Realms is available on landing pages and in game Settings. The app-root listener saves Chrome's
`beforeinstallprompt` event until the player clicks the control. Browsers without that event get installation
instructions, including Safari's Share/Add to Home Screen and File/Add to Dock flows. The control hides in standalone
mode and after `appinstalled`. Installation does not request notification permission or activate a waiting worker.

The manifest, worker, offline document and icons are generated/verified by the production build. Service-worker
registration is production-only; a Vite development server is not a complete installation test.

## Cache policy

`public/_headers` asks browsers to revalidate the worker, manifest and offline document. The custom domain also passes
through the `realms.party` Cloudflare zone, which can override those headers. The September 2026 audit found `no-cache`
for `eternum-game.pages.dev/sw.js` but `max-age=14400` for the same file on `play.realms.party`.

Before publishing, `ensure-pwa-cache-rule.mjs` maintains one named Cache Rule for exactly that hostname and `/sw.js`,
`/manifest.webmanifest`, `/offline.html`. It sets both browser and edge TTL modes to `respect_origin` and puts the rule
after broader overrides. It uses individual-rule POST/PATCH operations and never replaces the zone's ruleset. An
already-correct rule causes no mutation. Other assets and hostnames retain their existing cache policies.

The deployment's `CLOUDFLARE_API_TOKEN` must retain Pages deployment access and also have Zone Read and Cache Rules Edit
access for `realms.party`. Missing or insufficient permissions stop the workflow before publication. Configure that
access before merging this deployment change. The script resolves the zone by its exact name; no zone-wide Browser Cache
TTL setting is changed. See Cloudflare's
[Cache Rules API](https://developers.cloudflare.com/cache/how-to/cache-rules/create-api/) and
[TTL settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/).

After publication, `verify-client-deployment.mjs` checks the public worker, manifest and offline document for correct
bytes, MIME type and browser revalidation headers, alongside the existing module/HTML checks. A four-hour worker cache
policy can no longer pass the deployment gate. This verification uses HTTP requests and does not restore the retired
browser lifecycle runner.
