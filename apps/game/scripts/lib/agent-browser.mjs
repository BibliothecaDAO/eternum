/**
 * The agent-browser every script runs, at one version: spawn it as `npx -y ${AGENT_BROWSER}`. Unpinned, npx fetches
 * the newest on each run, and a release can change how the browser launches overnight (0.42.0, 10 November, turned the
 * terrain gallery's captures blank). lint-guards refuses an agent-browser spawned any other way.
 */
export const AGENT_BROWSER = "agent-browser@0.41.2";
