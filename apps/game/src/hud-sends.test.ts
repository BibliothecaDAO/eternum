import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A HUD button holds itself until the send its press returns has settled, so a second press cannot send twice
 * (HudButton, and HudConfirm's verb through it). A press written `() => void send()` throws that promise away and the
 * button never knows a send is in flight: every HUD press hands its promise back.
 */
const SENDING_PROPS: Record<string, string> = { HudButton: "onClick", HudConfirm: "onConfirm" };

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });

/** Each HUD press in a source that discards what its action returns, as `file:line`. */
const discardedSends = (path: string, text = readFileSync(path, "utf8")): string[] => {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const prop = SENDING_PROPS[node.tagName.getText(file)];
      for (const attribute of node.attributes.properties) {
        if (!prop || !ts.isJsxAttribute(attribute) || attribute.name.getText(file) !== prop) continue;
        const value = attribute.initializer;
        const action = value && ts.isJsxExpression(value) ? value.expression : undefined;
        if (action && ts.isArrowFunction(action) && ts.isVoidExpression(action.body)) {
          const { line } = file.getLineAndCharacterOfPosition(attribute.getStart());
          found.push(`${relative(__dirname, path)}:${line + 1}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

describe("HUD presses", () => {
  it("hand their send's promise back to the button, so none is pressed twice while it is in flight", () => {
    expect(
      sources(__dirname)
        .flatMap((path) => discardedSends(path))
        .toSorted(),
    ).toEqual([]);
  });

  it("are caught when one throws its promise away, and passed when it hands it back", () => {
    const source = [
      "<HudButton kind='primary' onClick={() => void swap()}>Swap</HudButton>;",
      "<HudConfirm question='Swap?' verb='Swap' onConfirm={() => void swap()} onBack={close} />;",
      "<HudButton kind='primary' onClick={() => swap()}>Swap</HudButton>;",
      "<HudButton kind='primary' onClick={swap}>Swap</HudButton>;",
      "<button onClick={() => void swap()}>Swap</button>;",
    ].join("\n");
    expect(discardedSends(join(__dirname, "probe.tsx"), source)).toEqual(["probe.tsx:1", "probe.tsx:2"]);
  });
});
