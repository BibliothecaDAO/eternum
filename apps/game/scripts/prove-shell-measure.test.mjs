// @vitest-environment jsdom
/**
 * The proof's own content-start measure (prove-shell.mjs MEASURE, the expression the browser evaluates), run over the
 * page arrangements it must tell apart. jsdom lays nothing out, so each element's box is given (`data-box`: top, height,
 * left, width) and Tailwind's `fixed` class stands as its inline style.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { layoutChecks, MEASURE } from "./prove-shell.mjs";

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    const [top = 0, height = 0, left = 48, width = 400] = (this.dataset?.box ?? "").split(" ").map(Number);
    return { top, height, left, width, bottom: top + height, right: left + width, x: left, y: top };
  };
  document.elementFromPoint = () => null;
});

afterEach(() => document.body.replaceChildren());

const measure = (html) => {
  document.body.innerHTML = html;
  return (0, eval)(MEASURE);
};

const contentTop = (measured) =>
  layoutChecks(measured, "desktop").find((check) => check.check === "content at the top");

/**
 * A desktop step over a window-wide painting: inside the body, the painting held to the window behind everything (an
 * aria-hidden wrapper, from the window's top edge, above the 72 px bar), a line fixed at the window's foot, and a panel
 * fixed under the bar with its title and a name field.
 */
const paintedStep = ({ title, field }) => `
  <div data-layout="desktop">
    <header data-band="bar" data-box="0 72 0 1440"></header>
    <main data-band="body" data-box="72 828 0 1440">
      <div aria-hidden="true" style="position: fixed" data-box="0 900 0 1440">
        <img alt="" data-box="0 900 0 1440" />
      </div>
      <p style="position: fixed" data-box="780 60 48 600">The mist forgets. Your realm remembers.</p>
      <section style="position: fixed" data-box="72 828 1040 400">
        <p data-box="${title} 32 1080 300">Your name</p>
        <input aria-label="Name" data-box="${field} 48 1080 320" />
      </section>
    </main>
  </div>`;

describe("where a page's content starts", () => {
  it("holds a painted step, its title under the bar, its window-wide painting never counted", () => {
    const measured = measure(paintedStep({ title: 112, field: 172 }));
    expect(measured.contentTop).toBe(40);
    expect(contentTop(measured).ok).toBe(true);
  });

  it("rejects the same step moved 200 px down: the painting above the bar cannot stand for the content", () => {
    const measured = measure(paintedStep({ title: 312, field: 372 }));
    expect(measured.contentTop).toBe(240);
    expect(contentTop(measured).ok).toBe(false);
  });

  it("does not count a picture held to the window as content, hidden from assistive technology or not", () => {
    const measured = measure(`
      <div data-layout="desktop">
        <header data-band="bar" data-box="0 72 0 1440"></header>
        <main data-band="body" data-box="72 828 0 1440">
          <img alt="" style="position: fixed" data-box="0 900 0 1440" />
          <p data-box="312 32">Season 3</p>
        </main>
      </div>`);
    expect(measured.contentTop).toBe(240);
    expect(contentTop(measured).ok).toBe(false);
  });

  it("counts a card's picture as content: a game card's painting starts the page", () => {
    const measured = measure(`
      <div data-layout="desktop">
        <header data-band="bar" data-box="0 72 0 1440"></header>
        <main data-band="body" data-box="72 828 0 1440">
          <article data-box="112 640 48 660">
            <img alt="" style="position: absolute" data-box="112 640 48 660" />
            <h3 data-box="640 60 72 400">Frontier</h3>
          </article>
        </main>
      </div>`);
    expect(measured.contentTop).toBe(40);
    expect(contentTop(measured).ok).toBe(true);
  });

  it("counts a field as content: a name field that leads the page starts it", () => {
    const measured = measure(`
      <div data-layout="phone">
        <header data-band="top" data-box="0 48 0 390"></header>
        <main data-band="body" data-box="48 796 0 390">
          <input aria-label="Name" data-box="64 56 16 358" />
          <p data-box="140 20 16 358">Pick a portrait</p>
        </main>
      </div>`);
    expect(measured.contentTop).toBe(16);
    expect(layoutChecks(measured, "phone").find((check) => check.check === "content at the top").ok).toBe(true);
  });
});
