"""One-time slicer for the Phase 1 asset library sprite sheet.

Downloads the sheet (if missing), slices it into individual per-shot PNGs
under /app/backend/static/sprites/, and writes a manifest.json the frontend
consumes.

Run: python3 crop_asset_library.py
"""
import json
import urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent
SPRITE_DIR = ROOT / "static" / "sprites"
SPRITE_DIR.mkdir(parents=True, exist_ok=True)
SHEET_PATH = SPRITE_DIR / "_source_sheet.png"
SHEET_URL = (
    "https://customer-assets-39nsmqrw.emergentagent.net/"
    "job_sports-broadcast-21/artifacts/bmitnrjd_image.png"
)

# The sheet is 1536 x 1024. Y bounds below were measured from the sheet.
# Every row has a small dark title band above the cells and a small blue
# label bar overlaid on the bottom of each cell — we crop out only the
# artwork area (excluding the row title bar; the tiny label bar at bottom
# gets covered by the frontend UI).
SHEET_W, SHEET_H = 1536, 1024

# (top_y, bottom_y) for each visual row band (artwork region only).
Y_BANDS = {
    "row01_two_host":   (56,  228),
    "row02_reggie_a":   (252, 397),   # cells 01-10
    "row02_reggie_b":   (410, 552),   # cells 11-15
    "row03_marc_a":     (580, 720),   # cells 01-10
    "row03_marc_b":     (735, 875),   # cells 11-15
    "row05_ots":        (895, 1020),  # cells 01-10 (over-the-shoulder)
}

# The label bar at the bottom of every cell — we crop it OFF so the frontend
# doesn't show "01 NEUTRAL OPEN" etc on top of the broadcast.
LABEL_BAR_H = 32  # pixels of blue "01 NEUTRAL" bar per cell to drop

# Definition: cells_per_row × row_band × starting_col
# All rows in the sheet are left-aligned. Cells are uniform width across the
# full 1536 sheet for 10-col rows; for the 5-cell subrows (row02_b, row03_b)
# they use the SAME cell width as the 10-col rows above them.
CELL_W_10 = SHEET_W / 10   # 153.6

# Shot manifest — the ONLY cells we surface to the app for MVP. The rest of
# the sheet stays available for future iterations.
SHOTS = [
    # ---- Two-host wide shots (row 01) ----
    ("two_neutral_open",   "row01_two_host", 0),
    ("two_reggie_speaks",  "row01_two_host", 1),
    ("two_marc_speaks",    "row01_two_host", 2),
    ("two_friendly_debate","row01_two_host", 3),
    ("two_laughing",       "row01_two_host", 4),
    ("two_both_monitor",   "row01_two_host", 5),
    ("two_reviewing_notes","row01_two_host", 6),
    ("two_serious",        "row01_two_host", 7),
    ("two_excited",        "row01_two_host", 8),
    ("two_closing",        "row01_two_host", 9),

    # ---- Reggie solo shots (row 02) ----
    ("reggie_neutral",       "row02_reggie_a", 0),
    ("reggie_explaining",    "row02_reggie_a", 1),
    ("reggie_leaning",       "row02_reggie_a", 2),
    ("reggie_pointing",      "row02_reggie_a", 3),
    ("reggie_hands_open",    "row02_reggie_a", 4),
    ("reggie_counting",      "row02_reggie_a", 5),
    ("reggie_looking_notes", "row02_reggie_a", 6),
    ("reggie_looking_monitor","row02_reggie_a",7),
    ("reggie_listening_off", "row02_reggie_a", 8),
    ("reggie_skeptical",     "row02_reggie_a", 9),
    ("reggie_smirking",      "row02_reggie_b", 0),
    ("reggie_laughing",      "row02_reggie_b", 1),
    ("reggie_yelling",       "row02_reggie_b", 2),
    ("reggie_disappointed",  "row02_reggie_b", 3),
    ("reggie_serious",       "row02_reggie_b", 4),

    # ---- Marc solo shots (row 03) ----
    ("marc_explaining",       "row03_marc_a", 0),
    ("marc_analyzing_stats",  "row03_marc_a", 1),
    ("marc_looking_notes",    "row03_marc_a", 2),
    ("marc_adjusting_glasses","row03_marc_a", 3),
    ("marc_adjusting_glasses_2","row03_marc_a", 4),
    ("marc_looking_monitor",  "row03_marc_a", 5),
    ("marc_listening",        "row03_marc_a", 6),
    ("marc_smiling",          "row03_marc_a", 7),
    ("marc_skeptical",        "row03_marc_a", 8),
    ("marc_serious",          "row03_marc_a", 9),
    ("marc_chuckle",          "row03_marc_b", 4),  # cell 15 (rightmost in subrow B)

    # ---- Over-the-shoulder / behind-the-desk (row 05) ----
    ("ots_reggie",     "row05_ots", 0),
    ("ots_marc",       "row05_ots", 1),
    ("side_two_shot",  "row05_ots", 2),
    ("side_reggie",    "row05_ots", 3),
    ("side_marc",      "row05_ots", 4),
    ("behind_desk_wide","row05_ots", 5),
    ("walking_into_set","row05_ots", 6),
    ("standing_monitor","row05_ots", 7),
    ("telestrator",    "row05_ots", 8),
    ("end_of_show_wave","row05_ots", 9),
]


def ensure_sheet():
    if SHEET_PATH.exists() and SHEET_PATH.stat().st_size > 100_000:
        return
    print("Downloading source sheet…")
    urllib.request.urlretrieve(SHEET_URL, SHEET_PATH)


def crop_all():
    ensure_sheet()
    sheet = Image.open(SHEET_PATH).convert("RGB")
    assert sheet.size == (SHEET_W, SHEET_H), f"unexpected sheet size {sheet.size}"

    UPSCALE = 3  # LANCZOS upscale to reduce browser scaling blur.

    manifest = {}
    for name, band, col in SHOTS:
        top, bottom = Y_BANDS[band]
        left = int(round(col * CELL_W_10))
        right = int(round((col + 1) * CELL_W_10))
        crop_bottom = bottom - LABEL_BAR_H
        box = (left, top, right, crop_bottom)
        cell = sheet.crop(box)
        cell = cell.resize((cell.size[0] * UPSCALE, cell.size[1] * UPSCALE), Image.LANCZOS)
        out = SPRITE_DIR / f"{name}.png"
        cell.save(out, "PNG", optimize=True)
        manifest[name] = {
            "file": f"/api/sprites/{name}.png",
            "w": cell.size[0],
            "h": cell.size[1],
        }
        print(f"  {name}  {cell.size}")

    manifest_path = SPRITE_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"Wrote {len(manifest)} sprites → {SPRITE_DIR}")


if __name__ == "__main__":
    crop_all()
