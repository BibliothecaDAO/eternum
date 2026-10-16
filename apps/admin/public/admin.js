// The operator page: three screens over the admin Worker's API. It holds no credential; the Access cookie is the only
// thing the browser sends, and every write goes through the Worker, which logs it under the signed-in name.

const SCREENS = { games: "Games", deploys: "Deploys", audit: "Audit" };
const state = { screen: "games", environment: "dev", origin: "" };

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const when = (value) => (value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) : "—");

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  return { ok: response.ok, status: response.status, data };
}

/** A screen part that failed to read shows its reason in place, never an empty table that looks fine. */
const failed = (part, columns) =>
  part.ok ? null : `<tr><td colspan="${columns}" class="error">Could not read: ${esc(part.error)}</td></tr>`;

function renderGames(view) {
  state.origin = view.origin;
  const status = view.status;
  $("#checked").textContent = status.ok ? `checked ${when(status.value.checkedAt * 1000)} UTC` : "";
  $("#status").innerHTML = status.ok
    ? status.value.components
        .map(
          (probe) =>
            `<span class="probe"><span class="dot ${esc(probe.status)}"></span>${esc(probe.name)}` +
            `<small>${probe.latency_ms === null ? esc(probe.status) : `${probe.latency_ms} ms`}</small></span>`,
        )
        .join("")
    : `<span class="error">Status: ${esc(status.error)}</span>`;

  const phases = view.calendar.ok ? view.calendar.value : [];
  $("#calendar").innerHTML =
    failed(view.calendar, 3) ??
    ["frontier", "blitz"]
      .map((name) => {
        const phase = phases.find((entry) => entry.phase === name);
        return `<tr><td>${name === "frontier" ? "Frontier" : "Blitz"}</td><td class="quiet-cell">${
          phase ? `${when(phase.startsAt)} → ${when(phase.endsAt)}` : "Not set"
        }</td><td class="end"><button class="quiet" data-phase="${name}">${phase ? "Edit" : "Set"}</button></td></tr>`;
      })
      .join("");

  $("#slots").innerHTML =
    failed(view.slots, 3) ??
    (view.slots.value.length
      ? view.slots.value
          .map(
            (slot) =>
              `<tr><td>${esc(slot.name)}</td><td><span class="state ${slot.closed ? "complete" : "open"}">${
                slot.closed ? "closed" : slot.frozenAt ? "frozen" : "open"
              }</span></td><td class="end">${
                slot.closed ? "" : `<button class="quiet" data-refund="${esc(slot.name)}">Refund</button>`
              }</td></tr>`,
          )
          .join("")
      : `<tr><td class="quiet-cell">No slots.</td></tr>`);

  $("#runs").innerHTML =
    failed(view.runs, 5) ??
    (view.runs.value.length
      ? view.runs.value
          .map((run) => {
            const kind = run.kind === "result" ? "results" : "runs";
            const actions = [
              run.recovery?.canContinue
                ? `<button class="quiet" data-run="${kind}/${esc(run.environment)}/${esc(run.gameName)}/continue">Continue</button>`
                : "",
              run.kind === "game" && run.status !== "complete" && run.status !== "running"
                ? `<button class="quiet" data-run="runs/${esc(run.environment)}/${esc(run.gameName)}/delete">Delete</button>`
                : "",
            ].join("");
            return `<tr><td>${esc(run.gameName)}${run.kind === "result" ? ' <small class="note">result</small>' : ""}</td><td class="quiet-cell">${esc(
              run.environment.replace("madara.", ""),
            )}</td><td><span class="state ${esc(run.status)}">${esc(run.status)}</span></td><td class="wide">${esc(
              run.artifacts?.gameId ?? "—",
            )}</td><td class="end">${actions}</td></tr>`;
          })
          .join("")
      : `<tr><td class="quiet-cell" colspan="5">No games yet.</td></tr>`);
}

function renderDeploys(view) {
  const row = (label, part, show) =>
    `<tr><td>${label}</td><td>${part.ok ? show(part.value) : `<span class="error">${esc(part.error)}</span>`}</td></tr>`;
  $("#running").innerHTML = [
    row("Workers (launch service)", view.workers, (value) => `<code>${esc(value.revision || value.version)}</code>`),
    row("Client", view.client, (value) => `<code>${esc(value)}</code>`),
    row("Shards", view.shards, (shards) =>
      shards.length
        ? shards
            .map(
              (shard) =>
                `<code>${esc(shard.chainId)}</code> <span class="note">${esc(shard.status)} · ${esc(shard.url)}</span>`,
            )
            .join("<br>")
        : "none listed",
    ),
  ].join("");
  $("#commands").innerHTML = [
    ["Shard box", view.commands.box],
    ["Workers and client", view.commands.cloudflare],
  ]
    .map(([label, command]) => `<div class="command"><b>${label}</b><pre>${esc(command)}</pre></div>`)
    .join("");
}

function renderAudit(view) {
  $("#audit").innerHTML = view.actions.length
    ? view.actions
        .map(
          (action) =>
            `<tr><td>${when(action.at)}</td><td>${esc(action.email)}</td><td>${esc(action.environment)}</td><td>${esc(
              action.action,
            )}</td><td><span class="state ${action.state === "done" && action.status < 400 ? "done" : action.state === "sent" ? "running" : "attention"}">${
              action.state === "done" ? action.status : action.state
            }</span></td></tr>`,
        )
        .join("")
    : `<tr><td class="quiet-cell" colspan="5">Nothing logged yet.</td></tr>`;
}

