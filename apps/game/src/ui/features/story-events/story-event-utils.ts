export const parseNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  if (typeof value === "string") {
    try {
      const parsed = value.startsWith("0x") ? Number(BigInt(value)) : Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  }
  return null;
};

export const extractRoleLabel = (
  description: string | undefined,
  role: "Attacker" | "Defender",
): string | undefined => {
  if (!description) return undefined;
  const pattern = new RegExp(`${role}\\s*\\[(.*?)\\]`);
  const match = description.match(pattern);
  return match?.[1];
};

interface StoryDescriptionSegment {
  label?: string;
  value: string;
}

export const parsePresentationDescription = (description?: string): StoryDescriptionSegment[] => {
  if (!description) return [];
  return description
    .split(" · ")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const separatorIndex = segment.indexOf(":");
      if (separatorIndex > 0 && separatorIndex < segment.length - 1) {
        const label = segment.slice(0, separatorIndex).trim();
        const value = segment.slice(separatorIndex + 1).trim();
        return { label, value };
      }
      return { value: segment };
    });
};

export const findSegmentValue = (
  segments: StoryDescriptionSegment[],
  matcher: (label?: string) => boolean,
): string | undefined => {
  return segments.find((segment) => matcher(segment.label))?.value;
};

export const normalizePresentationTroops = (value?: string): string | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(?<type>.+?)\s*\[\s*(?<count>.+?)\s*\]$/);
  if (match?.groups?.type && match.groups.count) {
    const type = match.groups.type.trim();
    const count = match.groups.count.trim();
    if (count && type) {
      return `${count} ${type}`;
    }
  }
  return undefined;
};

export const formatWinnerName = (value?: string): string | undefined => {
  if (!value) return undefined;
  const match = value.match(/\[(.*?)\]/);
  if (match?.[1]) return match[1];
  return value;
};
