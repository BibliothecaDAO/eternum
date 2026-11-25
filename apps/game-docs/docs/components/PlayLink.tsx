import { DASHBOARD_CONFIG } from "../utils/dashboard-data";

const playOrigin = DASHBOARD_CONFIG.identityOrigin;
const playHost = new URL(playOrigin).host;

export function PlayLink() {
  return <a href={playOrigin}>{playHost}</a>;
}
