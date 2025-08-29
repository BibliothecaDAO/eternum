import { useEffect, useState } from "react";

interface VideoPreloadStatus {
  [key: string]: {
    loaded: boolean;
    progress: number;
    error: boolean;
  };
}

export const useVideoPreloader = (videos: Record<string, string>) => {
  const [loadingStatus, setLoadingStatus] = useState<VideoPreloadStatus>({});
  const [allVideosLoaded, setAllVideosLoaded] = useState(false);

  useEffect(() => {
    const videoEntries = Object.entries(videos);
    const totalVideos = videoEntries.length;
    let loadedCount = 0;

    // Initialize loading status
    const initialStatus: VideoPreloadStatus = {};
    videoEntries.forEach(([key]) => {
      initialStatus[key] = { loaded: false, progress: 0, error: false };
    });
    setLoadingStatus(initialStatus);

    // Preload each video
    videoEntries.forEach(([key, url]) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;

      // Track loading progress
      video.addEventListener("progress", () => {
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const duration = video.duration;
          if (duration > 0) {
            const progress = (bufferedEnd / duration) * 100;
            setLoadingStatus((prev) => ({
              ...prev,
              [key]: { ...prev[key], progress },
            }));
          }
        }
      });

      // Handle when video is fully loaded
      video.addEventListener("canplaythrough", () => {
        loadedCount++;
        setLoadingStatus((prev) => ({
          ...prev,
          [key]: { loaded: true, progress: 100, error: false },
        }));

        if (loadedCount === totalVideos) {
          setAllVideosLoaded(true);
          console.log("All chest videos preloaded successfully");
        }
      });

      // Handle errors
      video.addEventListener("error", () => {
        console.error(`Failed to preload video: ${key}`);
        setLoadingStatus((prev) => ({
          ...prev,
          [key]: { loaded: false, progress: 0, error: true },
        }));
      });

      // Start loading
      video.src = url;
      video.load();

      // Store video element in a cache for potential reuse
      (window as any).__videoCache = (window as any).__videoCache || {};
      (window as any).__videoCache[url] = video;
    });

    return () => {
      // Cleanup: remove event listeners
      videoEntries.forEach(([, url]) => {
        const video = (window as any).__videoCache?.[url];
        if (video) {
          video.removeEventListener("progress", () => {});
          video.removeEventListener("canplaythrough", () => {});
          video.removeEventListener("error", () => {});
        }
      });
    };
  }, [videos]);

  // Calculate overall loading progress
  const overallProgress = Object.values(loadingStatus).reduce((acc, status) => acc + status.progress, 0) / Object.keys(loadingStatus).length || 0;

  return {
    loadingStatus,
    allVideosLoaded,
    overallProgress,
  };
};