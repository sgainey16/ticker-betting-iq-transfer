"""Slice a Reggie/Marc contact sheet into 20 individual portraits.

Rows in these sheets are separated by clean horizontal white label strips.
Columns are visually clean but often broken up by mics/nameplates.

Strategy:
- Rows: detect dark bands (label strips reliably split them).
- Cols: pick horizontal extent of the widest dark row, divide evenly.
"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

if len(sys.argv) < 3:
    print("usage: slice_contact_sheet.py <host> <sheet_path>")
    sys.exit(1)

HOST = sys.argv[1]
SHEET = Path(sys.argv[2])
OUT = Path(f"/app/backend/static/hosts/expressions/{HOST}")
OUT.mkdir(parents=True, exist_ok=True)

# Solo-host name list (20 slots) — used for reggie / marc contact sheets.
SOLO_NAMES = [
    "neutral", "explaining", "pointing", "leaning",
    "hands-open", "counting", "looking-notes", "looking-monitor",
    "listening-off", "skeptical", "smirking", "laughing",
    "yelling", "disappointed", "serious", "chirping",
    "celebrating", "thinking", "hot-take", "mic-drop",
]

# Two-shot name list — mirrors the labels in the "together" contact sheet.
TOGETHER_NAMES = [
    "neutral-open", "cold-open", "panel-wide", "side-two-shot", "reggie-leads",
    "marc-leads", "friendly-debate", "arguing", "hot-take-clash", "in-agreement",
    "serious-analysis", "reviewing-tape", "looking-at-monitor", "both-thinking", "both-pointing",
    "shocked", "laughing", "celebrating", "punchline", "signoff",
]

NAMES = TOGETHER_NAMES if HOST == "together" else SOLO_NAMES

im = Image.open(SHEET).convert("RGB")
W, H = im.size
print(f"{HOST} sheet: {W}x{H}")

# Landscape → 5 cols × 4 rows. Portrait → 4 cols × 5 rows.
if W >= H:
    NCOLS, NROWS = 5, 4
else:
    NCOLS, NROWS = 4, 5
print(f"grid: {NCOLS}c × {NROWS}r")

arr = np.array(im.convert("L"))
row_means = arr.mean(axis=1)

# Row detection — bands of dark contiguous rows separated by white label strips.
def dark_bands(means, threshold=100, min_len=100):
    bands = []
    in_band, start = False, 0
    for i, v in enumerate(means):
        if v < threshold and not in_band:
            in_band, start = True, i
        elif v >= threshold and in_band:
            in_band = False
            if i - start >= min_len:
                bands.append((start, i - 1))
    if in_band and len(means) - start >= min_len:
        bands.append((start, len(means) - 1))
    return bands

row_bands = dark_bands(row_means, threshold=100, min_len=100)
if len(row_bands) != NROWS:
    print(f"WARNING: detected {len(row_bands)} rows, expected {NROWS}")
    # fall back to even division of the outer dark span
    all_dark = np.where(row_means < 100)[0]
    y0, y1 = int(all_dark.min()), int(all_dark.max())
    step = (y1 - y0) / NROWS
    row_bands = [(int(y0 + i*step + 4), int(y0 + (i+1)*step - 4)) for i in range(NROWS)]

# Column horizontal extent: use the union across all rows.
# Within the widest row, find leftmost/rightmost dark pixel.
def widest_row_extent():
    xs = []
    for (r0, r1) in row_bands:
        row_slice = arr[r0:r1+1, :].mean(axis=0)
        dark = np.where(row_slice < 120)[0]
        if len(dark) > 0:
            xs.append((int(dark.min()), int(dark.max())))
    if not xs:
        return 0, W - 1
    return min(x[0] for x in xs), max(x[1] for x in xs)

x0, x1 = widest_row_extent()
print(f"columns span: {x0} → {x1}")
col_w = (x1 - x0) / NCOLS

idx = 0
# The "together" sheet has a dark label bar at the top of each cell
# (numbered badge + shot name). Skip the top ~42px so we crop just the art.
top_bleed = 42 if HOST == "together" else 2
for r_i, (ry0, ry1) in enumerate(row_bands[:NROWS]):
    for c_i in range(NCOLS):
        if idx >= len(NAMES):
            break
        cx0 = int(x0 + c_i * col_w + 2)
        cx1 = int(x0 + (c_i + 1) * col_w - 2)
        crop = im.crop((cx0, ry0 + top_bleed, cx1, ry1 - 2))
        out_path = OUT / f"{NAMES[idx]}.png"
        crop.save(out_path, "PNG", optimize=True)
        print(f"  [{idx+1:02d}] {NAMES[idx]:18} ({cx0},{ry0})→({cx1},{ry1}) {crop.size}")
        idx += 1
print(f"\nDone. {idx} portraits → {OUT}")
