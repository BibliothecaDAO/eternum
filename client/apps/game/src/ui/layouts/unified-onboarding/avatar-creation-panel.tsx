import {
  getDefaultAvatar,
  useAvatarHistory,
  useGenerateAvatar,
  useMyAvatar,
  useSelectAvatar,
} from "@/hooks/use-player-avatar";
import Button from "@/ui/design-system/atoms/button";
import TextInput from "@/ui/design-system/atoms/text-input";
import { AvatarImageGrid } from "@/ui/features/avatars/avatar-image-grid";
import { Loader2, SkipForward, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AvatarCreationPanelProps {
  playerId: string;
  walletAddress: string;
  displayName: string;
  onComplete: () => void;
}

export const AvatarCreationPanel = ({ playerId, walletAddress, displayName, onComplete }: AvatarCreationPanelProps) => {
  const [prompt, setPrompt] = useState("");
  const [lastGeneratedImages, setLastGeneratedImages] = useState<string[]>([]);
  const { data: myAvatar, isLoading: isLoadingAvatar } = useMyAvatar(playerId, walletAddress, displayName);
  const { data: avatarHistory } = useAvatarHistory(playerId, walletAddress, displayName, 1);

  const generateAvatar = useGenerateAvatar(playerId, walletAddress, displayName);
  const selectAvatar = useSelectAvatar(playerId, walletAddress, displayName);
  const hasDisplayName = Boolean(displayName);

  const handleGenerate = async () => {
    if (!prompt.trim() || !hasDisplayName) return;

    try {
      const result = await generateAvatar.mutateAsync({ prompt: prompt.trim() });
      setLastGeneratedImages(result.imageUrls ?? []);
      setPrompt("");
    } catch (error) {
      console.error("Failed to generate avatar:", error);
    }
  };

  const handleSelectAvatar = async (imageUrl: string) => {
    if (!imageUrl || imageUrl === myAvatar?.avatarUrl) {
      return;
    }

    try {
      await selectAvatar.mutateAsync(imageUrl);
      toast.success("Avatar updated.");
    } catch (error: any) {
      console.error("Failed to set avatar:", error);
      toast.error(error?.message || "Failed to set avatar.");
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  // Check if we're waiting for displayName to load or avatar query to complete
  const isLoadingAvatarOrAccount = isLoadingAvatar;

  const currentAvatarUrl = myAvatar?.avatarUrl || getDefaultAvatar(playerId);
  const hasCustomAvatar = !!myAvatar?.avatarUrl;
  const latestGeneratedImages = (() => {
    if (lastGeneratedImages.length > 0) {
      return lastGeneratedImages;
    }

    const historyEntry = avatarHistory?.[0];
    if (!historyEntry) {
      return [];
    }

    if (historyEntry.imageUrls && historyEntry.imageUrls.length > 0) {
      return historyEntry.imageUrls;
    }

    if (historyEntry.imageUrl) {
      return [historyEntry.imageUrl];
    }

    return [];
  })();

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gold">Create Your Avatar</h2>
        <p className="text-sm text-gold/60 mt-1">Personalize your identity with an AI-generated avatar (optional)</p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="space-y-6">
          {/* Avatar Preview */}
          <div className="flex justify-center">
            <div className="relative">
              {isLoadingAvatarOrAccount ? (
                <div className="w-32 h-32 rounded-full bg-gold/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gold" />
                </div>
              ) : (
                <img
                  src={currentAvatarUrl}
                  alt="Your avatar"
                  className="w-32 h-32 rounded-full border-2 border-gold/30 object-cover"
                />
              )}
              {generateAvatar.isPending && (
                <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gold" />
                </div>
              )}
            </div>
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs text-gold/60 block">
              Describe your avatar (e.g., "cyberpunk warrior with glowing eyes")
            </label>
            <TextInput
              value={prompt}
              onChange={(value) => setPrompt(value)}
              placeholder="Enter a description..."
              className="w-full"
              disabled={generateAvatar.isPending}
              maxLength={500}
            />
            {prompt.length > 400 && <p className="text-xs text-gold/40">{500 - prompt.length} characters remaining</p>}
          </div>

          {/* Generation Limit Info */}
          {myAvatar && myAvatar.generationCount !== undefined && (
            <div className="text-xs text-gold/40 text-center">
              {myAvatar.generationCount} / 1 weekly generation used
            </div>
          )}

          {/* Error Message */}
          {generateAvatar.isError && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
              {generateAvatar.error?.message || "Failed to generate avatar. Please try again."}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              className="w-full rounded-md shadow-md !h-14"
              size="lg"
              forceUppercase={false}
              variant="gold"
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateAvatar.isPending || !hasDisplayName}
            >
              <div className="flex items-center justify-center w-full">
                {generateAvatar.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    <span>{hasCustomAvatar ? "Regenerate Avatar" : "Generate Avatar"}</span>
                  </>
                )}
              </div>
            </Button>

            <Button
              className="w-full rounded-md shadow-md !h-14"
              size="lg"
              forceUppercase={false}
              variant="outline"
              onClick={handleSkip}
              disabled={generateAvatar.isPending}
            >
              <div className="flex items-center justify-center w-full">
                <SkipForward className="w-5 h-5 mr-2" />
                <span>{hasCustomAvatar ? "Continue" : "Skip for Now"}</span>
              </div>
            </Button>
          </div>

          {latestGeneratedImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gold/50 text-center">Select your avatar</p>
              <AvatarImageGrid
                images={latestGeneratedImages}
                selectedUrl={myAvatar?.avatarUrl}
                onSelect={handleSelectAvatar}
                isSelecting={selectAvatar.isPending}
                className="max-w-xs mx-auto"
              />
            </div>
          )}

          {!hasDisplayName && (
            <p className="text-xs text-yellow-400/80 text-center">
              Connect with Cartridge to create a custom avatar.
            </p>
          )}

          {/* Info Text */}
          <p className="text-xs text-gold/40 text-center">
            You can generate one set of avatars per week. Skip to use a default avatar.
          </p>
        </div>
      </div>
    </div>
  );
};
