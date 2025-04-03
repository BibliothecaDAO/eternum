const ETERNUM_GITHUB_RAW_CONTENT_GAME_CONTRACTS_URL =
  "https://raw.githubusercontent.com/BibliothecaDAO/eternum/refs/heads/next/contracts/game/";

export const getToriiVersion = async () => {
  const response = await fetch(`${ETERNUM_GITHUB_RAW_CONTENT_GAME_CONTRACTS_URL}Scarb.toml`);
  const data = await response.text();

  const dojoTagMatch = data.match(/dojo\s*=\s*{\s*git\s*=\s*"[^"]+"\s*,\s*tag\s*=\s*"([^"]+)"\s*}/);
  const dojoTag = dojoTagMatch ? dojoTagMatch[1] : undefined;

  console.log(`Using torii version: ${dojoTag}`);
  return dojoTag;
};

export const getToriiConfig = async (configType: "local" | "mainnet" | "sepolia" | "slot") => {
  const response = await fetch(`${ETERNUM_GITHUB_RAW_CONTENT_GAME_CONTRACTS_URL}torii-${configType}.toml`);

  const data = await response.text();

  return data;
};
