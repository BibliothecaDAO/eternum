import { DefaultLoadingManager } from "three";

declare const __MODEL_URLS__: Readonly<Record<string, string>> | undefined;

/** A build's content-hashed model URLs (build/hashed-models.ts); none in development and tests. */
const MODEL_URLS: Readonly<Record<string, string>> = typeof __MODEL_URLS__ === "undefined" ? {} : __MODEL_URLS__;

/** The URL a model is served at: its content-hashed name in a build, the file's own in development. */
export const modelUrl = (url: string): string => MODEL_URLS[url] ?? url;

// Every three.js loader resolves through the default manager, a glTF's own buffers and images included.
DefaultLoadingManager.setURLModifier(modelUrl);
