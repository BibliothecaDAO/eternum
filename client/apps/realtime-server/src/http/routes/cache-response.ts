import { brotliCompressSync, gzipSync } from "zlib";

export type SerializedJson = string;

export type CachedJsonPayload = {
  json: SerializedJson;
  size: number;
  br?: Uint8Array;
  gzip?: Uint8Array;
};

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const COMPRESSION_THRESHOLD_BYTES = 1024;
const VARY_HEADER = "Vary";
const ACCEPT_ENCODING_HEADER = "Accept-Encoding";

type ResponseHeadersSource = Headers | Record<string, string> | Array<[string, string]>;

export const createJsonPayload = (value: unknown): CachedJsonPayload => {
  const json = JSON.stringify(value);
  return { json, size: Buffer.byteLength(json) };
};

const getCompressedPayload = (payload: CachedJsonPayload, encoding: "br" | "gzip"): Uint8Array => {
  if (encoding === "br") {
    if (!payload.br) {
      payload.br = brotliCompressSync(payload.json);
    }
    return payload.br;
  }

  if (!payload.gzip) {
    payload.gzip = gzipSync(payload.json);
  }
  return payload.gzip;
};

const appendVaryHeader = (headers: Headers, value: string) => {
  const existing = headers.get(VARY_HEADER);
  if (!existing) {
    headers.set(VARY_HEADER, value);
    return;
  }

  const existingValues = existing
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (existingValues.includes(value.toLowerCase())) {
    return;
  }

  headers.set(VARY_HEADER, `${existing}, ${value}`);
};

export const createCachedJsonResponse = ({
  payload,
  status = 200,
  acceptEncoding,
  headers,
}: {
  payload: CachedJsonPayload;
  status?: number;
  acceptEncoding?: string | null;
  headers?: ResponseHeadersSource;
}): Response => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", JSON_CONTENT_TYPE);
  appendVaryHeader(responseHeaders, ACCEPT_ENCODING_HEADER);

  const normalizedEncoding = acceptEncoding?.toLowerCase() ?? "";

  if (payload.size >= COMPRESSION_THRESHOLD_BYTES) {
    if (normalizedEncoding.includes("br")) {
      responseHeaders.set("Content-Encoding", "br");
      return new Response(getCompressedPayload(payload, "br"), { status, headers: responseHeaders });
    }
    if (normalizedEncoding.includes("gzip")) {
      responseHeaders.set("Content-Encoding", "gzip");
      return new Response(getCompressedPayload(payload, "gzip"), { status, headers: responseHeaders });
    }
  }

  responseHeaders.delete("Content-Encoding");
  return new Response(payload.json, { status, headers: responseHeaders });
};
