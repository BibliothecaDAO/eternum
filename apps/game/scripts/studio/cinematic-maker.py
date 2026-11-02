"""Frame approved footage with brand cards and lay in a picture-length score."""
import argparse
import hashlib
import json
import random
from statistics import median
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


def load_pennant_master(path, height):
    pennant = Image.open(path).convert("RGBA")
    visible = pennant.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if visible is None:
        raise ValueError("Pennant master has no visible artwork")
    pennant = pennant.crop(visible)
    if pennant.height < height:
        raise ValueError(f"Pennant master is too small for {height}px output: {path}")
    width = round(pennant.width * height / pennant.height)
    return pennant.resize((width, height), Image.Resampling.LANCZOS)


def opening_pennant(size, plan):
    seal_diameter = plan["realmsWidth"] * size[0] / BASE_WIDTH
    return load_pennant_master(plan["devconPennant"], round(seal_diameter * 1.8))


def make_card(kit, size, plan, target):
    width = size[0]
    scale = width / BASE_WIDTH
    palette = json.loads((kit / "03-Colors/palette.json").read_text())
    ground = ImageColor.getrgb(palette["brand"]["hearth"])
    card = Image.new("RGBA", size, (*ground, 204))
    if "cardBackdrop" in plan:
        backdrop = Image.open(plan["cardBackdrop"]).convert("RGBA")
        if backdrop.width < size[0] or backdrop.width * size[1] != backdrop.height * size[0]:
            raise ValueError("End-card backdrop must cover the output at its exact aspect ratio")
        backdrop = backdrop.resize(size, Image.Resampling.LANCZOS)
        backdrop.alpha_composite(card)
        card = backdrop
    logo = load_brand_master(kit / LOCKUP, round(1080 * scale))
    logo_centre = round(550 * scale) if "devconMark" in plan else width // 2
    card.alpha_composite(logo, (logo_centre - logo.width // 2, 0))
    if "devconMark" in plan:
        partner = load_brand_master(plan["devconMark"], round(1000 * scale))
        card.alpha_composite(partner, (round(900 * scale), round(240 * scale)))
    centred_text(card, plan["line"], round(772 * scale), kit / HEADING,
                 round(54 * scale), palette["brand"]["parchment"])
    centred_text(card, plan["cta"], round(878 * scale), kit / BODY,
                 round(45 * scale), palette["games"]["frontier"]["title"])
    card.save(target)


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
    if "devconMark" in plan:
        partner = opening_pennant(size, plan)
        partner.putalpha(ImageChops.multiply(partner.getchannel("A"), partner.convert("L")))
        partner_stamp, partner_pad = parchment_stamp(partner, scale)
        card.paste(partner_stamp, (margin - partner_pad, -partner_pad),
                   partner_stamp.getchannel("A"))
    card.save(target)


def parchment_colour(reference):
    paper = Image.open(reference).convert("RGB")
    rim = paper.crop((0, 0, paper.width, round(paper.height * .08)))
    samples = [colour for colour in rim.get_flattened_data()
               if colour[0] > 150 and colour[0] > colour[1] + 10 and colour[1] > colour[2] + 10]
    if len(samples) < 30:
        raise ValueError("Opening frame has too little warm parchment to sample")
    samples.sort(key=sum)
    midtones = samples[len(samples) // 4:len(samples) * 3 // 4]
    return tuple(round(median(colour[channel] for colour in midtones) * warmth)
                 for channel, warmth in enumerate([.99, .97, .94]))


def make_intro_wash(size, plan, target, reference):
    scale = size[0] / BASE_WIDTH
    pennant = opening_pennant(size, plan)
    grain = ink_noise(pennant.size, pennant.size, 144)
    mask = fibre_edges(pennant.getchannel("A"), scale)
    inner = mask.filter(ImageFilter.MinFilter(2 * round(6 * scale) + 1))
    wear = ImageChops.subtract(mask, inner.filter(ImageFilter.GaussianBlur(3 * scale)))
    variation = ink_noise(pennant.size, (9, 27), 316).point(lambda value: 128 + value // 2)
    wear = ImageChops.multiply(wear, variation)
    wash = Image.merge("RGB", tuple(grain.point(lambda value, base=base:
                       round(base + (value - 128) * .035)) for base in parchment_colour(reference)))
    wash = Image.merge("RGB", tuple(ImageChops.subtract(channel, wear.point(lambda value, depth=depth:
                       round(value * depth))) for channel, depth in zip(wash.split(), [.19, .22, .25])))
    wash = wash.convert("RGBA")
    wash.putalpha(mask.point(lambda value: round(value * .80)))
    card = Image.new("RGBA", size)
    card.alpha_composite(wash, (round(54 * scale), 0))
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
    wash_graph, opening_source, wash_inputs = "", "held", []
    if "devconMark" in plan:
        reference = folder / "parchment-reference.png"
        ffmpeg(["-v", "error", "-i", source, "-frames:v", 1, reference])
        make_intro_wash(size, plan, folder / "intro-wash.png", reference)
        wash_graph = (f"[3:v]format=rgba,fade=t=out:st={logo_fade_start}:d={logo_fade_duration}:alpha=1[wash];"
                      "[held][wash]overlay=0:0:shortest=1:format=auto[paper];")
        opening_source = "paper"
        wash_inputs = ["-loop", 1, "-framerate", FPS, "-i", folder / "intro-wash.png"]
    graph = (
        f"[0:v]scale={width}:{film_height}:flags=lanczos,"
        f"pad={width}:{height}:0:{padding}:color=0x14101D,setsar=1,"
        f"tpad=stop_mode=clone:stop={hold_frames},format=gbrp[held];"
        f"[1:v]format=gbrp,fade=t=out:st={logo_fade_start}:d={logo_fade_duration}:color=white[intro];"
        f"{wash_graph}[{opening_source}][intro]blend=all_mode=multiply:shortest=1[sequence];"
        f"[2:v]format=rgba,fade=t=in:st={card_start}:d=1:alpha=1[card];"
        "[sequence][card]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]"
    )
    target = folder / "picture.mp4"
    ffmpeg(["-v", "error", "-i", source, "-loop", 1, "-framerate", FPS,
            "-i", folder / "intro-card.png", "-loop", 1, "-framerate", FPS,
            "-i", folder / "card.png", *wash_inputs, "-filter_complex", graph, "-map", "[v]", "-an",
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


def capture_opening_checks(picture, plan, folder, size):
    ffmpeg(["-v", "error", "-i", picture, "-frames:v", 1, folder / "opening.png"])
    opening = Image.open(folder / "opening.png").convert("RGB")
    opening.resize((960, 540), Image.Resampling.LANCZOS).save(folder / "opening-film-size.png")
    scale = size[0] / BASE_WIDTH
    corner_width = round(470 * scale)
    corner_height = round(420 * scale)
    if "devconMark" in plan:
        corner_height = opening_pennant(size, plan).height + round(72 * scale)
    corners = Image.new("RGB", (corner_width * 2, corner_height))
    for index, left in enumerate([0, size[0] - corner_width]):
        corners.paste(opening.crop((left, 0, left + corner_width, corner_height)), (index * corner_width, 0))
    corners.save(folder / "opening-corners-100-percent.png")


def capture_checks(picture, plan, folder, size):
    capture_opening_checks(picture, plan, folder, size)
    for name, second in plan["reviewFrames"].items():
        ffmpeg(["-v", "error", "-ss", second, "-i", picture,
                "-frames:v", 1, "-threads", 2, folder / f"{name}.png"])
    scale = size[0] / BASE_WIDTH
    crop = f"crop={round(1080 * scale)}:{round(950 * scale)}:{round(420 * scale)}:0"
    if "devconMark" in plan:
        crop = f"crop={size[0]}:{size[1]}:0:0"
    ffmpeg(["-v", "error", "-ss", plan["lockupFullFrame"] / FPS, "-i", picture,
            "-vf", crop, "-frames:v", 1, "-threads", 2,
            folder / "end-card-100-percent.png"])
    last_frame = FRAME_COUNT + plan["holdFrames"] - 1
    samples = last_frame // 48 + 1 + int(last_frame % 48 != 0)
    rows = (samples + 3) // 4
    filters = (
        f"select='not(mod(n,48))+eq(n,{last_frame})',scale=480:270,"
        "drawtext=text='%{pts\\:hms}':fontsize=20:fontcolor=white:box=1:boxcolor=black,"
        f"tile=4x{rows}"
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