async function load() {
  const environment = state.environment;
  $("#title").textContent = SCREENS[state.screen];
  $("#env-badge").textContent = environment === "production" ? "Prod" : "Dev";
  $("#env-badge").classList.toggle("production", environment === "production");
  $("#prod-banner").hidden = environment !== "production" || state.screen === "audit";
  const path = state.screen === "audit" ? "/api/audit" : `/api/${environment}/${state.screen}`;
  const { ok, status, data } = await api("GET", path);
  const denied = !ok && status === 403;
  $("#denied").hidden = !denied && ok;
  $("#denied").textContent = denied
    ? environment === "production"
      ? "Production is open to the owner only. The owner adds people to its Access list."
      : `Access refused: ${data.error ?? status}`
    : `Could not load: ${data.error ?? status}`;
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = !ok || panel.dataset.panel !== state.screen;
  });
  if (!ok) return;
  if (state.screen === "games") renderGames(data);
  if (state.screen === "deploys") renderDeploys(data);
  if (state.screen === "audit") renderAudit(data);
  $("[data-kind='test-blitz']").disabled = environment !== "dev";
}

/**
 * One write: its dialog shows the call the Worker will make on the launch service, Send makes it, and the screen
 * reloads from what the service now holds.
 */
function openAction({ title, fields = [], method, route, launchPath, body, note }) {
  $("#action-title").textContent = title;
  $("#action-error").hidden = true;
  $("#action-form").innerHTML =
    fields
      .map(([label, name, value, kind]) =>
        kind === "lines"
          ? `<label>${label}<textarea name="${name}" rows="4">${esc(value)}</textarea></label>`
          : `<label>${label}<input name="${name}" value="${esc(value)}"></label>`,
      )
      .join("") + (note ? `<p class="note">${note}</p>` : "");
  const values = () => Object.fromEntries(new FormData($("#action-form")));
  const preview = () => {
    const payload = body?.(values());
    $("#action-call").textContent =
      `${method} ${state.origin}${launchPath}${payload ? `\n${JSON.stringify(payload, null, 2)}` : ""}`;
  };
  $("#action-form").oninput = preview;
  preview();
  $("#action-send").onclick = async () => {
    const { ok, data } = await api(method, `/api/${state.environment}/${route}`, body?.(values()));
    if (!ok) {
      $("#action-error").textContent = data.error ?? JSON.stringify(data);
      $("#action-error").hidden = false;
      return;
    }
    $("#action-dialog").close();
    load();
  };
  $("#action-dialog").showModal();
}

const lines = (text) => text.split(/\s+/).filter(Boolean);
const NEW_GAME = {
  "test-blitz": () =>
    openAction({
      title: "Free test Blitz",
      fields: [
        ["Name (test-…)", "name", "test-"],
        ["Player accounts, one per line", "players", "", "lines"],
      ],
      method: "POST",
      route: "test-blitz",
      launchPath: "/api/factory/test-blitz",
      body: (v) => ({ name: v.name, players: lines(v.players) }),
      note: "Live five minutes after this is sent. Sending the same name and players again returns the same game.",
    }),
  "open-slot": () =>
    openAction({
      title: "Open a paid Blitz slot",
      fields: [
        ["Slot name (blitz-YYYYMMDD-HHMM)", "name", ""],
        ["Registration closes (UTC, ISO)", "closesAt", ""],
      ],
      method: "POST",
      route: "slots",
      launchPath: "/api/slots",
      body: (v) => ({ name: v.name, closesAt: v.closesAt }),
    }),
  frontier: () => setPhase("frontier"),
};

const setPhase = (phase) =>
  openAction({
    title: `Set the ${phase} phase`,
    fields: [
      ["Starts (UTC, whole second)", "startsAt", ""],
      ["Ends (UTC, whole second)", "endsAt", ""],
    ],
    method: "PUT",
    route: `calendar/${phase}`,
    launchPath: `/api/factory/calendar/${phase}`,
    body: (v) => ({ startsAt: v.startsAt, endsAt: v.endsAt }),
  });

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.screen) {
    state.screen = button.dataset.screen;
    document
      .querySelectorAll("[data-screen]")
      .forEach((place) => place.setAttribute("aria-current", place === button ? "page" : "false"));
    load();
  }
  if (button.dataset.env) {
    state.environment = button.dataset.env;
    document.querySelectorAll("[data-env]").forEach((env) => env.setAttribute("aria-pressed", String(env === button)));
    load();
  }
  if (button.dataset.close !== undefined) button.closest("dialog").close();
  if (button.id === "new-game") $("#kind-dialog").showModal();
  if (button.dataset.kind) {
    $("#kind-dialog").close();
    NEW_GAME[button.dataset.kind]();
  }
  if (button.dataset.phase) setPhase(button.dataset.phase);
  if (button.dataset.refund)
    openAction({
      title: `Refund ${button.dataset.refund}`,
      method: "POST",
      route: `slots/${button.dataset.refund}/refund`,
      launchPath: `/api/slots/${button.dataset.refund}/refund`,
      note: "Turns on ledger refunds for every registered player.",
    });
  if (button.dataset.run) {
    const [kind, environment, name, verb] = button.dataset.run.split("/");
    openAction({
      title: `${verb === "continue" ? "Continue" : "Delete"} ${name}`,
      method: "POST",
      route: `${kind}/${environment}/${name}/${verb}`,
      launchPath: `/api/factory/${kind}/${environment}/${name}/actions/${verb}`,
      note: verb === "delete" ? "Only a run that is not active and not in a paid slot can be deleted." : undefined,
    });
  }
});

(async () => {
  const { ok, data } = await api("GET", "/api/dev/session");
  $("#who").textContent = ok ? data.email : "Not signed in";
  load();
})();
