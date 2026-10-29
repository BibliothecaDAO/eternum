/**
 * What a player's action put on screen, marked once the frame that draws it has been rendered: a scene queues the result
 * as it changes what it draws, and the frame loop marks every queued result (`presented:<result>`) right after its next
 * render. The playtest times each action from its press to this mark (click-to-result).
 */
let queued: string[] = [];

/**
 * Queues `result` for the next rendered frame: "explore:<col>,<row>", "walk:<army>", "army-shown:<army>" (an army of
 * the player's drawn on the map: deployed, or come into view), "army-gone:<army>" (an army of the player's leaves the
 * map: merged, fallen), "site-gone:<col>,<row>" (a Shrine or Well used up), "building:<col>,<row>:<category>",
 * "building-gone:<col>,<row>" (a building demolished off its plot), "chest-opened:<col>,<row>" (a chest consumed off
 * its tile).
 */
export const presentResult = (result: string): void => {
  queued.push(result);
};

/**
 * Marks a result the renderer has already drawn under a cover the page takes away: "entered" (the game's scene, drawn
 * under the doorway while the game boots; a season entered, resumed or watched). Called as the cover leaves, it marks
 * the start of the frame after the next: the next frame paints what the canvas holds without the cover, and the one
 * after it starts once that paint is done, however long the first took (a phone's first map frame takes 300 ms).
 */
export const presentUncovered = (result: string): void => {
  requestAnimationFrame(() =>
    requestAnimationFrame((paintedBy) => performance.mark(`presented:${result}`, { startTime: paintedBy })),
  );
};

/** Marks every queued result: called by the frame loop once a frame has been rendered. */
export const markPresentedResults = (): void => {
  if (queued.length === 0) return;
  const rendered = queued;
  queued = [];
  for (const result of rendered) performance.mark(`presented:${result}`);
};
