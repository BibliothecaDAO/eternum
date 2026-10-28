"""The Frontier lockup for the app (public/images/logos/frontier-lockup.webp), from the owner's supplied file
(frontier-03_full.png, 1536 x 1024, the lockup on Frontier's opaque #14101D ground). The ground is lifted out to
transparency against that one known colour (colour-to-alpha), so the lockup stands on any dark painting; the result is
cropped to the art and written at 640 px wide, twice its largest use.

Run from apps/game: uv run --with numpy --with pillow python -I scripts/build-frontier-lockup.py <frontier-03_full.png>
"""

import sys

import numpy as np
from PIL import Image

GROUND = np.array([20, 16, 29], dtype=np.float64)
OUT = "public/images/logos/frontier-lockup.webp"
WIDTH = 640

rgb = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
above = np.where(rgb > GROUND, (rgb - GROUND) / (255 - GROUND), 0)
below = np.where(rgb < GROUND, (GROUND - rgb) / GROUND, 0)
alpha = np.clip(np.max(np.maximum(above, below), axis=2), 0, 1)
colour = np.clip((rgb - GROUND * (1 - alpha[..., None])) / np.where(alpha > 0, alpha, 1)[..., None], 0, 255)
lockup = Image.fromarray(np.dstack([colour, alpha * 255]).astype(np.uint8), "RGBA")
lockup = lockup.crop(Image.fromarray((alpha > 0.04).astype(np.uint8) * 255).getbbox())
lockup.resize((WIDTH, round(lockup.height * WIDTH / lockup.width)), Image.LANCZOS).save(OUT, "WEBP", quality=90, method=6)
