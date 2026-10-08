"""Compose review contact sheets from PNG/JPG files inside Blender (numpy, no PIL)."""
import bpy, numpy as np

def _load(path, cell):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    s = min(cell / w, cell / h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    ys = (np.arange(nh) / s).astype(int).clip(0, h - 1); xs = (np.arange(nw) / s).astype(int).clip(0, w - 1)
    return a[ys][:, xs]

def sheet(paths, cols, cell, out, bg=0.93):
    rows = (len(paths) + cols - 1) // cols
    W, H = cols * cell, rows * cell
    canvas = np.full((H, W, 4), bg, dtype=np.float32); canvas[..., 3] = 1
    for i, pth in enumerate(paths):
        if not pth: continue
        t = _load(pth, cell - 8)
        r, c = divmod(i, cols)
        y0 = H - (r + 1) * cell + (cell - t.shape[0]) // 2   # blender pixels bottom-up
        x0 = c * cell + (cell - t.shape[1]) // 2
        canvas[y0:y0 + t.shape[0], x0:x0 + t.shape[1]] = t
    im = bpy.data.images.new("sheet", W, H, alpha=True)
    im.pixels[:] = canvas.ravel()
    im.filepath_raw = out; im.file_format = "PNG"; im.save()
    bpy.data.images.remove(im)
