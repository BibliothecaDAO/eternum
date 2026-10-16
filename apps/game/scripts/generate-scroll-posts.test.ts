// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

const generator = fileURLToPath(new URL("./generate-scroll-posts.mjs", import.meta.url));
const frontmatter = {
  title: " Title ",
  excerpt: " Summary ",
  date: "2024-02-29",
  type: "update",
  author: " Me ",
  tags: [" first "],
  published: true,
};
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "scroll-contract-"));
  mkdirSync(path.join(directory, "content/scroll"), { recursive: true });
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function generate(fields: Record<string, unknown>) {
  writeFileSync(
    path.join(directory, "content/scroll/2024-02-29-hello.md"),
    `---\n${JSON.stringify(fields)}\n---\n# Hello\n<script>bad()</script>\n`,
  );
  return spawnSync(process.execPath, [generator], { cwd: directory, encoding: "utf8" });
}

it("generates normalized, sanitized posts and produces the identical result when repeated", () => {
  const fields = {
    ...frontmatter,
    coverImage: " cover.png ",
    canonicalUrl: " https://example.test/post ",
    extra: "strip",
  };
  expect(generate(fields).status).toBe(0);
  const output = path.join(directory, "src/shell/generated/scroll-posts.ts");
  const source = readFileSync(output, "utf8");
  const posts = JSON.parse(source.match(/export const scrollPosts: ScrollPost\[\] = ([\s\S]+);\n$/)[1]);
  expect(posts).toStrictEqual([
    {
      slug: "hello",
      title: "Title",
      excerpt: "Summary",
      date: "2024-02-29",
      type: "update",
      author: "Me",
      tags: ["first"],
      published: true,
      coverImage: "cover.png",
      canonicalUrl: "https://example.test/post",
      readingTimeMinutes: 1,
      html: "<h1>Hello</h1>\n\n",
    },
  ]);
  expect(generate(fields).status).toBe(0);
  expect(readFileSync(output, "utf8")).toBe(source);
});

it.each([
  ["title", " ", "title"],
  ["tags", [" "], "tags.0"],
  ["published", "true", "published"],
  ["type", "other", "type"],
  ["canonicalUrl", "not a URL", "canonicalUrl"],
  ["coverImage", "", "coverImage"],
  ["date", "2024-2-29", "date"],
  ["date", "2023-02-29", "not a real calendar date"],
  ["date", "2024-04-31", "not a real calendar date"],
])("rejects invalid %s and identifies its field or date", (key, value, diagnostic) => {
  const result = generate({ ...frontmatter, [key]: value });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("content/scroll/2024-02-29-hello.md");
  expect(result.stderr).toContain(diagnostic);
});
