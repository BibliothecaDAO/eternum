"""Frame approved footage with brand cards and lay in a picture-length score."""
import argparse
import hashlib
import json
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont

RATE = 48000
FRAME_COUNT = 481
FPS = 24
SIZE = (1280, 720)
REALMS = "01-Logos/Realms/Lettered/realms-lettered-ink.png"
LOCKUP = "01-Logos/Frontier/Transparent/frontier-lockup.png"
HEADING = "02-Fonts/IM-Fell-English-SC/IMFellEnglishSC-Regular.ttf"
BODY = "02-Fonts/Exo-2/Exo2-Regular.ttf"


def run(args):
    return subprocess.run(args, check=True, capture_output=True)


def ffmpeg(args):
    return run(["ffmpeg", "-hide_banner", "-nostats", "-y", "-threads", "2",
                "-filter_threads", "2", "-filter_complex_threads", "2", *map(str, args)])


def probe(path):
    return json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                           "-of", "json", str(path)]).stdout)


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def measure_loudness(path):
    result = ffmpeg(["-i", path, "-map", "0:a:0", "-af",
                     "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    log = result.stderr.decode()
    value = json.JSONDecoder().raw_decode(log[log.rfind("{"):])[0]
    return {"integratedLufs": float(value["input_i"]),
            "truePeakDbtp": float(value["input_tp"]), "rangeLu": float(value["input_lra"])}


def trim_score(source, duration, folder):
    target = folder / "score-trimmed.wav"
    ffmpeg(["-v", "error", "-i", source, "-map", "0:a:0", "-t", duration,
            "-ar", RATE, "-ac", 2, "-c:a", "pcm_s24le", target])
    with wave.open(str(target), "rb") as audio:
        samples = audio.getnframes()
    if samples != round(duration * RATE):
        raise ValueError(f"Score must cover {duration:.3f} seconds. Supply the picture-length score; "
                         "short music is not stretched, looped or padded.")
    return target


def master_music(raw, duration, folder):
    gain = -14 - measure_loudness(raw)["integratedLufs"]
    target = folder / "master.wav"
    passes = []
    for _ in range(5):
        filters = (f"volume={gain}dB,aresample=192000,"
                   "alimiter=limit=0.794328:attack=5:release=60:level=false:latency=true,"
                   f"aresample=48000,afade=t=in:d=0.008,afade=t=out:st={duration-.06}:d=0.06")
        ffmpeg(["-v", "error", "-i", raw, "-af", filters, "-t", duration,
                "-ar", RATE, "-c:a", "pcm_s24le", target])
        metrics = measure_loudness(target)
        passes.append({"gainDb": gain, **metrics})
        error = -14 - metrics["integratedLufs"]
        if abs(error) < .1:
            break
        gain += error
    assert abs(metrics["integratedLufs"] + 14) < .2
    save_json(folder / "mastering.json", passes)
    return target


def centred_text(image, text, y, font_path, size, colour):
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(font_path), size)
    assert draw.textlength(text, font=font) < image.width * .85
    draw.text((image.width / 2, y), text, anchor="mm", font=font, fill=colour)


def make_card(kit, size, plan, target):
    width = size[0]
    palette = json.loads((kit / "03-Colors/palette.json").read_text())
    ground = ImageColor.getrgb(palette["brand"]["hearth"])
    card = Image.new("RGBA", size, (*ground, 204))
    logo = Image.open(kit / LOCKUP).convert("RGBA")
    logo_width = 720
    logo = logo.resize((logo_width, round(logo.height * logo_width / logo.width)), Image.Resampling.LANCZOS)
    card.alpha_composite(logo, ((width - logo_width) // 2, 0))
    centred_text(card, plan["line"], 515, kit / HEADING,
                 36, palette["brand"]["parchment"])
    centred_text(card, plan["cta"], 585, kit / BODY,
                 30, palette["games"]["frontier"]["title"])
    card.save(target)


def make_intro_card(kit, size, target):
    card = Image.new("RGBA", size, (0, 0, 0, 0))
    logo = Image.open(kit / REALMS).convert("RGBA")
    width = 120
    logo = logo.resize((width, round(logo.height * width / logo.width)), Image.Resampling.LANCZOS)
    position = (size[0] - width - 36, 36)
    card.alpha_composite(logo, position)
    card.save(target)


def render_picture(source, size, plan, folder):
    hold_frames = plan["holdFrames"]
    total_frames = FRAME_COUNT + hold_frames
    card_start = plan["lockupFullFrame"] / FPS - 1
    make_card(plan["kit"], size, plan, folder / "card.png")
    make_intro_card(plan["kit"], size, folder / "intro-card.png")
    graph = (
        "[0:v]pad=1280:720:0:8:color=0x14101D,setsar=1,"
        f"tpad=stop_mode=clone:stop={hold_frames}[held];"
        "[1:v]format=rgba,fade=t=out:st=0:d=2:alpha=1[intro];"
        "[held][intro]overlay=0:0:shortest=1:format=auto[sequence];"
        f"[2:v]format=rgba,fade=t=in:st={card_start}:d=1:alpha=1[card];"
        "[sequence][card]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]"
    )
    target = folder / "picture.mp4"
    ffmpeg(["-v", "error", "-i", source, "-loop", 1, "-framerate", FPS,
            "-i", folder / "intro-card.png", "-loop", 1, "-framerate", FPS,
            "-i", folder / "card.png", "-filter_complex", graph, "-map", "[v]", "-an",
            "-frames:v", total_frames, "-c:v", "libx264", "-preset", "slow", "-crf", 18,
            "-threads", 2, "-movflags", "+faststart", target])
    return target


def deliver_film(picture, score, target, duration, size, frame_count):
    partial = target.with_suffix(".partial.mp4")
    if score:
        ffmpeg(["-v", "error", "-i", picture, "-i", score, "-map", "0:v:0", "-map", "1:a:0",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", RATE,
                "-t", duration, "-movflags", "+faststart", partial])
    else:
        ffmpeg(["-v", "error", "-i", picture, "-map", "0:v:0", "-c:v", "copy",
                "-an", "-movflags", "+faststart", partial])
    info = probe(partial)
    video = next(stream for stream in info["streams"] if stream["codec_type"] == "video")
    assert (video["width"], video["height"]) == size
    assert video["codec_name"] == "h264" and video["avg_frame_rate"] == f"{FPS}/1"
    assert int(video["nb_frames"]) == frame_count
    assert abs(float(info["format"]["duration"]) - duration) < 1 / FPS
    metrics = {}
    if score:
        audio = next(stream for stream in info["streams"] if stream["codec_type"] == "audio")
        assert audio["codec_name"] == "aac"
        metrics = measure_loudness(partial)
        assert abs(metrics["integratedLufs"] + 14) < .25 and metrics["truePeakDbtp"] <= -1
    else:
        assert len(info["streams"]) == 1
    ffmpeg(["-v", "error", "-i", partial, "-f", "null", "-"])
    partial.replace(target)
    return {"file": target.name, "width": size[0], "height": size[1], "seconds": duration,
            "frameCount": frame_count, "hasAudio": bool(score), "sha256": digest(target),
            "bytes": target.stat().st_size, **metrics}


def capture_checks(picture, plan, folder):
    for name, second in plan["reviewFrames"].items():
        ffmpeg(["-v", "error", "-ss", second, "-i", picture,
                "-frames:v", 1, "-threads", 2, folder / f"{name}.png"])


def finish(args):
    args.out.mkdir(parents=True, exist_ok=True)
    args.evidence.mkdir(parents=True, exist_ok=True)
    plan = json.loads(args.edit.read_text())
    info = probe(args.source)
    assert len(info["streams"]) == 1
    assert (info["streams"][0]["width"], info["streams"][0]["height"]) == (1280, 704)
    assert int(info["streams"][0]["nb_frames"]) == FRAME_COUNT
    assert info["streams"][0]["avg_frame_rate"] == f"{FPS}/1"
    total_frames = FRAME_COUNT + plan["holdFrames"]
    duration = total_frames / FPS
    assert plan["holdFrames"] > 0
    if plan["lockupFullFrame"] != FRAME_COUNT - 1:
        raise ValueError("The one-second lockup fade must finish on the film's final moving frame.")
    save_json(args.evidence / "source.json", {"sha256": digest(args.source), **info})
    score = None
    if args.score:
        raw = trim_score(args.score, duration, args.evidence)
        score = master_music(raw, duration, args.evidence)
    folder = args.evidence / "16x9"
    folder.mkdir(exist_ok=True)
    picture = render_picture(args.source, SIZE, dict(plan, kit=args.kit), folder)
    capture_checks(picture, plan, folder)
    target = args.out / f"frontier-trailer-{duration:g}-16x9.mp4"
    export = deliver_film(picture, score, target, duration, SIZE, total_frames)
    exports = [{"aspect": "16x9", **export}]
    print(json.dumps(exports[0]), flush=True)
    result = {"source": str(args.source), "sourceSha256": digest(args.source),
              "edit": plan, "exports": exports, "scoreStatus": "laid in" if score else "awaiting owner score",
              "brand": {name: digest(args.kit / name) for name in [REALMS, LOCKUP, HEADING, BODY, "03-Colors/palette.json"]},
              "scoreSourceSha256": digest(args.score) if args.score else None}
    save_json(args.evidence / "final.json", result)
    save_json(args.out / "final.json", result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ["source", "kit", "edit", "out", "evidence"]:
        parser.add_argument(f"--{option}", type=Path, required=True)
    parser.add_argument("--score", type=Path, help="Picture-length audio; only excess tail is trimmed")
    finish(parser.parse_args())
