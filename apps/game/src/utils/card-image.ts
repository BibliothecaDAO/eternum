export type CardSize = { width: number; height: number };

/**
 * A card node made into an image at its own size: a PNG for every way the player sends it, a JPEG where a link's
 * unfurl shows it (lighter, as an unfurl's crawler fetches it). The library is loaded only now, so it is no part of the
 * page until an image is asked for.
 */
const cardImage = async (
  card: HTMLElement,
  { width, height }: CardSize,
  type: "image/png" | "image/jpeg" = "image/png",
): Promise<Blob> => {
  const { domToBlob } = await import("modern-screenshot");
  // The image is the cards as they settle, never mid-flip: their motion is held while it is made.
  card.toggleAttribute("data-still", true);
  try {
    return await domToBlob(card, { width, height, scale: 1, type, quality: 0.9 });
  } finally {
    card.toggleAttribute("data-still", false);
  }
};

/** The card as a JPEG, the image a shared link unfurls as. */
export const cardJpeg = (card: HTMLElement, size: CardSize): Promise<Blob> => cardImage(card, size, "image/jpeg");

/** The card's image saved as a file, where the clipboard takes no PNG: the player adds it to the post themselves. */
export const saveCardImage = async (card: HTMLElement, size: CardSize, fileName: string): Promise<void> =>
  saveFile(new File([await cardImage(card, size)], fileName, { type: "image/png" }));

/** Whether this browser's clipboard takes a PNG: only there is the card offered to copy. */
export const canCopyCard = (): boolean =>
  typeof ClipboardItem !== "undefined" &&
  typeof navigator.clipboard?.write === "function" &&
  ClipboardItem.supports?.("image/png") === true;

/**
 * The card's image put on the clipboard, to paste where the player posts. The image is handed over as it is being made,
 * so the clipboard is asked within the press itself, as Safari requires.
 */
export const copyCardImage = (card: HTMLElement, size: CardSize): Promise<void> =>
  navigator.clipboard.write([new ClipboardItem({ "image/png": cardImage(card, size) })]);

const saveFile = (file: File) => {
  const href = URL.createObjectURL(file);
  const link = Object.assign(document.createElement("a"), { href, download: file.name });
  link.click();
  // The save reads the address after the click returns: it is let go once the save has it.
  setTimeout(() => URL.revokeObjectURL(href), 1_000);
};
