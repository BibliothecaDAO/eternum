/**
 * The agent-browser every script runs, at one version. Unpinned, npx fetches the newest on each run, and a release can
 * change how the browser launches overnight: 0.42.0 started relaunching on settings 0.41.2 let pass.
 */
export const AGENT_BROWSER = "agent-browser@0.42.0";
