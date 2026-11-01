/** How a card left the device: through its share sheet, or saved as a file where there is none for images. */
export type SharedCard = "shared" | "saved";

type CardSize = { width: number; height: number };

/**
 * A card node made into a PNG at its own size: the one image every way of sending the card uses. The library is loaded
 * only now, so it is no part of the page until the player asks for the image.
 */
const cardImage = async (card: HTMLElement, { width, height }: CardSize): Promise<Blob> => {
  const { domToBlob } = await import("modern-screenshot");
  return domToBlob(card, { width, height, scale: 1, type: "image/png" });
};

/**
 * The card's image handed to the device's share sheet with its line and address where the device shares images (a
 * phone), else saved as a file. A sheet the player closes counts as shared: the player chose not to send it.
 */
export const shareSeasonCard = async (
  card: HTMLElement,
  { line, url, ...size }: CardSize & { line: string; url: string },
): Promise<SharedCard> => {
  const file = new File([await cardImage(card, size)], "my-season.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    const sent = await navigator.share({ files: [file], text: line, url }).then(
      () => true,
      (error: unknown) => error instanceof DOMException && error.name === "AbortError",
    );
    if (sent) return "shared";
  }
  saveFile(file);
  return "saved";
};

/** Whether this browser's clipboard takes a PNG: only there is the card offered to copy. */
export const canCopyCard = (): boolean =>
  typeof ClipboardItem !== "undefined" &&
  typeof navigator.clipboard?.write === "function" &&
  ClipboardItem.supports?.("image/png") === true;

/**
 * The card's image put on the clipboard, to paste where the player posts. The image is handed over as it is being made,
 * so the clipboard is asked within the press itself, as Safari requires.
 */
export const copySeasonCard = (card: HTMLElement, size: CardSize): Promise<void> =>
  navigator.clipboard.write([new ClipboardItem({ "image/png": cardImage(card, size) })]);

const saveFile = (file: File) => {
  const href = URL.createObjectURL(file);
  const link = Object.assign(document.createElement("a"), { href, download: file.name });
  link.click();
  // The save reads the address after the click returns: it is let go once the save has it.
  setTimeout(() => URL.revokeObjectURL(href), 1_000);
};
