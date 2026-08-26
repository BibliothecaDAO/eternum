export const isToriiAvailable = async (toriiBaseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${toriiBaseUrl}/sql`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
};

type ToriiProbePath = "/sql" | "/health";

const probeToriiPath = async (
  toriiBaseUrl: string,
  path: ToriiProbePath,
  timeoutMs: number,
): Promise<boolean | null> => {
  try {
    const response = await fetch(`${toriiBaseUrl.replace(/\/+$/, "")}${path}`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) return true;
    if (response.status === 404) return false;
    return null;
  } catch {
    return null;
  }
};

export const probeWorldToriiAlive = async (
  toriiBaseUrl: string | null | undefined,
  timeoutMs = 2_000,
): Promise<boolean | null> => {
  if (!toriiBaseUrl) return null;

  const sqlResult = await probeToriiPath(toriiBaseUrl, "/sql", timeoutMs);
  if (sqlResult !== null) return sqlResult;

  return (await probeToriiPath(toriiBaseUrl, "/health", timeoutMs)) === true ? true : null;
};
