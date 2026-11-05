// How an email header letters its title, for scripts/build-email-art.mjs and for the test that every title fits: one
// size of the brand's heading face, from the left margin, with the same margin kept on the right. A title that would
// run into that margin is refused, so no header is ever drawn with its title cut by the edge.
import sharp from "sharp";
import { BRAND, headingFontFile } from "./email-art-inputs.mjs";

/** The header's size: drawn at 600 px in the email, twice the pixels for sharp phones. */
export const HEADER = { width: 1200, height: 640 };
/** The title's distance from the header's left edge, and the least it keeps from the right edge. */
export const TITLE_MARGIN = 72;
const TITLE_ROOM = HEADER.width - 2 * TITLE_MARGIN;

/** The title lettered in the heading face, as a PNG with its measured size. */
export const letterTitle = async (title, colour) =>
  sharp({
    text: {
      text: `<span foreground="${colour}">${title}</span>`,
      font: `${BRAND.faces.display.family} 84`,
      fontfile: headingFontFile().pathname,
      dpi: 96,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

/** Each email whose lettered title is wider than the room between the margins, with its width and that room. */
export const titlesTooWide = async (art) => {
  const tooWide = [];
  for (const [id, { title }] of Object.entries(art)) {
    const { info } = await letterTitle(title, BRAND.colors.gold2);
    if (info.width > TITLE_ROOM) tooWide.push({ id, title, width: info.width, room: TITLE_ROOM });
  }
  return tooWide;
};
