import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildStoryEventPresentation,
  configManager,
  getEntityName,
  getStructureName,
  setEntityNameLocalStorage,
  siteDisplayName,
} from "@bibliothecadao/eternum";
import { BuildingType, buildingName, siteName, StructureType } from "@bibliothecadao/types";
import { buildStructurePlate } from "./three/map-plates/map-plate-model";
import { campBeside, SITE } from "./ui/features/frontier/sites/site-fixture";

/**
 * A player reads an army or a structure by its name (`getEntityName`, `getArmyName`, `getStructureName`), never by its
 * entity id: "Structure #12884901891" is a storage key. This finds text that names a thing by an id, in a template
 * (`Army #${army.entityId}`, `arrived · #${row.structureEntityId}`) or in JSX (`Structure #{row.entity_id}`). Logs and
 * errors may carry ids; a toast is read by the player, so it may not. A realm's own number ("Realm #4321") is its name,
 * and a link's fragment or an SVG reference (`href`, `url(#…)`) is no text at all.
 */
const NAME_BEFORE_ID =
  /(\b(Structure|Army|Explorer|Entity|Wonder|Camp|Village|Mine|Hyperstructure) #?|(?<!\bRealm )#)$/;
const NAMES_AN_ID = /(\bid|Id|_id|ID)\b/;
const DIAGNOSTIC_CALL = /^(console|logger)\.\w+$|Log$/;
const REALM_NUMBER = /realm/i;
const REFERENCE_ATTRIBUTES = new Set(["href", "fill", "stroke", "mask", "filter", "clipPath", "id", "key", "to"]);

/** Names still built from an id, each to be removed; none may be added. */
const KNOWN = ["three/utils/labels/entity-label-view-model.ts"];

const SOURCE_ROOTS = [__dirname, join(__dirname, "../../../packages/core/src")];

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.(d|test)\.tsx?$/.test(name) ? [path] : [];
  });

const isDiagnostic = (node: ts.Node, file: ts.SourceFile): boolean => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isThrowStatement(parent)) return true;
    if (ts.isNewExpression(parent) && /Error$/.test(parent.expression.getText(file))) return true;
    if (ts.isCallExpression(parent) && DIAGNOSTIC_CALL.test(parent.expression.getText(file))) return true;
  }
  return false;
};

const isReference = (node: ts.Node): boolean => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxAttribute(parent)) return REFERENCE_ATTRIBUTES.has(parent.name.getText());
  }
  return false;
};

