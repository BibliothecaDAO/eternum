/**
 * What a player's action put on screen, marked once the frame that draws it has been rendered: a scene queues the result
 * as it changes what it draws, and the frame loop marks every queued result (`presented:<result>`) right after its next
 * render. The playtest times each action from its press to this mark (click-to-result).
 */
let queued: string[] = [];

/** Queues `result` ("explore:<col>,<row>", "walk:<army>", "building:<col>,<row>:<category>") for the next rendered frame. */
export const presentResult = (result: string): void => {
  queued.push(result);
};

/** Marks every queued result: called by the frame loop once a frame has been rendered. */
export const markPresentedResults = (): void => {
  if (queued.length === 0) return;
  const rendered = queued;
  queued = [];
  for (const result of rendered) performance.mark(`presented:${result}`);
};
