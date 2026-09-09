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