/** Each place in a source that names a kind by an id, as `file:line`. */
const idNames = (path: string, root: string, text = readFileSync(path, "utf8")): string[] => {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const report = (text: string, expression: ts.Node | undefined, at: ts.Node) => {
    if (!expression || !NAME_BEFORE_ID.test(text) || !NAMES_AN_ID.test(expression.getText(file))) return;
    if (REALM_NUMBER.test(expression.getText(file)) || isDiagnostic(at, file) || isReference(at)) return;
    found.push(`${relative(root, path)}:${file.getLineAndCharacterOfPosition(at.getStart()).line + 1}`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isTemplateExpression(node)) {
      report(node.head.text, node.templateSpans[0]?.expression, node);
      node.templateSpans.forEach((span, index) =>
        report(span.literal.text, node.templateSpans[index + 1]?.expression, node),
      );
    }
    if (ts.isJsxElement(node)) {
      node.children.forEach((child, index) => {
        const next = node.children[index + 1];
        if (ts.isJsxText(child) && next && ts.isJsxExpression(next)) report(child.text, next.expression, next);
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
};

describe("entity names", () => {
  it("are never built from an entity id", () => {
    const found = SOURCE_ROOTS.flatMap((root) => sources(root).flatMap((path) => idNames(path, root)));
    expect(found.filter((place) => !KNOWN.some((known) => place.startsWith(known))).toSorted()).toEqual([]);
  });

  it("are caught in a template or JSX, and logs may still carry ids", () => {
    const source = [
      "const a = `Army #${army.entityId}`;",
      "const b = <p>Structure #{row.entity_id.toString()}</p>;",
      "const c = `Structure ${structure.id} · ${slot}`;",
      "console.warn(`Army ${selectedEntityId} is gone`);",
      "throw new Error(`Structure ${structureId} has no owner`);",
      "const d = `Debug Army ${index + 1}`;",
      "const e = `Realm #${realmId}`;",
      "const f = `${transferRowLabel(row)} · #${row.structureEntityId}`;",
      "toast.error(`Army ${army.entityId} was destroyed`);",
      "verboseLog(`[Automation] Structure ${structureId} skipped`);",
      "const g = <a href={`#${sectionId(index)}`}>{name} #{formatExact(realmId)}</a>;",
    ].join("\n");
    expect(idNames(join(__dirname, "row.tsx"), __dirname, source)).toEqual([
      "row.tsx:1",
      "row.tsx:2",
      "row.tsx:3",
      "row.tsx:8",
      "row.tsx:9",
    ]);
  });
});

describe("one name for each thing, read by every list, picker, event and panel", () => {
  afterEach(() => vi.restoreAllMocks());

  const frontierCamp = () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    return campBeside().store;
  };

  it.each([
    ["its generated name", null],
    ["the name its holder gave it", "North Watch"],
  ])("names a site by %s, alike on its map plate, in the lists, the stories and its receipt", (_, given) => {
    const store = frontierCamp();
    const site = { ...store.require("Structure", { game_id: 1, entity_id: SITE }), owner: 0x111n };
    store.applyFacts([{ model: "Structure", key: "0x71", value: site }] as never);
    if (given) setEntityNameLocalStorage(SITE, given);
    try {
      const name = given ?? siteName(SITE);
      expect(getStructureName(site, "frontier").name).toBe(name);
      expect(getEntityName(SITE, store, "frontier")).toBe(name);
      // A cleared site's receipt keeps only the site's id: the same rule names it.
      expect(siteDisplayName(SITE)).toBe(name);
      const plate = buildStructurePlate({
        entityId: SITE,
        structureType: StructureType.Camp,
        structureName: getStructureName(site, "frontier").name,
        owner: { address: 0x111n, ownerName: "", guildName: "" },
        isMine: true,
        guardArmies: [],
      } as never);
      expect(plate.place).toBe(name);
      expect(plate.name).toBe("Camp");
      const captured = buildStoryEventPresentation(
        {
          storyType: "StructureCapturedStory",
          storyPayload: { previous_owner: "0x0", new_owner: "0x111", points: 0 },
          entityId: SITE,
          ownerAddress: "0x111",
          viewerAddress: "0x111",
        } as never,
        store,
      ).title;
      expect(captured).toContain(` took ${name} from `);
    } finally {
      localStorage.removeItem(`entity-name-${SITE}`);
    }
  });

  it("names a building as its game does: Frontier's Barracks, Blitz's Knight T1", () => {
    const built = (store?: ReturnType<typeof frontierCamp>) =>
      buildStoryEventPresentation(
        {
          storyType: "BuildingPaymentStory",
          storyPayload: { category: BuildingType.ResourceKnightT1, cost: [] },
          entityId: 7,
          ownerAddress: "0x123",
          viewerAddress: null,
        } as never,
        store,
      ).title;
    expect(built(frontierCamp())).toMatch(/^Barracks built at /);
    expect(buildingName(BuildingType.ResourceKnightT1, true)).toBe("Barracks");
    vi.restoreAllMocks();
    // With no store to name the realm, its player tells the line.
    expect(built()).toBe("Lord 0123 built a Knight T1");
  });

  it("names a fight's site by its one name and its beast guard's forces by species, never as a troop", () => {
    const store = frontierCamp();
    const fight = buildStoryEventPresentation(
      {
        storyType: "BattleEvent",
        storyPayload: {
          attacker_id: 9,
          defender_id: SITE,
          attacker: {
            player: "0x123",
            category: "Knight",
            tier: "T1",
            before: "755000000000",
            after: "359000000000",
            roll: 0,
          },
          defender: {
            player: "0x0",
            category: "Knight",
            tier: "T1",
            before: "1300000000000",
            after: "979000000000",
            roll: 0,
          },
        },
        entityId: null,
        ownerAddress: "0x123",
        viewerAddress: null,
      } as never,
      store,
    );
    expect(fight.title.split(" vs ")[1].split(" · ")[0]).toBe(siteName(SITE));
    expect(fight.description).toContain("Defender forces: Troll [ 1,300 ]");
    expect(fight.description).toContain("Attacker forces: T1 Knight [ 755 ]");
  });
});
