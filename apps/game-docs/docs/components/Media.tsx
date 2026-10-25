/**
 * The pages' videos and screenshots, captured by scripts/capture-media.mjs into the game's public `docs-media` folder
 * (the build ships each file a page names). A video plays muted, looped and inline over a poster of its first frame; a
 * phone capture, or a panel cropped out of a page, stands narrower than a desktop one; a wide capture keeps its own shape.
 */
type Frame = "desktop" | "phone" | "panel" | "wide";

const MEDIA = "/docs-media";

export const Video = ({ name, caption, frame = "desktop" }: { name: string; caption: string; frame?: Frame }) => (
  <figure className={`docs-media docs-media-${frame}`}>
    <video
      src={`${MEDIA}/${name}.mp4`}
      poster={`${MEDIA}/${name}.webp`}
      muted
      loop
      autoPlay
      playsInline
      controls
      preload="metadata"
      aria-label={caption}
    />
    <figcaption>{caption}</figcaption>
  </figure>
);

export const Shot = ({ name, caption, frame = "desktop" }: { name: string; caption: string; frame?: Frame }) => (
  <figure className={`docs-media docs-media-${frame}`}>
    <img src={`${MEDIA}/${name}.webp`} alt={caption} loading="lazy" />
    <figcaption>{caption}</figcaption>
  </figure>
);
