export const isToriiAvailable = async (toriiBaseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${toriiBaseUrl}/sql`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
};
