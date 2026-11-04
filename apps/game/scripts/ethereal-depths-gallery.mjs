import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Round two: the approved palette after entering each depth through the real Frontier Spire controls. */
export function writeDepthGallery(out, looks, shots) {
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const devices = ["desktop", "phone"]
    .map(
      (device) => `<section data-device="${device}" ${device === "phone" ? "hidden" : ""}>
    ${Object.entries(looks)
      .map(([depth, look]) => {
        const shot = shots.find((shot) => shot.depth === depth && shot.device === device);
        if (!shot) throw new Error(`Missing Frontier still: ${depth}/${device}`);
        return `<figure><h2>Ethereal ${"I".repeat(Number(depth))} · ${escape(look.title)}</h2><a href="${shot.file}" target="_blank"><img src="${shot.file}" alt="Frontier ${escape(look.title)}, ${device}, army and Spire" loading="lazy"></a><figcaption><a href="${shot.entry}" target="_blank">Spire entry before this arrival</a></figcaption></figure>`;
      })
      .join("")}</section>`,
    )
    .join("");
  writeFileSync(
    join(out, "index.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ethereal depths · Violet descent · round 2</title><style>
*{box-sizing:border-box}body{margin:0;background:#131219;color:#e6dfec;font:15px/1.5 system-ui,sans-serif}main{max-width:1700px;margin:auto;padding:32px 24px}header{max-width:900px}h1{font:42px/1.15 Georgia,serif;margin:12px 0}h2{font-size:20px;font-weight:500}p{color:#bcb1c6}strong{color:#f1e6fd}nav{display:flex;gap:8px;margin:24px 0}button{font:inherit;color:inherit;background:#25212d;border:1px solid #756580;border-radius:5px;padding:8px 20px;cursor:pointer}button[aria-pressed=true]{background:#dac4f1;color:#20182b}figure{margin:0 0 36px}img{width:100%;height:auto;display:block;background:#211c29}figcaption{font-size:13px;margin-top:7px;color:#c7b8d4}a{color:#d9b9f8}[hidden]{display:none!important}[data-device=phone]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}footer{border-top:1px solid #44394e;padding-top:16px}@media(max-width:700px){main{padding:20px 12px}h1{font-size:30px}[data-device=phone]{grid-template-columns:1fr}nav{position:sticky;top:0;background:#131219;padding:8px 0;z-index:1}}
</style><main><header><p>Round 2 / Frontier in-game review</p><h1>B · Violet descent</h1>
<p><strong>Approved direction, wired by depth.</strong> Each still follows a Spire entry in the real Frontier client: its HUD, native fact store, world map and terrain renderer.</p>
<p><strong>Lab world with fixture facts.</strong> All three depths are researched and the landing areas are explored in the fixture. A fixture Spire stands beside each arrival for scale. No dev or production game state was changed.</p>
<p>The one depth table drives the game and the terrain study. Eternum’s alternate layer retains its original basalt. Procedural materials and mineral clusters; no new downloaded model.</p></header>
<nav aria-label="Capture size"><button aria-pressed="true" data-show="desktop">Desktop · 1440 × 900</button><button aria-pressed="false" data-show="phone">Phone · 390 × 844</button></nav>
${devices}<footer><p>Each proof records the signed EnterDepth command, the army’s arrival, the camera and the material on committed terrain meshes. One run per depth and device, WebGL backend. These are visual and routing checks, not a performance benchmark.</p><p><a href="captures.json">Capture evidence</a> · Ready for owner review.</p></footer></main>
<script>document.querySelectorAll('[data-show]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-device]').forEach(section=>section.hidden=section.dataset.device!==button.dataset.show);document.querySelectorAll('[data-show]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));</script></html>`,
  );
}
