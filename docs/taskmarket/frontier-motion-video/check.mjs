#!/usr/bin/env node
/**
 * Checks a film against spec.json: its container, size, frame rate and length, that it opens on the locked start
 * frame and holds the locked end frame to its close. Needs ffmpeg and ffprobe on PATH.
 *
 *   node check.mjs film.mp4
 *
 * Prints one JSON report and exits non-zero when any check fails.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(here, "spec.json"), "utf8"));

const film = process.argv[2];
if (!film) {
  console.error("usage: node check.mjs <film.mp4>");
  process.exit(2);
}

const probe = probeFilm(film);
const cut = resolveCut(probe.video);
const checks = cut ? [...checkFormat(probe, cut), checkStartFrame(cut), checkEndHold(probe, cut)] : [];
const report = {
  film,
  cut: cut?.name ?? null,
  pass: Boolean(cut) && checks.every((check) => check.pass),
  checks: cut
    ? checks
    : [{ name: "size", pass: false, detail: `${probe.video.width}x${probe.video.height} is no cut` }],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);

function probeFilm(path) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path]);
  const { streams, format } = JSON.parse(out.toString());
  return {
    video: streams.find((stream) => stream.codec_type === "video"),
    audio: streams.find((stream) => stream.codec_type === "audio"),
    durationSeconds: Number(format.duration),
    megabytes: statSync(path).size / 1e6,
  };
}

function resolveCut(video) {
  const match = Object.entries(spec.cuts).find(([, cut]) => cut.width === video.width && cut.height === video.height);
  return match && { name: match[0], ...match[1] };
}

function checkFormat({ video, audio, durationSeconds, megabytes }, cut) {
  const [num, den] = video.r_frame_rate.split("/").map(Number);
  const fps = num / den;
  const { min, max } = spec.durationSeconds;
  return [
    result("video codec", video.codec_name === spec.videoCodec, video.codec_name),
    result("audio codec", audio?.codec_name === spec.audioCodec, audio?.codec_name ?? "no audio"),
    result("size", true, `${cut.width}x${cut.height}`),
    result("fps", Math.abs(fps - spec.fps) < 0.01, fps.toFixed(2)),
    result("duration", durationSeconds >= min && durationSeconds <= max, `${durationSeconds.toFixed(2)}s`),
    result("file size", megabytes <= spec.maxMegabytes, `${megabytes.toFixed(1)} MB`),
  ];
}

function checkStartFrame(cut) {
  const similarity = frameSimilarity(["-i", film], cut.startFrame, "trim=end_frame=1");
  return result("start frame", similarity >= spec.minFrameSimilarity, `ssim ${similarity.toFixed(3)}`);
}

function checkEndHold(probe, cut) {
  const holdStart = probe.durationSeconds - spec.endFrameHoldSeconds;
  const similarity = frameSimilarity(["-ss", String(holdStart), "-i", film], cut.endFrame, "null");
  return result(
    `end frame held ${spec.endFrameHoldSeconds}s`,
    similarity >= spec.minFrameSimilarity,
    `lowest ssim ${similarity.toFixed(3)}`,
  );
}

/** The lowest SSIM between the film's selected frames and a still. */
function frameSimilarity(filmInput, still, selectFrames) {
  const stillInput = ["-loop", "1", "-i", join(here, still)];
  const graph = `[0:v]${selectFrames}[film];[1:v]scale=out_range=tv[still];[film][still]ssim=stats_file=-`;
  const compare = ["-filter_complex", graph, "-shortest", "-f", "null", "-"];
  const out = execFileSync("ffmpeg", ["-v", "error", ...filmInput, ...stillInput, ...compare], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
  const scores = [...out.matchAll(/All:([\d.]+)/g)].map((match) => Number(match[1]));
  return scores.length ? Math.min(...scores) : 0;
}

function result(name, pass, detail) {
  return { name, pass, detail };
}
