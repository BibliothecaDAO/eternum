import { toPng } from "html-to-image";

type CopyElementAsPngResult = "copied" | "downloaded";

interface CopyElementAsPngOptions {
  element: HTMLElement;
  filename: string;
  backgroundColor?: string;
  pixelRatio?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  renderWidth?: number;
  renderHeight?: number;
}

const waitForFontsReady = async (): Promise<void> => {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return;
  }

  try {
    await document.fonts.ready;
  } catch {
    // Continue capture when font readiness cannot be determined.
  }
};

export const copyElementAsPng = async ({
  element,
  filename,
  backgroundColor = "#030d14",
  pixelRatio = 2,
  canvasWidth,
  canvasHeight,
  renderWidth,
  renderHeight,
}: CopyElementAsPngOptions): Promise<CopyElementAsPngResult> => {
  await waitForFontsReady();

  const style: Record<string, string> = {};
  if (typeof renderWidth === "number") {
    style.width = `${renderWidth}px`;
  }
  if (typeof renderHeight === "number") {
    style.height = `${renderHeight}px`;
  }

  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio,
    backgroundColor,
    canvasWidth,
    canvasHeight,
    style: Object.keys(style).length > 0 ? style : undefined,
  });

  const blob = await fetch(dataUrl).then((response) => response.blob());

  if (typeof window !== "undefined" && "ClipboardItem" in window && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "copied";
    } catch {
      // Fallback to download when clipboard write fails.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Downloading images is not supported in this environment.");
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  return "downloaded";
};

export const openShareOnX = (text: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const shareIntent = new URL("https://twitter.com/intent/tweet");
  shareIntent.searchParams.set("text", text);
  window.open(shareIntent.toString(), "_blank", "noopener,noreferrer");
  return true;
};
