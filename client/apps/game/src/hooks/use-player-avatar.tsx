import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "../../env";

const REALTIME_SERVER_URL = env.VITE_PUBLIC_REALTIME_SERVER_URL;
const AVATAR_CACHE_STALE_MS = 60 * 60 * 1000;
const AVATAR_CACHE_GC_MS = 24 * 60 * 60 * 1000;

interface PlayerProfile {
  cartridgeUsername: string;
  playerAddress: string;
  avatarUrl: string | null;
  createdAt: string | null;
  generationCount?: number;
  nextResetAt?: string | null;
}

interface GenerateAvatarOptions {
  prompt: string;
  style?: string;
}

interface GenerateAvatarResult {
  success: boolean;
  jobId: string;
  imageUrls: string[];
  profile: PlayerProfile;
}

interface AvatarGenerationLog {
  id: string;
  prompt: string;
  status: string;
  errorMessage?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  createdAt: string;
}

interface AvatarGalleryItem {
  imageUrl: string;
  prompt: string;
  cartridgeUsername: string | null;
  createdAt: string;
}

interface AvatarProfile {
  playerAddress: string;
  avatarUrl: string | null;
  cartridgeUsername?: string | null;
}

export const normalizeAvatarUsername = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

export const normalizeAvatarAddress = (value?: string | bigint | number | null): string | null => {
  if (value === null || value === undefined) return null;

  const normalizeString = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      return trimmed.toLowerCase();
    }
    if (/^[0-9]+$/.test(trimmed)) {
      try {
        return `0x${BigInt(trimmed).toString(16)}`.toLowerCase();
      } catch {
        return null;
      }
    }
    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      return `0x${trimmed.toLowerCase()}`;
    }
    return trimmed.toLowerCase();
  };

  if (typeof value === "bigint") {
    return `0x${value.toString(16)}`.toLowerCase();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return `0x${Math.trunc(value).toString(16)}`.toLowerCase();
  }

  if (typeof value === "string") {
    return normalizeString(value);
  }

  try {
    const stringValue = String(value).trim();
    if (!stringValue || stringValue === "[object Object]" || stringValue === "undefined" || stringValue === "null") {
      return null;
    }
    return normalizeString(stringValue);
  } catch {
    return null;
  }
};

const uniqueAddresses = (addresses: Array<string | bigint | number | null | undefined>): string[] => {
  const normalized = addresses
    .map((address) => normalizeAvatarAddress(address))
    .filter((address): address is string => Boolean(address));
  return Array.from(new Set(normalized));
};

const uniqueUsernames = (usernames: Array<string | null | undefined>): string[] => {
  const normalized = usernames
    .map((username) => normalizeAvatarUsername(username))
    .filter((username): username is string => Boolean(username));
  return Array.from(new Set(normalized));
};
export function usePlayerAvatar(playerAddress?: string | bigint | number | null) {
  const normalizedAddress = normalizeAvatarAddress(playerAddress);

  return useQuery({
    queryKey: ["player-avatar", normalizedAddress],
    queryFn: async (): Promise<PlayerProfile | null> => {
      if (!normalizedAddress) return null;

      try {
        const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/profile-by-address/${normalizedAddress}`);

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch avatar");
        }

        return await response.json();
      } catch (error) {
        console.error("Error fetching player avatar:", error);
        return null;
      }
    },
    enabled: !!normalizedAddress,
    staleTime: AVATAR_CACHE_STALE_MS,
    gcTime: AVATAR_CACHE_GC_MS,
    refetchOnWindowFocus: false,
  });
}

export function usePlayerAvatarByUsername(username?: string | null) {
  const normalizedUsername = normalizeAvatarUsername(username);

  return useQuery({
    queryKey: ["player-avatar-username", normalizedUsername],
    queryFn: async (): Promise<PlayerProfile | null> => {
      if (!normalizedUsername) return null;

      try {
        const response = await fetch(
          `${REALTIME_SERVER_URL}/api/avatars/profile/${encodeURIComponent(normalizedUsername)}`,
        );

        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch avatar");
        }

        return await response.json();
      } catch (error) {
        console.error("Error fetching player avatar:", error);
        return null;
      }
    },
    enabled: !!normalizedUsername,
    staleTime: AVATAR_CACHE_STALE_MS,
    gcTime: AVATAR_CACHE_GC_MS,
    refetchOnWindowFocus: false,
  });
}

export function useMyAvatar(playerId: string, walletAddress: string, displayName: string) {
  return useQuery({
    queryKey: ["my-avatar", playerId, displayName],
    queryFn: async (): Promise<PlayerProfile | null> => {
      if (!playerId || !displayName) return null;

      try {
        const headers: Record<string, string> = {
          "x-player-id": playerId,
          "x-player-name": displayName,
        };
        if (walletAddress) {
          headers["x-wallet-address"] = walletAddress;
        }

        const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/me`, {
          headers,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch my avatar");
        }

        return await response.json();
      } catch (error) {
        console.error("Error fetching my avatar:", error);
        return null;
      }
    },
    enabled: Boolean(playerId && displayName),
    staleTime: 1000, // Consider data stale after 1 second to allow refetches
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: false,
  });
}

