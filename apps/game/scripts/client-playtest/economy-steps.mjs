import { completed, failed } from "./evidence.mjs";

const PRODUCTION = '[data-kit-frame][aria-label="Production"]';
const TRANSFER = '[data-kit-frame][aria-label="Transfer"]';

/** The existing production and delivery windows, driven through their controls and checked against their recorded commands and replies. */
export const ECONOMY_STEPS = [
  {
    name: "produce-knights",
    settleMs: 500,
    play: async ({ browser, owner }) => {
      browser.click("Production");
      await until(owner, () => browser.read(`Boolean(document.querySelector('${PRODUCTION}'))`));
      if (browser.read(`Boolean([...document.querySelectorAll('${PRODUCTION} [role="tab"]')].find(tab => tab.textContent.includes('Manual Production')))`))
        browser.run(["find", "role", "tab", "click", "--name", "Manual Production"]);
      await until(owner, () => browser.read(`Boolean(document.querySelector('${PRODUCTION} button[aria-label^="Knight"]'))`));
      browser.run(["click", `${PRODUCTION} button[aria-label^="Knight"]`]);
      await until(owner, () => browser.read(`Boolean(document.querySelector('${PRODUCTION} input[aria-label^="Amount of Knight"]'))`));
      browser.run(["fill", `${PRODUCTION} input[aria-label^="Amount of Knight"]`, "30"]);
      const preview = textOf(browser, PRODUCTION);
      browser.click("Start Production");
      const sent = await until(owner, () => command(browser, "BurnResourceForResourceProduction"));
      return { preview, sent, shown: textOf(browser, PRODUCTION) };
    },
    verify: ({ played }) => {
      const payload = played.sent?.command.calldata.slice(4).map(String);
      const production = fact(played.sent, "ResourceProduction");
      const wheat = facts(played.sent, "ResourceBalance").find((row) => Number(row.resource_type) === 35);
      return payload?.slice(1).join(",") === "7,1,26,1,3" &&
        production?.output_amount_left === "30000000000" && wheat?.balance === "994000000000" &&
        /30/.test(played.preview) && /Wheat/.test(played.preview) && /Start Production/.test(played.shown)
        ? completed({ cycles: 3, output: 30, wheatSpent: 6 })
        : failed("production must submit three cycles, queue thirty knights and spend six wheat", played);
    },
  },
  {
    name: "send-wheat-and-read-arrival",
    settleMs: 500,
    play: async ({ browser, owner }) => {
      browser.run(["click", `${PRODUCTION} button[aria-label="Close"]`]);
      browser.click("Transfer");
      await until(owner, () => browser.read(`Boolean(document.querySelector('${TRANSFER} section[aria-label="Send to"] [role="tabpanel"] button'))`));
      browser.run(["click", `${TRANSFER} section[aria-label="Send to"] [role="tabpanel"] button`]);
      browser.run(["fill", `${TRANSFER} input[aria-label="Wheat: total to send"]`, "50"]);
      const preview = textOf(browser, TRANSFER);
      browser.run(["find", "role", "button", "click", "--name", "Send 50 goods"]);
      const sent = await until(owner, () => command(browser, "SendResources"));
      browser.run(["find", "role", "tab", "click", "--name", "Arrivals"]);
      const shown = await until(owner, () => {
        const text = textOf(browser, `${TRANSFER} [role="tabpanel"][aria-label="arrivals"]`);
        return /50/.test(text) && /Wheat/.test(text) ? text : null;
      });
      return { preview, sent, shown };
    },
    verify: ({ played }) => {
      const payload = played.sent?.command.calldata.slice(4).map(String);
      const arrival = fact(played.sent, "ResourceArrival");
      const wheat = facts(played.sent, "ResourceBalance").find((row) => Number(row.resource_type) === 35);
      return payload?.slice(1).join(",") === "7,8,1,35,50000000000" &&
        String(arrival?.entity_id) === "8" && arrival?.resources[0]?.amount === "50000000000" &&
        wheat?.balance === "944000000000" && /50/.test(played.shown) && /Wheat/.test(played.shown)
        ? completed({ from: 7, to: 8, wheat: 50, arrival })
        : failed("transfer must spend fifty wheat and show its delivery to the second realm", played);
    },
  },
];

const facts = (sent, model) => sent?.answered?.filter((row) => row.model === model).map((row) => row.value) ?? [];
const fact = (sent, model) => facts(sent, model)[0];
const command = (browser, kind) => browser.read(`window.__labChain?.sent.find(row => row.command.kind === ${JSON.stringify(kind)}) ?? null`);
const textOf = (browser, selector) => browser.read(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`);

async function until(owner, read) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const value = read();
    if (value) return value;
    await owner.sleep(500);
  }
  throw new Error("The economy interaction did not reach its visible result within thirty seconds");
}
