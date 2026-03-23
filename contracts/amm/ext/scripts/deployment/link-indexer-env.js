export function buildAmmIndexerEnvContent(existingContent, { ammAddress, lordsAddress }) {
  const updates = {
    AMM_ADDRESS: ammAddress,
    LORDS_ADDRESS: lordsAddress,
  };

  let content = existingContent.trimEnd();

  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");

    if (pattern.test(content)) {
      content = content.replace(pattern, `${key}=${value}`);
      continue;
    }

    content = content.length > 0 ? `${content}\n${key}=${value}` : `${key}=${value}`;
  }

  return `${content}\n`;
}

export function resolveAmmIndexerEnvPath(network) {
  return `client/apps/amm-indexer/.env.${network}`;
}
