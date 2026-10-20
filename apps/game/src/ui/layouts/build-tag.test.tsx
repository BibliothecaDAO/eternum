import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const build = vi.hoisted(() => ({ version: "" }));
vi.mock("../../../env", () => ({
  env: {
    get VITE_PUBLIC_GAME_VERSION() {
      return build.version;
    },
  },
}));

import { BuildTag } from "./build-tag";

const tagOf = (version: string) => {
  build.version = version;
  const page = new DOMParser().parseFromString(renderToStaticMarkup(<BuildTag />), "text/html");
  const link = page.querySelector("a");
  return link ? { text: link.textContent, href: link.getAttribute("href") } : null;
};

it("shows a deployed commit as git's short form, linked to that commit (live-qa-night-1 P3-9)", () => {
  expect(tagOf("91fa88fc3ca25cb74578e81c9310b73b228123d1")).toEqual({
    text: "91fa88f",
    href: "https://github.com/BibliothecaDAO/eternum/commit/91fa88fc3ca25cb74578e81c9310b73b228123d1",
  });
});

it("shows a named build as its name, and nothing for a build with no version", () => {
  expect(tagOf("athanor")).toEqual({ text: "athanor", href: "https://github.com/BibliothecaDAO/eternum" });
  expect(tagOf("")).toBeNull();
});
