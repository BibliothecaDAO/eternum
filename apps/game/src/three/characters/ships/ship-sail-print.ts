import { CanvasTexture, SRGBColorSpace } from "three";
import type { ShipArmyClass } from "./ship-design";

export const SAIL_STRIPE_U = { start: 150 / 512, end: 362 / 512 } as const;

export type SailPrint = "army" | "crown" | "chevron" | "sun";
export interface SailIdentity {
  army: ShipArmyClass;
  color: string;
  print: SailPrint;
  ink?: string;
}

/** One texture can be shared by every ship belonging to the same player. */
export function createSailPrint(identity: SailIdentity, artwork?: ImageBitmap): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sail print canvas is unavailable");
  paintLinen(ctx, identity.color);
  if (artwork) {
    const scale = 240 / Math.max(artwork.width, artwork.height);
    const width = artwork.width * scale,
      height = artwork.height * scale;
    ctx.drawImage(artwork, 256 - width / 2, 276 - height / 2, width, height);
  } else
    paintEmblem(
      ctx,
      identity.print === "army" ? identity.army : identity.print,
      identity.ink ?? "#e9bb58",
      256,
      265,
      1,
    );
  // A permanent class badge keeps army type legible when the center carries a player's custom print.
  paintEmblem(ctx, identity.army, identity.ink ?? "#e9bb58", 256, 440, 0.22);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 4;
  texture.name = `${identity.army}-${identity.print}-${identity.color}-sail`;
  return texture;
}

function paintLinen(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = "#f5f3ed";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#a9937020";
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fillRect(SAIL_STRIPE_U.start * 512, 0, (SAIL_STRIPE_U.end - SAIL_STRIPE_U.start) * 512, 512);
  ctx.strokeStyle = "#c3a35b";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 496, 496);
  ctx.strokeStyle = "#84745435";
  ctx.lineWidth = 1;
  for (let x = 85; x < 500; x += 85) {
    ctx.beginPath();
    ctx.moveTo(x, 32);
    ctx.lineTo(x, 480);
    ctx.stroke();
  }
}

function paintEmblem(
  ctx: CanvasRenderingContext2D,
  emblem: ShipArmyClass | SailPrint,
  color: string,
  x: number,
  y: number,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineWidth = 15;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (emblem === "paladin" || emblem === "sun") paintSun(ctx);
  else if (emblem === "crossbowman") paintCrossbow(ctx);
  else if (emblem === "crown") paintCrown(ctx);
  else if (emblem === "chevron") paintChevron(ctx);
  else paintKnight(ctx);
  ctx.restore();
}

function stroke(ctx: CanvasRenderingContext2D, points: number[][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function paintSun(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.arc(0, 0, 49, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    stroke(ctx, [
      [Math.cos(angle) * 66, Math.sin(angle) * 66],
      [Math.cos(angle) * 91, Math.sin(angle) * 91],
    ]);
  }
}
function paintCrossbow(ctx: CanvasRenderingContext2D) {
  stroke(ctx, [
    [0, -95],
    [0, 90],
  ]);
  stroke(ctx, [
    [-88, 4],
    [-64, -45],
    [0, -67],
    [64, -45],
    [88, 4],
  ]);
  ctx.lineWidth = 4;
  stroke(ctx, [
    [-88, 4],
    [0, 50],
    [88, 4],
  ]);
  ctx.lineWidth = 15;
  stroke(ctx, [
    [-17, -68],
    [0, -95],
    [17, -68],
  ]);
}
function paintKnight(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-73, -71);
  ctx.quadraticCurveTo(0, -102, 73, -71);
  ctx.lineTo(62, 27);
  ctx.quadraticCurveTo(46, 68, 0, 96);
  ctx.quadraticCurveTo(-46, 68, -62, 27);
  ctx.closePath();
  ctx.stroke();
  stroke(ctx, [
    [0, -65],
    [0, 60],
  ]);
  stroke(ctx, [
    [-38, -18],
    [38, -18],
  ]);
  stroke(ctx, [
    [-16, -45],
    [0, -66],
    [16, -45],
  ]);
}
function paintCrown(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-88, -54);
  ctx.lineTo(-68, 58);
  ctx.lineTo(68, 58);
  ctx.lineTo(88, -54);
  ctx.lineTo(40, -11);
  ctx.lineTo(0, -83);
  ctx.lineTo(-40, -11);
  ctx.closePath();
  ctx.fill();
  stroke(ctx, [
    [-63, 79],
    [63, 79],
  ]);
}
function paintChevron(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = 22;
  stroke(ctx, [
    [-79, 8],
    [0, -66],
    [79, 8],
  ]);
  stroke(ctx, [
    [-79, 69],
    [0, -5],
    [79, 69],
  ]);
}
