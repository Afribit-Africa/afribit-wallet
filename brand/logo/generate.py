# Afribit Pay — logo set v2: mark traced from actual-ap-LOGO.png (the mood reference),
# wordmark set in real Manrope outlines. Colors sampled from the reference.
import json, math, os

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Transform

SCRATCH = os.path.dirname(os.path.abspath(__file__))
OUT = SCRATCH

BLACK, ORANGE, WHITE = "#171713", "#EE901C", "#FFFFFF"

T = json.load(open(os.path.join(SCRATCH, "traced_paths.json")))
IW, IH = T["w"], T["h"]          # icon native size (1346 x 640)

f3 = lambda v: ("%.2f" % v).rstrip("0").rstrip(".")

def icon_group(cb, co, dx=0.0, dy=0.0, scale=1.0):
    tr = []
    if dx or dy: tr.append(f"translate({f3(dx)},{f3(dy)})")
    if scale != 1.0: tr.append(f"scale({f3(scale)})")
    t = f' transform="{" ".join(tr)}"' if tr else ""
    # single-color: hairline same-color stroke hides the AA seam where shapes overlap
    st = f' stroke="{cb}" stroke-width="3"' if cb == co else ""
    return (f'<g{t}{st}><path fill="{co}" d="{T["orange"]}"/>'
            f'<path fill="{cb}" d="{T["black"]}"/></g>')

def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f3(w)} {f3(h)}" '
            f'width="{f3(w)}" height="{f3(h)}">\n{body}\n</svg>\n')

# ---------- text machinery ----------
class Face:
    def __init__(self, path):
        self.path = path
        self.tt = TTFont(path)
        self.cap = self.tt["OS/2"].sCapHeight
        self.upem = self.tt["head"].unitsPerEm
        self.order = self.tt.getGlyphOrder()
        self.gs = self.tt.getGlyphSet()

BOLD = Face(os.path.join(SCRATCH, "Manrope-Bold.ttf"))
MED = Face(os.path.join(SCRATCH, "Manrope-Medium.ttf"))

def shape(face, text, track=0.0):
    blob = hb.Blob.from_file_path(face.path)
    font = hb.Font(hb.Face(blob))
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": False})
    out, pen = [], 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gname = face.order[info.codepoint]
        out.append((gname, info.cluster, pen + pos.x_offset, pos.y_offset))
        pen += pos.x_advance + track
    return out, pen - track  # advance width without trailing track

def text_paths(face, text, cap_px, colors_by_cluster, track_em=0.0):
    """colors_by_cluster: fn(char_index)->color. Returns list[(color, d)], inkbb, scale."""
    s = cap_px / face.cap
    track = track_em * face.upem
    placed, adv = shape(face, text, track)
    runs, bb = {}, [1e9, 1e9, -1e9, -1e9]
    for gname, cluster, gx, gy in placed:
        if gname == "space": continue
        col = colors_by_cluster(cluster)
        tr = Transform(s, 0, 0, -s, gx * s, -gy * s)
        sp = SVGPathPen(face.gs); face.gs[gname].draw(TransformPen(sp, tr))
        d = sp.getCommands()
        if not d: continue
        runs.setdefault(col, []).append(d)
        bp = BoundsPen(face.gs); face.gs[gname].draw(TransformPen(bp, tr))
        if bp.bounds:
            x0, y0, x1, y1 = bp.bounds
            bb = [min(bb[0], x0), min(bb[1], y0), max(bb[2], x1), max(bb[3], y1)]
    return [(c, " ".join(ds)) for c, ds in runs.items()], bb, adv * s

def place(runs, dx, dy):
    inner = "".join(f'<path fill="{c}" d="{d}"/>' for c, d in runs)
    return f'<g transform="translate({f3(dx)},{f3(dy)})">{inner}</g>'

WORD = "Afribit Pay"
TAG = "EVERYDAY BITCOIN."
PAY_START = WORD.index("Pay")

def wordmark_runs(cap_px, cb, co, track_em=-0.004):
    return text_paths(BOLD, WORD, cap_px, lambda cl: co if cl >= PAY_START else cb, track_em)

def tagline_runs(cap_px, color, target_w=None):
    tr = 0.40  # letterspacing in em
    if target_w:  # solve tracking so ink width ~= target
        for _ in range(6):
            _, bb, _ = text_paths(MED, TAG, cap_px, lambda cl: color, tr)
            w = bb[2] - bb[0]
            n = len(TAG) - 1
            tr += (target_w - w) / (n * cap_px / MED.cap * MED.upem) * (MED.cap / MED.upem)
    return text_paths(MED, TAG, cap_px, lambda cl: color, tr)

# ---------- deliverables ----------
COLORWAYS = {
    "": (BLACK, ORANGE),
    "-black": (BLACK, BLACK),
    "-white": (WHITE, WHITE),
}
files = {}

# 1. monogram
for suf, (cb, co) in COLORWAYS.items():
    files[f"afribit-monogram{suf}.svg"] = svg(IW, IH, icon_group(cb, co))

# 2. stacked lockup (primary layout, like the moodboard hero)
CAP = 0.235 * IH                      # wordmark cap height (wordmark ~= icon width, like the mood hero)
for suf, (cb, co) in COLORWAYS.items():
    wruns, wbb, _ = wordmark_runs(CAP, cb, co)
    ww = wbb[2] - wbb[0]
    truns, tbb, _ = tagline_runs(0.075 * IH, cb, target_w=ww * 0.98)
    tw = tbb[2] - tbb[0]
    W = max(IW, ww) * 1.0
    gap1, gap2 = 0.14 * IH, 0.105 * IH
    y_word = IH + gap1 + CAP          # baseline
    y_tag = y_word + gap2 + 0.075 * IH
    body = (icon_group(cb, co, dx=(W - IW) / 2)
            + place(wruns, (W - ww) / 2 - wbb[0], y_word)
            + place(truns, (W - tw) / 2 - tbb[0], y_tag))
    H = y_tag + 0.02 * IH + abs(tbb[3])
    files[f"afribit-lockup-stacked{suf}.svg"] = svg(W, H, body)

# 3. horizontal lockup: icon left, wordmark + tagline block right, vertically centered
CAPH = 0.34 * IH
for suf, (cb, co) in COLORWAYS.items():
    wruns, wbb, _ = wordmark_runs(CAPH, cb, co)
    ww = wbb[2] - wbb[0]
    truns, tbb, _ = tagline_runs(0.088 * IH, cb, target_w=ww * 0.985)
    gap = 0.28 * IH
    tgap = 0.13 * IH
    block_h = CAPH + tgap + 0.088 * IH
    y0 = (IH - block_h) / 2
    xw = IW + gap
    body = (icon_group(cb, co)
            + place(wruns, xw - wbb[0], y0 + CAPH)
            + place(truns, xw - tbb[0], y0 + CAPH + tgap + 0.088 * IH))
    W = xw + ww + 0.02 * IH
    files[f"afribit-lockup-horizontal{suf}.svg"] = svg(W, IH, body)

# 4. standalone wordmark (fallback)
for suf, (cb, co) in COLORWAYS.items():
    wruns, wbb, _ = wordmark_runs(300, cb, co)
    ww, wh = wbb[2] - wbb[0], wbb[3] - wbb[1]
    body = place(wruns, -wbb[0], -wbb[1])
    files[f"afribit-wordmark{suf}.svg"] = svg(ww, wh, body)

os.makedirs(OUT, exist_ok=True)
for name, content in files.items():
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(content)
    print("wrote", name, f"({len(content)//1024}KB)")
