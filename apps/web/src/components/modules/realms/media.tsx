import { useEffect, useRef, useState } from "react";
import { AnimatedMap } from "@/components/icons/AnimatedMap";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_IPFS_GATEWAY,
  getMediaRetryDelayMs,
  getNextMediaLoadAttempt,
  resolveIpfsMediaUrl,
  withMediaRetryAttempt,
} from "@/lib/media-url";
import { cn } from "@/utils/utils";
import { env } from "env";
import { ImageOff } from "lucide-react";

interface MediaProps {
  // key used to access the image proxy / CDN
  mediaKey?: string | null;
  thumbnailKey?: string | null;
  alt: string;
  src?: string | null;
  width?: number;
  height?: number;
  //priority?: boolean;
  className?: string;
}

function getMediaSrc(
  src?: string | null,
  mediaKey?: string | null,
  thumbnailKey?: string | null,
  width?: number,
  height?: number,
) {
  if (thumbnailKey) {
    return `${env.VITE_PUBLIC_IMAGE_CDN_URL}/${thumbnailKey}`;
  }

  if (mediaKey && width && height) {
    const resolutionParam = `:${width}:${height}`;
    return `${env.VITE_PUBLIC_IMAGE_PROXY_URL}/_/rs:fit${resolutionParam}/plain/${env.VITE_PUBLIC_IMAGE_CDN_URL}/${mediaKey}`;
  }

  return src ? resolveIpfsMediaUrl(src, env.VITE_PUBLIC_IPFS_GATEWAY) : src;
}

function MediaPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-secondary flex shrink-0 items-center justify-center",
        className,
      )}
    >
      <AnimatedMap />
    </div>
  );
}

function MediaErrorPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-secondary text-muted-foreground flex aspect-square w-full shrink-0 items-center justify-center",
        className,
      )}
    >
      <ImageOff aria-hidden="true" className="h-8 w-8" />
      <span className="sr-only">Image unavailable</span>
    </div>
  );
}

function ResolvedMedia({
  alt,
  className,
  mediaSrc,
  fallbackSrc,
  width,
  height,
}: {
  alt: string;
  className?: string;
  mediaSrc: string;
  fallbackSrc: string;
  width: number;
  height: number;
}) {
  const [status, setStatus] = useState<"loading" | "error" | "loaded">(
    "loading",
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaSources = [mediaSrc, fallbackSrc].filter(
    (candidate, index, candidates): candidate is string =>
      !!candidate && candidates.indexOf(candidate) === index,
  );
  const activeBaseSrc = mediaSources[sourceIndex] ?? mediaSrc;
  const activeMediaSrc = withMediaRetryAttempt(activeBaseSrc, attempt);
  const mediaFormat =
    activeMediaSrc?.split(".").pop() === "mp4" ? "video" : "image";

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  if (status === "error") {
    return <MediaErrorPlaceholder className={className} />;
  }

  if (mediaFormat === "video") {
    return (
      <video autoPlay className={cn("shrink-0", className)} loop muted>
        <source src={activeMediaSrc} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <>
      <div className="relative shrink-0">
        {status === "loading" && (
          <Skeleton className="absolute inset-0 shrink-0" />
        )}
        <img
          /* unoptimized
                    priority={priority}*/
          alt={alt}
          className={cn("shrink-0", className)}
          decoding="async"
          loading="lazy"
          onError={() => {
            if (retryTimer.current) return;

            const nextSourceIndex = sourceIndex + 1;
            if (nextSourceIndex < mediaSources.length) {
              setSourceIndex(nextSourceIndex);
              setStatus("loading");
              return;
            }

            const nextAttempt = getNextMediaLoadAttempt(attempt);
            if (nextAttempt === null) {
              setStatus("error");
              return;
            }

            setStatus("loading");
            retryTimer.current = setTimeout(() => {
              retryTimer.current = null;
              setSourceIndex(0);
              setAttempt(nextAttempt);
            }, getMediaRetryDelayMs(attempt));
          }}
          onLoadStart={() => setStatus("loading")}
          onLoad={() => setStatus("loaded")}
          src={activeMediaSrc}
          height={height}
          width={width}
        />
      </div>
    </>
  );
}

export default function Media({
  mediaKey,
  thumbnailKey,
  alt,
  className,
  src,
  width = 600,
  height = 600,
}: MediaProps) {
  const mediaSrc = getMediaSrc(src, mediaKey, thumbnailKey, width, height);
  if (!mediaSrc) return <MediaPlaceholder className={className} />;

  const fallbackSrc = resolveIpfsMediaUrl(mediaSrc, DEFAULT_IPFS_GATEWAY);

  return (
    <ResolvedMedia
      key={`${mediaSrc}:${fallbackSrc}`}
      alt={alt}
      className={className}
      mediaSrc={mediaSrc}
      fallbackSrc={fallbackSrc}
      width={width}
      height={height}
    />
  );
}
