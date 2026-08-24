const BASE64_JSON_PREFIX = "data:application/json;base64,";
const JSON_PREFIX = "data:application/json,";

type ContractCall = (
  entrypoint: string,
  calldata: string[],
) => Promise<unknown>;

export async function readRealmMetadata(
  call: ContractCall,
  tokenId: string,
): Promise<string> {
  const result = await call("get_decoded_metadata", [tokenId]);
  if (typeof result !== "string") {
    throw new TypeError("Realm metadata contract returned invalid data");
  }
  return decodeRealmMetadata(result);
}

export function decodeRealmMetadata(value: string): string {
  let json: string;

  if (value.startsWith(BASE64_JSON_PREFIX)) {
    const encoded = value.slice(BASE64_JSON_PREFIX.length);
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    );
    json = new TextDecoder().decode(bytes);
  } else if (value.startsWith(JSON_PREFIX)) {
    json = decodeURIComponent(value.slice(JSON_PREFIX.length));
  } else if (value.trimStart().startsWith("{")) {
    json = value;
  } else {
    throw new TypeError("Unsupported Realm metadata format");
  }

  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Realm metadata must be a JSON object");
  }
  return JSON.stringify(parsed);
}
