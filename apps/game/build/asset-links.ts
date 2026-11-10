import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

/** Where Android reads the statements by which a site vouches for an app (Digital Asset Links). */
export const ASSET_LINKS_FILE = ".well-known/assetlinks.json";

/** The Android app's Bubblewrap manifest: its package and its signing keys' fingerprints are kept there only. */
export const ANDROID_APP_MANIFEST = new URL("../../android/twa-manifest.json", import.meta.url);

/** A signing certificate's SHA-256 as keytool and Play Console print it. */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * The upload key and the Play App Signing key. A list without the second shows the URL bar on every install from
 * Play, so a list naming fewer keys is refused rather than served.
 */
const SIGNING_KEYS = 2;

type AndroidAppManifest = { packageId: string; fingerprints: { name?: string; value: string }[] };

/**
 * The statement list that lets the Android app open this site with no URL bar: its package, signed by the keys its
 * manifest names (`bubblewrap fingerprint add`). Null until a key is named, so the site serves no file rather than one
 * vouching for nothing; a malformed or partial key list throws, failing the build.
 */
export const assetLinksStatements = ({ packageId, fingerprints }: AndroidAppManifest): string | null => {
  if (fingerprints.length === 0) return null;
  const keys = fingerprints.map(({ value }) => value);
  const malformed = keys.filter((key) => !FINGERPRINT.test(key));
  if (malformed.length > 0) throw new Error(`Android app fingerprints are not SHA-256: ${malformed.join(", ")}`);
  if (new Set(keys).size < SIGNING_KEYS)
    throw new Error("Android app fingerprints need both the upload key and the Play App Signing key");
  const statement = {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: packageId, sha256_cert_fingerprints: keys },
  };
  return `${JSON.stringify([statement], null, 2)}\n`;
};

export const readAndroidAppManifest = (manifest: URL): AndroidAppManifest => JSON.parse(readFileSync(manifest, "utf8"));

/** Writes the site's statement list for the Android app into the build, once its manifest names its keys. */
export function assetLinks(manifest = ANDROID_APP_MANIFEST): Plugin {
  return {
    name: "asset-links",
    apply: "build",
    generateBundle() {
      const statements = assetLinksStatements(readAndroidAppManifest(manifest));
      if (statements) this.emitFile({ type: "asset", fileName: ASSET_LINKS_FILE, source: statements });
    },
  };
}
