import { useState } from "react";
import { AnimatedMap } from "@/components/icons/AnimatedMap";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/utils";
import { env } from "env";

//import { cn } from "@realms-world/utils";
//import { Skeleton } from "@realms-world/ui/components/ui/skeleton";
//import { AnimatedMap } from "./AnimatedMap";

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

  // Handle IPFS URL transformation
  if (src?.startsWith("ipfs://")) {
    const ipfsGateway = env.VITE_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";
    const transformedUrl = src.replace("ipfs://", ipfsGateway);
    console.log("Transforming IPFS URL:", src, "to:", transformedUrl);
    return transformedUrl;
  }

  return src;
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

export default function Media({
  mediaKey,
  thumbnailKey,
  alt,
  className,
  src,
  width = 600,
  height = 600,
  //priority = false,
}: MediaProps) {
  const [status, setStatus] = useState<"loading" | "error" | "loaded">(
    "loading",
  );
  const mediaSrc = getMediaSrc(src, mediaKey, thumbnailKey, width, height);
  const mediaFormat = mediaSrc?.split(".").pop() === "mp4" ? "video" : "image";

  if (!mediaSrc || status === "error") {
    return <MediaPlaceholder className={className} />;
  }

  if (mediaFormat === "video") {
    return (
      <video autoPlay className={cn("shrink-0", className)} loop muted>
        <source src={mediaSrc} type="video/mp4" />
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
          onError={() => setStatus("error")}
          onLoadStart={() => setStatus("loading")}
          onLoad={() => setStatus("loaded")}
          src={mediaSrc}
          height={height}
          width={width}
        />
      </div>
    </>
  );
}