export function useGenerateAvatar(playerId: string, walletAddress: string, displayName: string) {
  const queryClient = useQueryClient();
  const normalizedPlayerId = normalizeAvatarAddress(playerId);

  return useMutation({
    mutationFn: async (options: GenerateAvatarOptions): Promise<GenerateAvatarResult> => {
      const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-player-id": playerId,
          "x-wallet-address": walletAddress,
          "x-player-name": displayName,
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to generate avatar" }));
        throw new Error(error.message || error.error || "Failed to generate avatar");
      }

      return await response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch avatar queries
      queryClient.invalidateQueries({ queryKey: ["my-avatar", playerId, displayName] });
      queryClient.invalidateQueries({ queryKey: ["avatar-history", playerId, displayName] });
      if (normalizedPlayerId) {
        queryClient.invalidateQueries({ queryKey: ["player-avatar", normalizedPlayerId] });
      }
      queryClient.invalidateQueries({ queryKey: ["avatar-gallery"] });
    },
  });
}

export function useDeleteAvatar(playerId: string, walletAddress: string, displayName: string) {
  const queryClient = useQueryClient();
  const normalizedPlayerId = normalizeAvatarAddress(playerId);

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/me`, {
        method: "DELETE",
        headers: {
          "x-player-id": playerId,
          "x-wallet-address": walletAddress,
          "x-player-name": displayName,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete avatar");
      }
    },
    onSuccess: () => {
      // Invalidate and refetch avatar queries
      queryClient.invalidateQueries({ queryKey: ["my-avatar", playerId, displayName] });
      if (normalizedPlayerId) {
        queryClient.invalidateQueries({ queryKey: ["player-avatar", normalizedPlayerId] });
      }
    },
  });
}

export function useSelectAvatar(playerId: string, walletAddress: string, displayName: string) {
  const queryClient = useQueryClient();
  const normalizedPlayerId = normalizeAvatarAddress(playerId);

  return useMutation({
    mutationFn: async (imageUrl: string): Promise<{ avatarUrl: string }> => {
      const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-player-id": playerId,
          "x-wallet-address": walletAddress,
          "x-player-name": displayName,
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to set avatar" }));
        throw new Error(error.error || "Failed to set avatar");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-avatar", playerId, displayName] });
      if (normalizedPlayerId) {
        queryClient.invalidateQueries({ queryKey: ["player-avatar", normalizedPlayerId] });
      }
      queryClient.invalidateQueries({ queryKey: ["avatar-gallery"] });
    },
  });
}

export function useAvatarHistory(playerId: string, walletAddress: string, displayName: string, limit = 5) {
  return useQuery({
    queryKey: ["avatar-history", playerId, displayName, limit],
    queryFn: async (): Promise<AvatarGenerationLog[]> => {
      if (!playerId || !displayName) return [];

      const headers: Record<string, string> = {
        "x-player-id": playerId,
        "x-player-name": displayName,
      };
      if (walletAddress) {
        headers["x-wallet-address"] = walletAddress;
      }

      const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/history?limit=${encodeURIComponent(limit)}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch avatar history");
      }

      const data = await response.json();
      return data.logs ?? [];
    },
    enabled: Boolean(playerId && displayName),
    staleTime: 30 * 1000,
  });
}

export function useAvatarGallery(limit = 40) {
  return useQuery({
    queryKey: ["avatar-gallery", limit],
    queryFn: async (): Promise<AvatarGalleryItem[]> => {
      const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/gallery?limit=${encodeURIComponent(limit)}`);

      if (!response.ok) {
        throw new Error("Failed to fetch avatar gallery");
      }

      const data = await response.json();
      return data.images ?? [];
    },
    staleTime: 60 * 1000,
  });
}

