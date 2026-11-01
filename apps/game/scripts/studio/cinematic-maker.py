"""Finish recorded studio footage with timed music, a kit end card and two crops."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image, ImageColor, ImageDraw, ImageFont

RATE = 48000
FRAME_COUNT = 481
FPS = 24
FORMATS = {"16x9": (1280, 720), "9x16": (1080, 1920)}
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


def stretch_segment(source, start, end, duration, target):
    speed = (end - start) / duration
    if not .5 <= speed <= 2:
        raise ValueError("Retiming exceeds the supported half-to-double tempo range")
    ffmpeg(["-v", "error", "-ss", start, "-t", end - start, "-i", source,
            "-af", f"atempo={speed:.10f},apad=whole_dur={duration},atrim=duration={duration}",
            "-ar", RATE, "-ac", "2", "-c:a", "pcm_f32le", target])
    data, rate = sf.read(target, always_2d=True)
    assert rate == RATE and len(data) == round(duration * RATE)
    return data


def retime_music(source, plan, duration, folder):
    master = np.zeros((round(duration * RATE), 2))
    records = []
    for index, (first, last) in enumerate(zip(plan["musicAnchors"], plan["musicAnchors"][1:])):
        start, end = first["source"], last["source"]
        begin, finish = first["target"], last["target"]
        speed = (end - start) / (finish - begin)
        overlap = min(.04, begin)
        data = stretch_segment(source, start - overlap * speed, end, finish - begin + overlap,
                               folder / f"segment-{index}.wav")
        lead = round(overlap * RATE)
        offset = round(begin * RATE) - lead
        if lead:
            fade = np.linspace(0, 1, lead)[:, None]
            master[offset:offset + lead] = master[offset:offset + lead] * (1 - fade) + data[:lead] * fade
        length = round(finish * RATE) - round(begin * RATE)
        master[offset + lead:offset + lead + length] = data[lead:lead + length]
        records.append({"source": [start, end], "target": [begin, finish], "tempo": speed,
                        "crossfadeBeforeMs": overlap * 1000, "cue": first["cue"]})
    add_music_accents(master, source, plan, folder)
    master[:384] *= np.linspace(0, 1, 384)[:, None]
    master[-2880:] *= np.linspace(1, 0, 2880)[:, None]
    raw = folder / "retimed.wav"
    sf.write(raw, master, RATE, subtype="FLOAT")
    save_json(folder / "retiming.json", records)
    return raw


def add_music_accents(master, source, plan, folder):
    target = folder / "accent.wav"
    ffmpeg(["-v", "error", "-ss", 10, "-t", .3, "-i", source, "-af",
            "highpass=f=35,lowpass=f=220,afade=t=in:d=0.003,afade=t=out:st=0.1:d=0.2",
            "-ar", RATE, "-ac", "2", "-c:a", "pcm_f32le", target])
    accent, _ = sf.read(target, always_2d=True)
    for cue in plan["accents"]:
        start = round(cue["at"] * RATE)
        master[start:start + len(accent)] += accent * 10 ** (cue["gainDb"] / 20)


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
    width, height = size
    wide = width > height
    palette = json.loads((kit / "03-Colors/palette.json").read_text())
    ground = ImageColor.getrgb(palette["brand"]["hearth"])
    card = Image.new("RGBA", size, (*ground, 204))
    logo = Image.open(kit / LOCKUP).convert("RGBA")
    logo_width = 720 if wide else 1020
    logo = logo.resize((logo_width, round(logo.height * logo_width / logo.width)), Image.Resampling.LANCZOS)
    card.alpha_composite(logo, ((width - logo_width) // 2, 0 if wide else 180))
    centred_text(card, plan["line"], 515 if wide else 1010, kit / HEADING,
                 36 if wide else 44, palette["brand"]["parchment"])
    centred_text(card, plan["cta"], 585 if wide else 1130, kit / BODY,
                 30 if wide else 42, palette["games"]["frontier"]["title"])
    card.save(target)


def crop_expression(points):
    expression = str(points[-1][1])
    for (start, first), (end, last) in reversed(list(zip(points, points[1:]))):
        u = f"clip((t-{start})/{end-start},0,1)"
        smooth = f"({first}+({last-first})*({u})*({u})*(3-2*({u})))"
        expression = f"if(lt(t,{end}),{smooth},{expression})"
    return expression


def render_picture(source, size, plan, card, target):
    width, height = size
    if width > height:
        framing = "pad=1280:720:0:8:color=0x14101D,setsar=1"
    else:
        centre = crop_expression(plan["portraitCentres"])
        framing = f"crop=396:704:x='{centre}-198':y=0,scale=1080:1920:flags=lanczos,setsar=1"
    start, end = plan["cardFade"]
    graph = (f"[0:v]{framing}[picture];[1:v]format=rgba,"
             f"fade=t=in:st={start}:d={end-start}:alpha=1[card];"
             "[picture][card]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]")
    ffmpeg(["-v", "error", "-i", source, "-loop", 1, "-framerate", FPS, "-i", card,
            "-filter_complex", graph, "-map", "[v]", "-an", "-frames:v", FRAME_COUNT,
            "-c:v", "libx264", "-preset", "slow", "-crf", 18, "-threads", 2,
            "-movflags", "+faststart", target])


def mux_and_verify(picture, music, target, duration, size):
    partial = target.with_suffix(".partial.mp4")
    ffmpeg(["-v", "error", "-i", picture, "-i", music, "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", RATE,
            "-t", duration, "-movflags", "+faststart", partial])
    info = probe(partial)
    video = next(stream for stream in info["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in info["streams"] if stream["codec_type"] == "audio")
    metrics = measure_loudness(partial)
    assert (video["width"], video["height"]) == size
    assert video["codec_name"] == "h264" and audio["codec_name"] == "aac"
    assert int(video["nb_frames"]) == FRAME_COUNT and video["avg_frame_rate"] == f"{FPS}/1"
    assert abs(float(info["format"]["duration"]) - duration) < .05
    assert abs(metrics["integratedLufs"] + 14) < .25 and metrics["truePeakDbtp"] <= -1
    ffmpeg(["-v", "error", "-i", partial, "-f", "null", "-"])
    partial.replace(target)
    return {"file": target.name, "width": size[0], "height": size[1], "seconds": duration,
            "sha256": digest(target), "bytes": target.stat().st_size, **metrics}


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
    duration = FRAME_COUNT / FPS
    assert abs(plan["musicAnchors"][-1]["target"] - duration) < 1e-6
    save_json(args.evidence / "source.json", {"sha256": digest(args.source), **info})
    music = {}
    for take in [1, 2]:
        folder = args.evidence / f"take{take}"
        folder.mkdir(exist_ok=True)
        source = args.music_dir / f"teaser20-take{take}.wav"
        original = sf.info(source)
        assert original.samplerate == RATE and original.channels == 2 and original.frames == RATE * 20
        raw = retime_music(source, plan, duration, folder)
        music[take] = master_music(raw, duration, folder)
    exports = []
    for aspect, size in FORMATS.items():
        folder = args.evidence / aspect
        folder.mkdir(exist_ok=True)
        card, picture = folder / "card.png", folder / "picture.mp4"
        make_card(args.kit, size, plan, card)
        render_picture(args.source, size, plan, card, picture)
        capture_checks(picture, plan, folder)
        for take, audio in music.items():
            target = args.out / f"frontier-teaser-take{take}-{aspect}.mp4"
            export = mux_and_verify(picture, audio, target, duration, size)
            exports.append({"take": take, "aspect": aspect, **export})
            print(json.dumps(exports[-1]), flush=True)
    result = {"source": str(args.source), "sourceSha256": digest(args.source),
              "edit": plan, "exports": exports,
              "brand": {name: digest(args.kit / name) for name in [LOCKUP, HEADING, BODY, "03-Colors/palette.json"]},
              "musicSources": {str(take): digest(args.music_dir / f"teaser20-take{take}.wav") for take in music}}
    save_json(args.evidence / "final.json", result)
    save_json(args.out / "final.json", result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ["source", "music-dir", "kit", "edit", "out", "evidence"]:
        parser.add_argument(f"--{option}", type=Path, required=True)
    finish(parser.parse_args())
