import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "../../env";

const REALTIME_SERVER_URL = env.VITE_PUBLIC_REALTIME_SERVER_URL;

interface PlayerProfile {
  cartridgeUsername: string;
  playerAddress: string;
  avatarUrl: string | null;
  createdAt: string | null;
  generationCount?: number;
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

export function usePlayerAvatar(playerAddress?: string) {
  return useQuery({
    queryKey: ["player-avatar", playerAddress],
    queryFn: async (): Promise<PlayerProfile | null> => {
      if (!playerAddress) return null;

      try {
        const response = await fetch(
          `${REALTIME_SERVER_URL}/api/avatars/profile-by-address/${playerAddress}`,
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
    enabled: !!playerAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
        throw new Error(error.error || "Failed to generate avatar");
      }

      return await response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch avatar queries
      queryClient.invalidateQueries({ queryKey: ["my-avatar", playerId, displayName] });
      queryClient.invalidateQueries({ queryKey: ["avatar-history", playerId, displayName] });
      queryClient.invalidateQueries({ queryKey: ["player-avatar", playerId] });
      queryClient.invalidateQueries({ queryKey: ["avatar-gallery"] });
    },
  });
}

export function useDeleteAvatar(playerId: string, walletAddress: string, displayName: string) {
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ["player-avatar", playerId] });
    },
  });
}

export function useSelectAvatar(playerId: string, walletAddress: string, displayName: string) {
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ["player-avatar", playerId] });
      queryClient.invalidateQueries({ queryKey: ["avatar-gallery"] });
    },
  });
}

export function useAvatarHistory(
  playerId: string,
  walletAddress: string,
  displayName: string,
  limit = 5,
) {
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

      const response = await fetch(
        `${REALTIME_SERVER_URL}/api/avatars/history?limit=${encodeURIComponent(limit)}`,
        { headers },
      );

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
      const response = await fetch(
        `${REALTIME_SERVER_URL}/api/avatars/gallery?limit=${encodeURIComponent(limit)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch avatar gallery");
      }

      const data = await response.json();
      return data.images ?? [];
    },
    staleTime: 60 * 1000,
  });
}

// Helper function to get default avatar based on address hash
export function getDefaultAvatar(address: string): string {
  const avatarNumber = (parseInt(address.slice(0, 8), 16) % 7) + 1;
  return `/images/avatars/${String(avatarNumber).padStart(2, "0")}.png`;
}

// Helper function to get avatar URL with fallback to default
export function getAvatarUrl(address: string, customAvatarUrl?: string | null): string {
  return customAvatarUrl || getDefaultAvatar(address);
}
