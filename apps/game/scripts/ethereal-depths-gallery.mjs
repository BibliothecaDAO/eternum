import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** A still-only choice page: each row compares one depth with the current shared surface. */
export function writeDepthGallery(out, sets, shots) {
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const card = (set, depth, device) => {
    const shot = shots.find((s) => s.set === set && s.depth === depth && s.device === device);
    if (!shot) throw new Error(`Missing still: ${set}/${depth}/${device}`);
    return `<figure><a href="${shot.file}" target="_blank"><img src="${shot.file}" alt="${escape(shot.title)} on ${device}" loading="lazy"></a><figcaption>${escape(shot.title)}</figcaption></figure>`;
  };
  const depths = Object.keys(Object.values(sets)[0].depths);
  const devices = ["desktop", "phone"]
    .map(
      (device) => `<section data-device="${device}" ${device === "phone" ? "hidden" : ""}>
    <div class="headings"><h2>Current · every depth</h2>${Object.values(sets)
      .map((set) => `<h2>${escape(set.title)}</h2>`)
      .join("")}</div>
    ${depths
      .map(
        (depth) =>
          `<div class="row">${card("current", "1", device)}${Object.keys(sets)
            .map((set) => card(set, depth, device))
            .join("")}</div>`,
      )
      .join("")}
  </section>`,
    )
    .join("");
  writeFileSync(
    join(out, "index.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ethereal depths · choose a look</title><style>
*{box-sizing:border-box}body{margin:0;background:#131219;color:#e6dfec;font:15px/1.5 system-ui,sans-serif}main{max-width:1800px;margin:auto;padding:32px 24px}header{max-width:900px}h1{font:42px/1.15 Georgia,serif;margin:12px 0}h2{font-size:17px;font-weight:500}p{color:#bcb1c6}strong{color:#f1e6fd}nav{display:flex;gap:8px;margin:24px 0}button{font:inherit;color:inherit;background:#25212d;border:1px solid #756580;border-radius:5px;padding:8px 20px;cursor:pointer}button[aria-pressed=true]{background:#dac4f1;color:#20182b}.headings,.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.row{margin-bottom:22px}figure{margin:0}img{width:100%;height:auto;display:block;background:#211c29}figcaption{font-size:13px;margin-top:7px;color:#c7b8d4}a{color:#d9b9f8}[hidden]{display:none!important}footer{max-width:900px;border-top:1px solid #44394e;margin-top:24px;padding-top:16px}@media(max-width:700px){main{padding:20px 12px}h1{font-size:30px}.headings h2{font-size:12px}.row,.headings{gap:6px}figcaption{font-size:10px}nav{position:sticky;top:0;background:#131219;padding:8px 0;z-index:1}}
</style><main><header><p>Terrain lab / art direction</p><h1>Three depths. Two directions.</h1>
<p><strong>Recommend ${escape(sets.mineral.title)}.</strong> The changes in brightness, slab scale and silhouette make the depths easier to distinguish.</p>
${Object.values(sets)
  .map((set) => `<p><strong>${escape(set.title)}.</strong> ${escape(set.summary)}</p>`)
  .join("")}
<p>Choose A or B, or mix individual depths. These are procedural terrain previews with the shipped Spire and knight at their real scale. <strong>No Tripo prop is needed.</strong></p></header>
<nav aria-label="Capture size"><button aria-pressed="true" data-show="desktop">Desktop · 1440 × 900</button><button aria-pressed="false" data-show="phone">Phone · 390 × 844</button></nav>
${devices}<footer><p>Rows are Ethereal I, II and III. Each uses the same camera, terrain seed, lighting and model placements for its device. Open a still to inspect it at full size. The labels are scale references; the live HUD is not part of this preview.</p>
<p>The expedition docs establish deeper danger and richer rewards, but prescribe no color or mineral for a depth. These names describe proposed looks, not new lore. The original neon tile boundaries remain in both sets.</p>
<p>The surface map and Eternum’s alternate layer retain their current presentation. Awaiting the owner’s pick before depth routing or production integration.</p><p><a href="captures.json">Capture evidence</a></p></footer></main>
<script>document.querySelectorAll('[data-show]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-device]').forEach(section=>section.hidden=section.dataset.device!==button.dataset.show);document.querySelectorAll('[data-show]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));</script></html>`,
  );
}
