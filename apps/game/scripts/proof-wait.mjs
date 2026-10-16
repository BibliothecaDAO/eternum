export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `js` in the page until it holds or the time runs out; whether it held. */
export const waitFor = async (b, js, timeoutMs) => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if ((await b.evaluate(`Boolean(${js})`)) === true) return true;
    await sleep(300);
  }
  return false;
};
