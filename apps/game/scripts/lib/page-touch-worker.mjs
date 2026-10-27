import { parentPort, workerData } from "node:worker_threads";

import { openPageDevTools, touchAtPhoneWidth } from "../client-playtest/browser-session.mjs";
import { runAgentBrowser } from "../run-renderer-scene-smoke.mjs";

/** page-touch.mjs's connection: opened once, then one touch change per width posted, each answered on `replies`. */
const { session, signal, replies } = workerData;
const answer = (reply) => {
  replies.postMessage(reply);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
};

let devTools = null;
try {
  devTools = await openPageDevTools({ run: (args) => runAgentBrowser(session, args) });
  answer({});
} catch (error) {
  answer({ error: String(error.message ?? error) });
}
parentPort.on("message", (width) =>
  touchAtPhoneWidth(devTools, width).then(
    () => answer({}),
    (error) => answer({ error: String(error.message ?? error) }),
  ),
);
