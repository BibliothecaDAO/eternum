/** The mounted desktop HUD and game canvas, on the map rather than a realm. */
export function frontierChestRouteReady() {
  return (
    location.pathname.endsWith("/map") &&
    Boolean(document.querySelector("#main-canvas")) &&
    Boolean(document.querySelector("[data-hud-rail]"))
  );
}
