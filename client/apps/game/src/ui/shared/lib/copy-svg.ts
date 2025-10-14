import { toast } from "sonner";

export interface CopySvgToClipboardOptions {
  width: number;
  height: number;
  successMessage?: string;
  errorMessage?: string;
  unsupportedMessage?: string;
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to encode asset"));
    reader.readAsDataURL(blob);
  });

const inlineExternalImages = async (svgElement: SVGSVGElement) => {
  const inlineTasks = Array.from(svgElement.querySelectorAll("image")).map(async (imageNode) => {
    const href = imageNode.getAttribute("href") ?? imageNode.getAttribute("xlink:href");
    if (!href || href.startsWith("data:")) {
      return;
    }

    const absoluteHref = href.match(/^https?:/) ? href : new URL(href, window.location.origin).toString();
    const response = await fetch(absoluteHref, { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${href}`);
    }

    const blob = await response.blob();
    const dataUrl = await toDataUrl(blob);
    imageNode.setAttribute("href", dataUrl);
    imageNode.setAttribute("xlink:href", dataUrl);
  });

  await Promise.all(inlineTasks);
};

export const copySvgToClipboard = async (
  source: SVGSVGElement,
  {
    width,
    height,
    successMessage = "Image copied to clipboard.",
    errorMessage = "Unable to copy image to clipboard.",
    unsupportedMessage = "Copying images is not supported in this environment.",
  }: CopySvgToClipboardOptions,
) => {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("ClipboardItem" in window) ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== "function"
  ) {
    toast.error(unsupportedMessage);
    throw new Error("Clipboard API is not available");
  }

  if (!source) {
    toast.error(errorMessage);
    throw new Error("SVG element is not available");
  }

  let objectUrl: string | null = null;

  try {
    if (typeof document !== "undefined") {
      const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (fontSet && "ready" in fontSet) {
        try {
          await fontSet.ready;
        } catch (error) {
          console.warn("Font loading check failed", error);
        }
      }
    }

    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

    await inlineExternalImages(clone);

    const serializer = new XMLSerializer();
    const svgMarkup = serializer.serializeToString(clone);
    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    objectUrl = URL.createObjectURL(svgBlob);

    const image = new Image();
    const scale = window.devicePixelRatio || 2;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load SVG image"));

      if (!objectUrl) {
        reject(new Error("Failed to create image URL"));
        return;
      }

      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to acquire canvas context");
    }

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png");
    });

    if (!blob) {
      throw new Error("Failed to encode PNG blob");
    }

    const ClipboardItemConstructor = (window as typeof window & { ClipboardItem: typeof ClipboardItem }).ClipboardItem;
    await navigator.clipboard.write([new ClipboardItemConstructor({ [blob.type]: blob })]);
    toast.success(successMessage);
  } catch (error) {
    console.error("copySvgToClipboard", error);
    toast.error(errorMessage);
    throw error;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
};
