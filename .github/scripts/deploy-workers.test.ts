import { expect, test } from "bun:test";

const workflow = Bun.YAML.parse(await Bun.file(new URL("../workflows/deploy-workers.yml", import.meta.url)).text()) as {
  on: { push: { branches: string[]; paths?: string[]; "paths-ignore"?: string[] } };
};

test("staging follows next and every change can trigger its Worker build", () => {
  expect(workflow.on.push.branches).toEqual(["next"]);
  expect(workflow.on.push.paths).toBeUndefined();
  expect(workflow.on.push["paths-ignore"]).toBeUndefined();
});
