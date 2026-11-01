import { readFileSync, writeFileSync } from "node:fs";

const output = new URL("../../public/sound/units/army-selection.wav", import.meta.url);
const sampleRate = 44_100;
const duration = 0.16;

/** A short fabric drag settling into two damped, inharmonic buckle contacts. */
function renderFoley() {
  const samples = new Float64Array(Math.round(sampleRate * duration));
  let seed = 0x51a9;
  let fabric = 0;
  let rumble = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 0x100000000) * 2 - 1;
    fabric += 0.28 * (noise - fabric);
    rumble += 0.025 * (fabric - rumble);
    const drag = Math.sin(Math.PI * Math.min(1, t / 0.13)) ** 2;
    const contact = buckle(t - 0.058) + 0.45 * buckle(t - 0.092);
    const edge = Math.min(1, t / 0.004, (duration - t - 1 / sampleRate) / 0.012);
    samples[i] = ((fabric - rumble) * drag + contact) * Math.max(0, edge);
  }
  const peak = Math.max(...samples.map(Math.abs));
  return Int16Array.from(samples, (sample) => Math.round((sample / peak) * 0.25 * 32767));
}

function buckle(t) {
  if (t < 0) return 0;
  const attack = Math.min(1, t / 0.002);
  return (
    attack *
    (0.28 * Math.sin(2 * Math.PI * 620 * t) * Math.exp(-t / 0.009) +
      0.12 * Math.sin(2 * Math.PI * 1417 * t) * Math.exp(-t / 0.006) +
      0.06 * Math.sin(2 * Math.PI * 2381 * t) * Math.exp(-t / 0.004))
  );
}

function encodeWave(samples) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => wav.writeInt16LE(sample, 44 + index * 2));
  return wav;
}

const wav = encodeWave(renderFoley());
if (process.argv.includes("--check")) {
  if (!readFileSync(output).equals(wav))
    throw new Error("Rebuild army selection: node asset-sources/army-selection/build.mjs");
} else {
  writeFileSync(output, wav);
}
