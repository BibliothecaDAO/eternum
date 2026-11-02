"""Frame approved footage with brand cards and lay in a picture-length score."""
import argparse
import hashlib
import json
import random
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageChops, ImageColor, ImageDraw, ImageFilter, ImageFont

RATE = 48000
FRAME_COUNT = 481
FPS = 24
BASE_WIDTH = 1920
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


def load_brand_master(path, width):
    logo = Image.open(path).convert("RGBA")
    if logo.width < width:
        raise ValueError(f"Brand master is too small for {width}px output: {path}")
    height = round(logo.height * width / logo.width)
    return logo.resize((width, height), Image.Resampling.LANCZOS)


def make_card(kit, size, plan, target):
    if plan.get("cardPlacement", "full-frame") == "sky":
        make_sky_card(kit, size, plan).save(target)
        return
    if plan.get("cardPlacement", "full-frame") != "full-frame":
        raise ValueError("cardPlacement must be sky or full-frame")
    width = size[0]
    scale = width / BASE_WIDTH
    palette = json.loads((kit / "03-Colors/palette.json").read_text())
    ground = ImageColor.getrgb(palette["brand"]["hearth"])
    card = Image.new("RGBA", size, (*ground, 204))
    logo = load_brand_master(kit / LOCKUP, round(1080 * scale))
    card.alpha_composite(logo, ((width - logo.width) // 2, 0))
    centred_text(card, plan["line"], round(772 * scale), kit / HEADING,
                 round(54 * scale), palette["brand"]["parchment"])
    centred_text(card, plan["cta"], round(878 * scale), kit / BODY,
                 round(45 * scale), palette["games"]["frontier"]["title"])
    card.save(target)


def make_sky_card(kit, size, plan):
    scale = size[0] / BASE_WIDTH
    palette = json.loads((kit / "03-Colors/palette.json").read_text())
    lettering = Image.new("RGBA", size)
    logo = load_brand_master(kit / LOCKUP, round(420 * scale))
    lettering.alpha_composite(logo, ((size[0] - logo.width) // 2, 0))
    centred_text(lettering, plan["line"], round(284 * scale), kit / HEADING,
                 round(28 * scale), palette["brand"]["parchment"])
    centred_text(lettering, plan["cta"], round(318 * scale), kit / BODY,
                 round(24 * scale), palette["games"]["frontier"]["title"])
    shadow = Image.new("RGBA", size, (20, 12, 27))
    alpha = lettering.getchannel("A").filter(ImageFilter.GaussianBlur(3 * scale))
    shadow.putalpha(alpha.point(lambda value: round(value * .4)))
    shadow.alpha_composite(lettering)
    return shadow


def ink_noise(size, cells, seed):
    rng = random.Random(seed)
    noise = Image.frombytes("L", cells, bytes(rng.randrange(256) for _ in range(cells[0] * cells[1])))
    return noise.resize(size, Image.Resampling.BICUBIC)


def fibre_edges(mask, scale):
    width, height = mask.size
    step = max(4, round(8 * scale))
    amplitude = 1.1 * scale
    rng = random.Random(813)
    xs = list(range(0, width, step)) + [width]
    ys = list(range(0, height, step)) + [height]
    points = {(x, y): (x + rng.uniform(-amplitude, amplitude),
                       y + rng.uniform(-amplitude, amplitude)) for x in xs for y in ys}
    mesh = []
    for left, right in zip(xs, xs[1:]):
        for top, bottom in zip(ys, ys[1:]):
            quad = sum((points[p] for p in [(left, top), (left, bottom),
                                           (right, bottom), (right, top)]), ())
            mesh.append(((left, top, right, bottom), quad))
    return mask.transform(mask.size, Image.Transform.MESH, mesh, Image.Resampling.BILINEAR)


def parchment_stamp(logo, scale):
    mask = fibre_edges(logo.getchannel("A"), scale)
    fibre = ink_noise(mask.size, (max(1, mask.width // 2), max(1, mask.height // 7)), 741)
    dry_brush = fibre.point(lambda value: 65 if value > 177 else 150 if value > 148 else 238)
    impression = ImageChops.multiply(mask, dry_brush)
    edge_pool = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(3)))
    impression = ImageChops.lighter(impression, edge_pool.point(lambda value: round(value * .7)))
    pools = ink_noise(mask.size, (19, 17), 812)
    colour = Image.merge("RGB", tuple(pools.point(lambda value, base=base, span=span:
                         round(base + span * value / 255)) for base, span in [(73, 83), (37, 67), (17, 39)]))
    pad = round(20 * scale)
    stamp = Image.new("RGBA", (mask.width + pad * 2, mask.height + pad * 2))
    echo = Image.new("RGBA", mask.size, (117, 66, 30))
    echo.putalpha(mask.point(lambda value: round(value * .25)))
    stamp.alpha_composite(echo, (pad + max(1, round(scale)), pad + max(1, round(scale))))
    colour.putalpha(impression)
    stamp.alpha_composite(colour, (pad, pad))
    draw = ImageDraw.Draw(stamp)
    rng = random.Random(194)
    for _ in range(24):
        x, y = rng.randrange(stamp.width), rng.randrange(stamp.height)
        if pad < x < stamp.width - pad and pad < y < stamp.height - pad:
            continue
        radius = rng.uniform(.6, 2.4) * scale
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(153, 85, 35, rng.randrange(18, 48)))
    return stamp, pad


def make_intro_card(kit, size, plan, target):
    card = Image.new("RGB", size, "white")
    scale = size[0] / BASE_WIDTH
    width = round(plan["realmsWidth"] * scale)
    margin = round(54 * scale)
    stamp, pad = parchment_stamp(load_brand_master(kit / REALMS, width), scale)
    position = (size[0] - width - margin - pad, margin - pad)
    card.paste(stamp, position, stamp.getchannel("A"))
    card.save(target)


def render_picture(source, size, plan, folder):
    hold_frames = plan["holdFrames"]
    total_frames = FRAME_COUNT + hold_frames
    card_start = plan["lockupFullFrame"] / FPS - 1
    make_card(plan["kit"], size, plan, folder / "card.png")
    make_intro_card(plan["kit"], size, plan, folder / "intro-card.png")
    logo_fade_start = plan["realmsFadeStartFrame"] / FPS
    logo_fade_duration = (plan["realmsFadeEndFrame"] - plan["realmsFadeStartFrame"]) / FPS
    width, height = size
    film_height = width * 11 // 20
    padding = (height - film_height) // 2
    graph = (
        f"[0:v]scale={width}:{film_height}:flags=lanczos,"
        f"pad={width}:{height}:0:{padding}:color=0x14101D,setsar=1,"
        f"tpad=stop_mode=clone:stop={hold_frames},format=gbrp[held];"
        f"[1:v]format=gbrp,fade=t=out:st={logo_fade_start}:d={logo_fade_duration}:color=white[intro];"
        "[held][intro]blend=all_mode=multiply:shortest=1[sequence];"
        f"[2:v]format=rgba,fade=t=in:st={card_start}:d=1:alpha=1[card];"
        "[sequence][card]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]"
    )
    target = folder / "picture.mp4"
    ffmpeg(["-v", "error", "-i", source, "-loop", 1, "-framerate", FPS,
            "-i", folder / "intro-card.png", "-loop", 1, "-framerate", FPS,
            "-i", folder / "card.png", "-filter_complex", graph, "-map", "[v]", "-an",
            "-frames:v", total_frames, "-c:v", "libx264", "-profile:v", "high",
            "-preset", "slow", "-crf", 15,
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
    assert video["profile"] == "High"
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
            "frameCount": frame_count, "profile": video["profile"], "crf": 15,
            "hasAudio": bool(score), "sha256": digest(target),
            "bytes": target.stat().st_size, **metrics}


def capture_checks(picture, plan, folder, size):
    for name, second in plan["reviewFrames"].items():
        ffmpeg(["-v", "error", "-ss", second, "-i", picture,
                "-frames:v", 1, "-threads", 2, folder / f"{name}.png"])
    scale = size[0] / BASE_WIDTH
    crop = f"crop={round(1080 * scale)}:{round(950 * scale)}:{round(420 * scale)}:0"
    ffmpeg(["-v", "error", "-ss", plan["lockupFullFrame"] / FPS, "-i", picture,
            "-vf", crop, "-frames:v", 1, "-threads", 2,
            folder / "end-card-100-percent.png"])
    last_frame = FRAME_COUNT + plan["holdFrames"] - 1
    filters = (
        f"select='not(mod(n,48))+eq(n,{last_frame})',scale=480:270,"
        "drawtext=text='%{pts\\:hms}':fontsize=20:fontcolor=white:box=1:boxcolor=black,"
        "tile=4x3"
    )
    ffmpeg(["-v", "error", "-i", picture, "-vf", filters, "-frames:v", 1,
            "-threads", 2, folder / "contact-sheet-2s.png"])


def finish(args):
    args.out.mkdir(parents=True, exist_ok=True)
    args.evidence.mkdir(parents=True, exist_ok=True)
    plan = json.loads(args.edit.read_text())
    info = probe(args.source)
    assert len(info["streams"]) == 1
    source_size = (info["streams"][0]["width"], info["streams"][0]["height"])
    assert source_size in [(1280, 704), (2560, 1408)]
    size = (args.height * 16 // 9, args.height)
    assert int(info["streams"][0]["nb_frames"]) == FRAME_COUNT
    assert info["streams"][0]["avg_frame_rate"] == f"{FPS}/1"
    total_frames = FRAME_COUNT + plan["holdFrames"]
    duration = total_frames / FPS
    assert plan["holdFrames"] > 0
    assert 0 < plan["realmsWidth"] <= BASE_WIDTH - 108
    assert 0 <= plan["realmsFadeStartFrame"] < plan["realmsFadeEndFrame"] < FRAME_COUNT
    if plan["lockupFullFrame"] != FRAME_COUNT - 1:
        raise ValueError("The one-second lockup fade must finish on the film's final moving frame.")
    save_json(args.evidence / "source.json", {"sha256": digest(args.source), **info})
    score = None
    if args.score:
        raw = trim_score(args.score, duration, args.evidence)
        score = master_music(raw, duration, args.evidence)
    folder = args.evidence / "16x9"
    folder.mkdir(exist_ok=True)
    picture = render_picture(args.source, size, dict(plan, kit=args.kit), folder)
    capture_checks(picture, plan, folder, size)
    suffix = "" if args.height == 1080 else f"-{args.height}p"
    target = args.out / f"frontier-trailer-{duration:g}-16x9{suffix}.mp4"
    export = deliver_film(picture, score, target, duration, size, total_frames)
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
    parser.add_argument("--height", type=int, choices=[1080, 1440], default=1080)
    parser.add_argument("--score", type=Path, help="Picture-length audio; only excess tail is trimmed")
    finish(parser.parse_args())