export function useAvatarProfiles(addresses: Array<string | bigint | number | null | undefined>) {
  const queryClient = useQueryClient();
  const normalizedAddresses = uniqueAddresses(addresses);

  const cachedProfiles = normalizedAddresses
    .map((address) => queryClient.getQueryData<PlayerProfile>(["player-avatar", address]))
    .filter((profile): profile is PlayerProfile => Boolean(profile));

  const shouldFetch = normalizedAddresses.some(
    (address) => !queryClient.getQueryData<PlayerProfile>(["player-avatar", address]),
  );

  return useQuery({
    queryKey: ["avatar-profiles", normalizedAddresses],
    queryFn: async (): Promise<AvatarProfile[]> => {
      if (normalizedAddresses.length === 0) return [];

      const batches: string[][] = [];
      const batchSize = 100;
      for (let i = 0; i < normalizedAddresses.length; i += batchSize) {
        batches.push(normalizedAddresses.slice(i, i + batchSize));
      }

      const results = await Promise.all(
        batches.map(async (batch) => {
          const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/profiles`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ addresses: batch }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch avatar profiles");
          }

          const data = await response.json();
          return data.profiles ?? [];
        }),
      );

      const profiles = results.flat();

      profiles.forEach((profile: AvatarProfile) => {
        const normalized = normalizeAvatarAddress(profile.playerAddress);
        if (!normalized) return;
        queryClient.setQueryData(["player-avatar", normalized], profile);
      });

      return profiles;
    },
    enabled: normalizedAddresses.length > 0 && shouldFetch,
    initialData: cachedProfiles.length > 0 ? cachedProfiles : undefined,
    staleTime: AVATAR_CACHE_STALE_MS,
    gcTime: AVATAR_CACHE_GC_MS,
    refetchOnWindowFocus: false,
  });
}

export function useAvatarProfilesByUsernames(usernames: Array<string | null | undefined>) {
  const queryClient = useQueryClient();
  const normalizedUsernames = uniqueUsernames(usernames);

  const cachedProfiles = normalizedUsernames
    .map((username) => queryClient.getQueryData<PlayerProfile>(["player-avatar-username", username]))
    .filter((profile): profile is PlayerProfile => Boolean(profile));

  const shouldFetch = normalizedUsernames.some(
    (username) => !queryClient.getQueryData<PlayerProfile>(["player-avatar-username", username]),
  );

  return useQuery({
    queryKey: ["avatar-profiles-usernames", normalizedUsernames],
    queryFn: async (): Promise<AvatarProfile[]> => {
      if (normalizedUsernames.length === 0) return [];

      const batches: string[][] = [];
      const batchSize = 100;
      for (let i = 0; i < normalizedUsernames.length; i += batchSize) {
        batches.push(normalizedUsernames.slice(i, i + batchSize));
      }

      const results = await Promise.all(
        batches.map(async (batch) => {
          const response = await fetch(`${REALTIME_SERVER_URL}/api/avatars/profiles-by-username`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ usernames: batch }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch avatar profiles");
          }

          const data = await response.json();
          return data.profiles ?? [];
        }),
      );

      const profiles = results.flat();

      profiles.forEach((profile: AvatarProfile) => {
        const normalized = normalizeAvatarUsername(profile.cartridgeUsername ?? undefined);
        if (!normalized) return;
        queryClient.setQueryData(["player-avatar-username", normalized], profile);
      });

      return profiles;
    },
    enabled: normalizedUsernames.length > 0 && shouldFetch,
    initialData: cachedProfiles.length > 0 ? cachedProfiles : undefined,
    staleTime: AVATAR_CACHE_STALE_MS,
    gcTime: AVATAR_CACHE_GC_MS,
    refetchOnWindowFocus: false,
  });
}

// Helper function to get default avatar based on address hash
export function getDefaultAvatar(address: string): string {
  const hash = parseInt(address.slice(0, 8), 16);
  const avatarNumber = Number.isNaN(hash) ? 1 : (hash % 7) + 1;
  return `/images/avatars/${String(avatarNumber).padStart(2, "0")}.png`;
}

// Helper function to get avatar URL with fallback to default
export function getAvatarUrl(address: string, customAvatarUrl?: string | null): string {
  return customAvatarUrl || getDefaultAvatar(address);
}
