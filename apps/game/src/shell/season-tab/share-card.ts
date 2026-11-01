/** How a card left the device: through its share sheet, or saved as a file where there is none for images. */
export type SharedCard = "shared" | "saved";

/**
 * A card node made into a PNG at its own size, the library loaded only now (it is no part of the page until Share is
 * pressed), then handed to the device's share sheet with its line and address where the device shares images (a
 * phone), else saved as a file. A sheet the player closes counts as shared: the player chose not to send it.
 */
export const shareSeasonCard = async (
  card: HTMLElement,
  { width, height, line, url }: { width: number; height: number; line: string; url: string },
): Promise<SharedCard> => {
  const { domToBlob } = await import("modern-screenshot");
  const image = await domToBlob(card, { width, height, scale: 1, type: "image/png" });
  const file = new File([image], "my-season.png", { type: "image/png" });
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

const saveFile = (file: File) => {
  const href = URL.createObjectURL(file);
  const link = Object.assign(document.createElement("a"), { href, download: file.name });
  link.click();
  // The save reads the address after the click returns: it is let go once the save has it.
  setTimeout(() => URL.revokeObjectURL(href), 1_000);
};
