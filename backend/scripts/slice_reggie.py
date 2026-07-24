"""Slice the Reggie contact sheet into 20 individual portraits.

Grid: 5 rows × 4 columns. Sheet is 1024×1536.
Each cell has a portrait on top and a label below. We crop just the portrait.
"""
from pathlib import Path
from PIL import Image
import numpy as np

SHEET = Path("/app/backend/scripts/reggie_contact_sheet.png")
OUT = Path("/app/backend/static/hosts/expressions/reggie")
OUT.mkdir(parents=True, exist_ok=True)

# In-order mapping — Reggie filenames row by row.
NAMES = [
    "neutral", "explaining", "pointing", "leaning",
    "hands-open", "counting", "looking-notes", "looking-monitor",
    "listening-off", "skeptical", "smirking", "laughing",
    "yelling", "disappointed", "serious", "chirping",
    "celebrating", "thinking", "hot-take", "mic-drop",
]

im = Image.open(SHEET).convert("RGB")
W, H = im.size
print(f"Sheet size: {W}x{H}")

# Auto-detect row + column boundaries.
# The gutters (label strips + margins) are near-white; cells are dark.
arr = np.array(im.convert("L"))  # grayscale
# Row bands: mean brightness per horizontal row.
row_means = arr.mean(axis=1)
col_means = arr.mean(axis=0)

# A row is "in cell" when mean < 90 (dark portrait area). Find contiguous dark stripes.
def dark_bands(means, threshold=90):
    bands = []
    in_band = False
    start = 0
    for i, v in enumerate(means):
        if v < threshold and not in_band:
            in_band = True
            start = i
        elif v >= threshold and in_band:
            in_band = False
            bands.append((start, i - 1))
    if in_band:
        bands.append((start, len(means) - 1))
    return bands

row_bands = dark_bands(row_means, threshold=100)
col_bands = dark_bands(col_means, threshold=100)
print(f"Detected {len(row_bands)} row bands, {len(col_bands)} col bands")

# Keep only bands that are tall/wide enough to be cells (not thin borders).
row_bands = [b for b in row_bands if (b[1] - b[0]) > 100]
col_bands = [b for b in col_bands if (b[1] - b[0]) > 100]

# Merge adjacent columns split by bright elements (like microphones).
def merge_close(bands, max_gap=30):
    if not bands: return bands
    merged = [bands[0]]
    for b in bands[1:]:
        prev = merged[-1]
        if b[0] - prev[1] <= max_gap:
            merged[-1] = (prev[0], b[1])
        else:
            merged.append(b)
    return merged

col_bands = merge_close(col_bands, max_gap=6)
row_bands = merge_close(row_bands, max_gap=6)
print(f"After merge: {len(row_bands)} rows, {len(col_bands)} cols")
print("rows:", row_bands)
print("cols:", col_bands)

# Sanity check
if len(row_bands) != 5 or len(col_bands) != 4:
    print("WARNING: expected 5x4 but got", len(row_bands), "x", len(col_bands))

idx = 0
for r, (y0, y1) in enumerate(row_bands[:5]):
    for c, (x0, x1) in enumerate(col_bands[:4]):
        if idx >= len(NAMES):
            break
        # Tighten a couple of pixels to remove any faint gutter fringe.
        pad = 2
        crop = im.crop((x0 + pad, y0 + pad, x1 - pad, y1 - pad))
        out_path = OUT / f"{NAMES[idx]}.png"
        crop.save(out_path, "PNG", optimize=True)
        print(f"  [{idx+1:02d}] {NAMES[idx]:20} {crop.size}  →  {out_path.name}")
        idx += 1

print(f"\nDone. {idx} portraits written to {OUT}")
