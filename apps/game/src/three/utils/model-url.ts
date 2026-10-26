import { DefaultLoadingManager } from "three";

declare const __MODEL_URLS__: Readonly<Record<string, string>> | undefined;

type ModelUrls = Readonly<Record<string, string>>;

/** Where a build publishes its map (build/hashed-models.ts), so a tab opened before a deployment can read the new one. */
const DEPLOYED_MODEL_URLS = "/model-urls.json";

/** This tab's content-hashed model URLs: its build's, then the deployment's once a model fails; none in development. */
let modelUrls: ModelUrls | null = typeof __MODEL_URLS__ === "undefined" ? null : __MODEL_URLS__;
let reading: Promise<void> | null = null;

/** The URL a model is served at: its content-hashed name in a build, the file's own in development. */
export const modelUrl = (url: string): string => modelUrls?.[url] ?? url;

/** The map this tab resolves model URLs with now; a new object once the deployment's differs. */
export const currentModelUrls = (): ModelUrls | null => modelUrls;

/**
 * A deployment that changes a model retires its old name, and a tab opened before it still asks for that name. Reads
 * the deployed map and takes it if it names any model differently; failures at the same time share one read.
 */
export function readDeployedModelUrls(): Promise<void> {
  if (!modelUrls) return Promise.resolve();
  reading ??= fetch(DEPLOYED_MODEL_URLS, { cache: "no-cache" })
    .then((response) => (response.ok ? (response.json() as Promise<ModelUrls>) : null))
    .then((deployed) => {
      if (deployed && !sameUrls(deployed, modelUrls)) modelUrls = deployed;
    })
    .catch(() => {})
    .finally(() => {
      reading = null;
    });
  return reading;
}

const sameUrls = (left: ModelUrls, right: ModelUrls | null) =>
  right !== null &&
  Object.keys(left).length === Object.keys(right).length &&
  Object.entries(left).every(([url, hashed]) => right[url] === hashed);

// Every three.js loader resolves through the default manager, a glTF's own buffers and images included.
DefaultLoadingManager.setURLModifier(modelUrl);
