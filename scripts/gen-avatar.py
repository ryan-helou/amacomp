"""Builds every avatar sprite from one set of proportions.

    python3 scripts/gen-avatar.py            # rewrites lib/avatar/sprites.json
    python3 scripts/gen-avatar.py chibi      # pocket-size proportions instead


Change LAYOUT and the whole wardrobe follows — that is the point of generating
the art rather than drawing it. Colour roles: S skin, D skin shade, H hair,
E eye, M mouth, K the item's colour, A its accent, W a highlight.
"""
import json, math, sys

W, H = 80, 128

CLASSIC = dict(
    HEAD_CY=24, HEAD_RX=18.0, HEAD_RY=19.5, NECK_Y0=40, NECK_Y1=54,
    SH_Y=50, HIP_Y=90, ARM_X=19, ARM_Y0=52, ARM_Y1=92, ARM_HW=4.6,
    LEG_X=9, LEG_Y0=88, LEG_Y1=118, LEG_HW=5.6, FOOT_Y=117,
    TR_TOP=15.5, TR_WAIST=12.5, TR_HIP=13.5,
)
# Pocket size: a bigger head, a shorter body, stubbier limbs. Everything else
# is derived, so each garment lands in the right place without being redrawn.
CHIBI = dict(
    HEAD_CY=27, HEAD_RX=22.0, HEAD_RY=22.5, NECK_Y0=47, NECK_Y1=58,
    SH_Y=55, HIP_Y=86, ARM_X=16.5, ARM_Y0=57, ARM_Y1=86, ARM_HW=5.0,
    LEG_X=8.5, LEG_Y0=84, LEG_Y1=108, LEG_HW=6.0, FOOT_Y=107,
    TR_TOP=16.5, TR_WAIST=14.5, TR_HIP=15.5,
)

class C:
    def __init__(s, res):
        s.res = res; s.w, s.h = W*res, H*res
        s.g = [["." for _ in range(s.w)] for _ in range(s.h)]
    def disc(s, cx, cy, rx, ry, ch, y0=None, y1=None, only=None):
        for j in range(s.h):
            y = (j+0.5)/s.res
            if y0 is not None and y < y0: continue
            if y1 is not None and y > y1: continue
            for i in range(s.w):
                x = (i+0.5)/s.res
                if ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1:
                    if only is not None and s.g[j][i] not in only: continue
                    s.g[j][i] = ch
    def rect(s, x0, y0, x1, y1, ch, only=None):
        for j in range(max(0,int(y0*s.res)), min(s.h,int(y1*s.res))):
            for i in range(max(0,int(x0*s.res)), min(s.w,int(x1*s.res))):
                if only is not None and s.g[j][i] not in only: continue
                s.g[j][i] = ch
    def poly(s, pts, ch, only=None):
        ys = [p[1] for p in pts]
        for j in range(max(0,int(min(ys)*s.res)), min(s.h,int(max(ys)*s.res)+1)):
            y = (j+0.5)/s.res; xs = []
            for k in range(len(pts)):
                x1,y1 = pts[k]; x2,y2 = pts[(k+1) % len(pts)]
                if (y1 <= y < y2) or (y2 <= y < y1): xs.append(x1+(x2-x1)*(y-y1)/(y2-y1))
            xs.sort()
            for a in range(0, len(xs)-1, 2):
                for i in range(max(0,int(xs[a]*s.res)), min(s.w,int(xs[a+1]*s.res)+1)):
                    if only is not None and s.g[j][i] not in only: continue
                    s.g[j][i] = ch
    def capsule(s, cx, y0, y1, hw, ch):
        s.rect(cx-hw, y0+hw, cx+hw, y1-hw, ch); s.disc(cx, y0+hw, hw, hw, ch); s.disc(cx, y1-hw, hw, hw, ch)
    def trunk(s, y0, y1, top, waist, hip, ch):
        for j in range(max(0,int(y0*s.res)), min(s.h,int(y1*s.res))):
            y = (j+0.5)/s.res; t = (y-y0)/max(1e-6, y1-y0)
            hw = top + (waist-top)*(t/0.55) if t < 0.55 else waist + (hip-waist)*((t-0.55)/0.45)
            for i in range(max(0,int((40-hw)*s.res)), min(s.w,int((40+hw)*s.res))):
                s.g[j][i] = ch
    def pack(s):
        ys = [j for j in range(s.h) if any(c != "." for c in s.g[j])]
        if not ys: return None
        xs = [i for i in range(s.w) if any(s.g[j][i] != "." for j in ys)]
        x0,x1,y0,y1 = min(xs), max(xs), min(ys), max(ys)
        return {"res": s.res, "x0": x0, "y0": y0, "rows": ["".join(s.g[j][x0:x1+1]) for j in range(y0, y1+1)]}

# --------------------------------------------------------------------- flags
# A flag is a small language: bands, a cross, a canton, a disc, an emblem. The
# colours are literal (chars "1".."9" index each flag's own palette), which is
# the one place the wardrobe needs real colours rather than the wearer's chosen
# one — a Canadian flag in mint is not a Canadian flag.

class Flag:
    """A cloth of w x h units, drawn in normalised 0..1 coordinates."""

    # res 2, not 3: a flag is mostly flat colour, and the diagonals of a union
    # flag at res 3 turn into thousands of one-cell runs — 390KB for Jamaica
    # alone. Two cells per unit matches the garments and keeps a box light.
    def __init__(s, res=2, w=76.0, h=52.0, y0=5.0):
        s.res, s.w_, s.h_ = res, w, h
        s.c = C(res)
        s.x0, s.y0 = (W - w) / 2, y0

    def _x(s, u): return s.x0 + u * s.w_
    def _y(s, v): return s.y0 + v * s.h_

    def field(s, ch): s.c.rect(s._x(0), s._y(0), s._x(1), s._y(1), ch)

    def bands(s, chars, vertical=True, weights=None):
        weights = weights or [1] * len(chars)
        total = float(sum(weights)); at = 0.0
        for ch, wgt in zip(chars, weights):
            a, b = at / total, (at + wgt) / total
            if vertical: s.c.rect(s._x(a), s._y(0), s._x(b), s._y(1), ch)
            else:        s.c.rect(s._x(0), s._y(a), s._x(1), s._y(b), ch)
            at += wgt

    def stripes(s, n, chars, vertical=False):
        for i in range(n):
            a, b, ch = i / n, (i + 1) / n, chars[i % len(chars)]
            if vertical: s.c.rect(s._x(a), s._y(0), s._x(b), s._y(1), ch)
            else:        s.c.rect(s._x(0), s._y(a), s._x(1), s._y(b), ch)

    def box(s, u0, v0, u1, v1, ch, only=None):
        s.c.rect(s._x(u0), s._y(v0), s._x(u1), s._y(v1), ch, only=only)

    def disc(s, u, v, r, ch, only=None):
        # r is a fraction of the cloth HEIGHT, so a disc stays round.
        s.c.disc(s._x(u), s._y(v), r * s.h_, r * s.h_, ch, only=only)

    def ring(s, u, v, r, ch, inner):
        s.disc(u, v, r, ch); s.disc(u, v, inner, ".")

    def cross(s, u, thick, ch):
        """A Nordic cross: upright at u, arms `thick` of the height."""
        t = thick / 2.0
        s.c.rect(s._x(0), s._y(0.5 - t), s._x(1), s._y(0.5 + t), ch)
        s.c.rect(s._x(u) - t * s.h_, s._y(0), s._x(u) + t * s.h_, s._y(1), ch)

    def saltire(s, thick, ch):
        n, hw = 240, thick / 2.0 * s.h_
        for i in range(n + 1):
            t = i / n
            for u, v in ((t, t), (t, 1 - t)):
                s.c.rect(s._x(u) - hw, s._y(v) - hw * 0.66, s._x(u) + hw, s._y(v) + hw * 0.66, ch)

    def star(s, u, v, r, ch, points=5, inner=0.42, turn=0.0):
        import math
        R = r * s.h_; pts = []
        for i in range(points * 2):
            ang = turn - math.pi / 2 + i * math.pi / points
            rad = R if i % 2 == 0 else R * inner
            pts.append((s._x(u) + rad * math.cos(ang), s._y(v) + rad * math.sin(ang)))
        s.c.poly(pts, ch)

    def diamond(s, u, v, rw, rh, ch):
        s.c.poly([(s._x(u), s._y(v) - rh * s.h_), (s._x(u) + rw * s.w_, s._y(v)),
                  (s._x(u), s._y(v) + rh * s.h_), (s._x(u) - rw * s.w_, s._y(v))], ch)

    def triangle(s, pts, ch): s.c.poly([(s._x(u), s._y(v)) for u, v in pts], ch)

    def maple(s, u, v, r, ch):
        """Eleven points at measured radii — the deep notches are what make it
        read as a maple leaf instead of a starburst at this size."""
        spec = [(0.00, 1.00), (0.09, 0.42), (0.24, 0.62), (0.21, 0.30), (0.44, 0.38),
                (0.38, 0.14), (0.66, 0.18), (0.52, -0.04), (0.31, -0.14), (0.34, -0.32),
                (0.11, -0.28), (0.07, -0.58)]
        pts = list(spec) + [(-sx, sy) for sx, sy in reversed(spec[1:])]
        s.c.poly([(s._x(u) + px * r * s.h_ * 1.3, s._y(v) - py * r * s.h_) for px, py in pts], ch)
        s.c.rect(s._x(u) - 0.04 * r * s.h_, s._y(v) + 0.50 * r * s.h_,
                 s._x(u) + 0.04 * r * s.h_, s._y(v) + 0.66 * r * s.h_, ch)

    def cedar(s, u, v, r, ch):
        """Lebanon's cedar: three tiers of boughs on a short trunk."""
        R = r * s.h_
        for spread, top, bot in ((1.00, 0.16, 0.52), (0.72, -0.18, 0.20), (0.42, -0.54, -0.14)):
            s.c.poly([(s._x(u), s._y(v) + top * R - 0.34 * R),
                      (s._x(u) + spread * R, s._y(v) + bot * R),
                      (s._x(u), s._y(v) + bot * R - 0.14 * R),
                      (s._x(u) - spread * R, s._y(v) + bot * R)], ch)
        s.c.rect(s._x(u) - 0.08 * R, s._y(v) + 0.44 * R, s._x(u) + 0.08 * R, s._y(v) + 0.70 * R, ch)

    def crescent(s, u, v, r, ch, bg, bite=0.80, offset=0.30):
        """A disc with a smaller disc of the FIELD laid over it."""
        s.disc(u, v, r, ch)
        s.disc(u + offset * r, v, r * bite, bg)

    def checker(s, u0, v0, u1, v1, cols, rows, a, b):
        """A chequerboard — Croatia's shield, a finish flag."""
        for j in range(rows):
            for i in range(cols):
                s.box(u0 + (u1 - u0) * i / cols, v0 + (v1 - v0) * j / rows,
                      u0 + (u1 - u0) * (i + 1) / cols, v0 + (v1 - v0) * (j + 1) / rows,
                      a if (i + j) % 2 == 0 else b)

    def arm(s, u0, v0, u1, v1, thick, ch):
        """A thick straight arm from (u0,v0) to (u1,v1) — the limbs of a Y."""
        n, hw = 220, thick / 2.0 * s.h_
        for i in range(n + 1):
            t = i / n
            s.c.rect(s._x(u0 + (u1 - u0) * t) - hw, s._y(v0 + (v1 - v0) * t) - hw * 0.66,
                     s._x(u0 + (u1 - u0) * t) + hw, s._y(v0 + (v1 - v0) * t) + hw * 0.66, ch)

    def rail(s, ch):
        """What it hangs from, so it reads as a banner and not a painted wall."""
        s.c.rect(s._x(-0.04), s._y(0) - 2.4, s._x(1.04), s._y(0) - 0.8, ch)
        for u in (0.05, 0.95):
            s.c.rect(s._x(u) - 0.7, s._y(0) - 1.0, s._x(u) + 0.7, s._y(0) + 1.2, ch)

    def pack(s): return s.c.pack()


# The flags themselves. Palette entries are chars "1".."8"; "R" is the rail it
# hangs from. Kept as data so a new country is four lines, not a drawing.
FLAGS = [
    dict(id="ca", label="Canada", pal=["#D52B1E", "#FFFFFF"], draw=lambda f: (
        f.bands(["1", "2", "1"], weights=[1, 2, 1]), f.maple(0.5, 0.5, 0.36, "1"))),
    dict(id="lb", label="Lebanon", pal=["#ED1C24", "#FFFFFF", "#00A651"], draw=lambda f: (
        f.bands(["1", "2", "1"], vertical=False, weights=[1, 2, 1]), f.cedar(0.5, 0.5, 0.30, "3"))),
    dict(id="jp", label="Japan", pal=["#FFFFFF", "#BC002D"], draw=lambda f: (
        f.field("1"), f.disc(0.5, 0.5, 0.30, "2"))),
    dict(id="it", label="Italy", pal=["#008C45", "#F4F5F0", "#CD212A"], draw=lambda f: f.bands(["1", "2", "3"])),
    dict(id="fr", label="France", pal=["#0055A4", "#FFFFFF", "#EF4135"], draw=lambda f: f.bands(["1", "2", "3"])),
    dict(id="ie", label="Ireland", pal=["#169B62", "#FFFFFF", "#FF883E"], draw=lambda f: f.bands(["1", "2", "3"])),
    dict(id="be", label="Belgium", pal=["#2D2926", "#FAE042", "#ED2939"], draw=lambda f: f.bands(["1", "2", "3"])),
    dict(id="es", label="Spain", pal=["#AA151B", "#F1BF00", "#C8102E"], draw=lambda f: (
        f.bands(["1", "2", "1"], vertical=False, weights=[1, 2, 1]),
        # the arms: a crowned shield between two pillars
        f.box(0.235, 0.40, 0.255, 0.62, "1"), f.box(0.345, 0.40, 0.365, 0.62, "1"),
        f.box(0.265, 0.39, 0.335, 0.60, "1"), f.triangle([(0.265, 0.60), (0.335, 0.60), (0.30, 0.655)], "1"),
        f.box(0.275, 0.355, 0.325, 0.385, "1"))),
    dict(id="pt", label="Portugal", pal=["#046A38", "#DA291C", "#FFE900", "#FFFFFF"], draw=lambda f: (
        f.bands(["1", "2"], weights=[2, 3]), f.disc(0.40, 0.5, 0.22, "3"),
        f.disc(0.40, 0.5, 0.15, "4"), f.disc(0.40, 0.5, 0.10, "2"))),
    dict(id="gr", label="Greece", pal=["#0D5EAF", "#FFFFFF"], draw=lambda f: (
        f.stripes(9, ["1", "2"]), f.box(0, 0, 0.29, 5 / 9, "1"),
        f.box(0.115, 0, 0.175, 5 / 9, "2"), f.box(0, 0.21, 0.29, 0.34, "2"))),
    dict(id="de", label="Germany", pal=["#1A1A1A", "#DD0000", "#FFCE00"], draw=lambda f: f.bands(["1", "2", "3"], vertical=False)),
    dict(id="nl", label="Netherlands", pal=["#AE1C28", "#FFFFFF", "#21468B"], draw=lambda f: f.bands(["1", "2", "3"], vertical=False)),
    dict(id="pl", label="Poland", pal=["#FFFFFF", "#DC143C"], draw=lambda f: f.bands(["1", "2"], vertical=False)),
    dict(id="ua", label="Ukraine", pal=["#0057B7", "#FFD700"], draw=lambda f: f.bands(["1", "2"], vertical=False)),
    dict(id="ch", label="Switzerland", pal=["#D52B1E", "#FFFFFF"], draw=lambda f: (
        f.field("1"), f.box(0.42, 0.22, 0.58, 0.78, "2"), f.box(0.335, 0.37, 0.665, 0.63, "2"))),
    dict(id="dk", label="Denmark", pal=["#C60C30", "#FFFFFF"], draw=lambda f: (f.field("1"), f.cross(0.38, 0.20, "2"))),
    dict(id="se", label="Sweden", pal=["#006AA7", "#FECC00"], draw=lambda f: (f.field("1"), f.cross(0.38, 0.20, "2"))),
    dict(id="no", label="Norway", pal=["#BA0C2F", "#FFFFFF", "#00205B"], draw=lambda f: (
        f.field("1"), f.cross(0.38, 0.30, "2"), f.cross(0.38, 0.13, "3"))),
    dict(id="fi", label="Finland", pal=["#FFFFFF", "#002F6C"], draw=lambda f: (f.field("1"), f.cross(0.38, 0.20, "2"))),
    dict(id="is", label="Iceland", pal=["#02529C", "#FFFFFF", "#DC1E35"], draw=lambda f: (
        f.field("1"), f.cross(0.38, 0.30, "2"), f.cross(0.38, 0.14, "3"))),
    dict(id="gb", label="Britain", pal=["#012169", "#FFFFFF", "#C8102E"], draw=lambda f: (
        f.field("1"), f.saltire(0.30, "2"), f.saltire(0.13, "3"),
        f.cross(0.5, 0.33, "2"), f.cross(0.5, 0.20, "3"))),
    dict(id="us", label="United States", pal=["#B31942", "#FFFFFF", "#0A3161"], draw=lambda f: (
        f.stripes(13, ["1", "2"]), f.box(0, 0, 0.42, 7 / 13, "3"),
        [f.star(0.05 + (i % 5) * 0.085, 0.07 + (i // 5) * 0.12, 0.045, "2") for i in range(20)])),
    dict(id="mx", label="Mexico", pal=["#006847", "#FFFFFF", "#CE1126", "#6B4423", "#1E7A46"], draw=lambda f: (
        f.bands(["1", "2", "3"]),
        # eagle on the cactus, wreath beneath — a silhouette, at this size
        f.triangle([(0.44, 0.40), (0.50, 0.34), (0.56, 0.40), (0.50, 0.56)], "4"),
        f.triangle([(0.415, 0.36), (0.475, 0.46), (0.435, 0.50)], "4"),
        f.triangle([(0.585, 0.36), (0.525, 0.46), (0.565, 0.50)], "4"),
        f.box(0.487, 0.54, 0.513, 0.62, "5"),
        f.triangle([(0.44, 0.60), (0.50, 0.66), (0.56, 0.60), (0.50, 0.63)], "5"))),
    dict(id="br", label="Brazil", pal=["#009739", "#FEDD00", "#012169", "#FFFFFF"], draw=lambda f: (
        f.field("1"), f.diamond(0.5, 0.5, 0.40, 0.40, "2"), f.disc(0.5, 0.5, 0.20, "3"),
        f.box(0.36, 0.46, 0.64, 0.50, "4", only="3"))),
    dict(id="ar", label="Argentina", pal=["#74ACDF", "#FFFFFF", "#F6B40E"], draw=lambda f: (
        f.bands(["1", "2", "1"], vertical=False), f.star(0.5, 0.5, 0.15, "3", points=16, inner=0.62))),
    dict(id="au", label="Australia", pal=["#012169", "#FFFFFF", "#C8102E"], draw=lambda f: (
        f.field("1"), f.box(0, 0, 0.42, 0.5, "2"),
        f.box(0, 0, 0.42, 0.5, "1"), f.box(0.17, 0, 0.25, 0.5, "2"), f.box(0, 0.19, 0.42, 0.31, "2"),
        f.star(0.21, 0.75, 0.13, "2", points=7, inner=0.45),
        [f.star(u, v, 0.055, "2", points=7, inner=0.45) for u, v in
         ((0.72, 0.18), (0.85, 0.45), (0.72, 0.78), (0.60, 0.50), (0.78, 0.62))])),
    dict(id="ke", label="Kenya", pal=["#1A1A1A", "#BB0000", "#006600", "#FFFFFF"], draw=lambda f: (
        f.bands(["1", "4", "2", "4", "3"], vertical=False, weights=[6, 1, 6, 1, 6]),
        f.diamond(0.5, 0.5, 0.075, 0.44, "4"), f.diamond(0.5, 0.5, 0.055, 0.36, "2"))),
    dict(id="ma", label="Morocco", pal=["#C1272D", "#006233"], draw=lambda f: (
        f.field("1"), f.star(0.5, 0.5, 0.26, "2", points=5, inner=0.48),
        f.star(0.5, 0.5, 0.17, "1", points=5, inner=0.48))),
    dict(id="za", label="South Africa", pal=["#007A4D", "#FFFFFF", "#DE3831", "#002395", "#1A1A1A", "#FFB612"], draw=lambda f: (
        f.bands(["3", "4"], vertical=False),
        # the green Y, drawn as its two arms and its stem, each with a white edge
        f.arm(0.00, 0.06, 0.62, 0.50, 0.30, "2"), f.arm(0.00, 0.94, 0.62, 0.50, 0.30, "2"),
        f.arm(0.00, 0.06, 0.62, 0.50, 0.19, "1"), f.arm(0.00, 0.94, 0.62, 0.50, 0.19, "1"),
        f.box(0.00, 0.35, 0.62, 0.65, "2"), f.box(0.00, 0.405, 0.62, 0.595, "1"),
        # the black triangle at the hoist, in its gold sleeve
        f.triangle([(0, 0), (0.34, 0.5), (0, 1)], "6"),
        f.triangle([(0, 0.10), (0.24, 0.5), (0, 0.90)], "5"))),
    dict(id="jm", label="Jamaica", pal=["#009B3A", "#FED100", "#1A1A1A"], draw=lambda f: (
        f.field("1"), f.triangle([(0, 0), (0.5, 0.5), (0, 1)], "3"),
        f.triangle([(1, 0), (0.5, 0.5), (1, 1)], "3"), f.saltire(0.16, "2"))),
    dict(id="sct", label="Scotland", pal=["#005EB8", "#FFFFFF"], draw=lambda f: (
        f.field("1"), f.saltire(0.22, "2"))),
    dict(id="at", label="Austria", pal=["#ED2939", "#FFFFFF"], draw=lambda f: (
        f.bands(["1", "2", "1"], vertical=False))),
    dict(id="cz", label="Czechia", pal=["#FFFFFF", "#D7141A", "#11457E"], draw=lambda f: (
        f.bands(["1", "2"], vertical=False), f.triangle([(0, 0), (0.42, 0.5), (0, 1)], "3"))),
    dict(id="hr", label="Croatia", pal=["#FF0000", "#FFFFFF", "#171796"], draw=lambda f: (
        f.bands(["1", "2", "3"], vertical=False),
        f.checker(0.40, 0.24, 0.60, 0.76, 4, 5, "1", "2"))),
    dict(id="co", label="Colombia", pal=["#FCD116", "#003893", "#CE1126"], draw=lambda f: (
        f.bands(["1", "2", "3"], vertical=False, weights=[2, 1, 1]))),
    dict(id="pe", label="Peru", pal=["#D91023", "#FFFFFF"], draw=lambda f: f.bands(["1", "2", "1"])),
    dict(id="cl", label="Chile", pal=["#FFFFFF", "#D52B1E", "#0039A6"], draw=lambda f: (
        f.bands(["1", "2"], vertical=False), f.box(0, 0, 0.34, 0.5, "3"),
        f.star(0.17, 0.25, 0.15, "1"))),
    dict(id="ng", label="Nigeria", pal=["#008751", "#FFFFFF"], draw=lambda f: f.bands(["1", "2", "1"])),
    dict(id="gh", label="Ghana", pal=["#CE1126", "#FCD116", "#006B3F", "#1A1A1A"], draw=lambda f: (
        f.bands(["1", "2", "3"], vertical=False), f.star(0.5, 0.5, 0.15, "4"))),
    dict(id="eg", label="Egypt", pal=["#CE1126", "#FFFFFF", "#1A1A1A", "#C09300"], draw=lambda f: (
        f.bands(["1", "2", "3"], vertical=False),
        f.star(0.5, 0.5, 0.13, "4", points=5, inner=0.5))),
    dict(id="in", label="India", pal=["#FF9933", "#FFFFFF", "#138808", "#000080"], draw=lambda f: (
        f.bands(["1", "2", "3"], vertical=False),
        f.disc(0.5, 0.5, 0.14, "4"), f.disc(0.5, 0.5, 0.10, "2"), f.disc(0.5, 0.5, 0.035, "4"))),
    dict(id="cn", label="China", pal=["#EE1C25", "#FFDE00"], draw=lambda f: (
        f.field("1"), f.star(0.17, 0.30, 0.16, "2"),
        [f.star(u, v, 0.055, "2") for u, v in ((0.31, 0.14), (0.38, 0.26), (0.38, 0.42), (0.31, 0.54))])),
    dict(id="kr", label="South Korea", pal=["#FFFFFF", "#CD2E3A", "#0047A0", "#1A1A1A"], draw=lambda f: (
        f.field("1"),
        f.disc(0.5, 0.5, 0.21, "2"),
        f.box(0.30, 0.5, 0.70, 0.79, "3", only="2"),
        f.disc(0.5 - 0.105 * 52 / 76, 0.5, 0.105, "2"),
        f.disc(0.5 + 0.105 * 52 / 76, 0.5, 0.105, "3"),
        [f.box(u, v, u + 0.11, v + 0.035, "4") for u, v in
         ((0.10, 0.17), (0.10, 0.24), (0.10, 0.31), (0.79, 0.17), (0.79, 0.24), (0.79, 0.31),
          (0.10, 0.66), (0.10, 0.73), (0.10, 0.80), (0.79, 0.66), (0.79, 0.73), (0.79, 0.80))])),
    dict(id="tr", label="Turkey", pal=["#E30A17", "#FFFFFF"], draw=lambda f: (
        f.field("1"), f.crescent(0.34, 0.5, 0.20, "2", "1"), f.star(0.60, 0.5, 0.095, "2"))),
    dict(id="vn", label="Vietnam", pal=["#DA251D", "#FFFF00"], draw=lambda f: (
        f.field("1"), f.star(0.5, 0.5, 0.26, "2"))),
    dict(id="th", label="Thailand", pal=["#A51931", "#FFFFFF", "#2D2A4A"], draw=lambda f: (
        f.bands(["1", "2", "3", "2", "1"], vertical=False, weights=[1, 1, 2, 1, 1]))),
    dict(id="ph", label="Philippines", pal=["#0038A8", "#CE1126", "#FFFFFF", "#FCD116"], draw=lambda f: (
        f.bands(["1", "2"], vertical=False), f.triangle([(0, 0), (0.38, 0.5), (0, 1)], "3"),
        f.star(0.13, 0.5, 0.10, "4", points=8, inner=0.42),
        [f.star(u, v, 0.045, "4") for u, v in ((0.04, 0.16), (0.04, 0.84), (0.28, 0.5))])),
    dict(id="fin", label="Chequered", pal=["#F3F3F1", "#15171B"], draw=lambda f: (
        f.checker(0, 0, 1, 1, 8, 6, "2", "1"))),
    dict(id="ama", label="AmaComp", pal=["#D4147E", "#16D39A", "#C9A227", "#101215"], draw=lambda f: (
        f.field("4"), f.bands(["1", "2"], weights=[1, 1]),
        f.box(0.06, 0.12, 0.94, 0.88, "4"), f.disc(0.5, 0.5, 0.30, "3"), f.disc(0.5, 0.5, 0.21, "4"),
        f.star(0.5, 0.5, 0.16, "3"))),
]


def build(P):
    HC, HRX, HRY = P["HEAD_CY"], P["HEAD_RX"], P["HEAD_RY"]
    SH, HIP = P["SH_Y"], P["HIP_Y"]
    AX, AY0, AY1, AHW = P["ARM_X"], P["ARM_Y0"], P["ARM_Y1"], P["ARM_HW"]
    LX, LY0, LY1, LHW = P["LEG_X"], P["LEG_Y0"], P["LEG_Y1"], P["LEG_HW"]
    L, R = 40-LX, 40+LX
    FY = P["FOOT_Y"]
    TT, TW_, TH_ = P["TR_TOP"], P["TR_WAIST"], P["TR_HIP"]
    EYE_Y = HC + HRY*0.22
    G = {}

    def body(back=False):
        c = C(1)
        c.capsule(L, LY0, LY1, LHW, "S"); c.capsule(R, LY0, LY1, LHW, "S")
        c.capsule(AX, AY0, AY1, AHW, "S"); c.capsule(80-AX, AY0, AY1, AHW, "S")
        c.disc(AX, AY1-1, AHW+0.8, AHW+0.8, "S"); c.disc(80-AX, AY1-1, AHW+0.8, AHW+0.8, "S")
        c.trunk(SH, HIP+2, TT, TW_, TH_, "S")
        c.disc(40, SH+2, TT+0.5, 6.5, "S")
        c.rect(35, P["NECK_Y0"], 45, P["NECK_Y1"], "D")
        c.disc(40, HC, HRX, HRY, "S")
        if back:
            pass
        else:
            for cx in (40-HRX*0.45, 40+HRX*0.45):
                c.disc(cx, EYE_Y, HRX*0.19, HRY*0.21, "E")
                c.rect(cx-HRX*0.06, EYE_Y-HRY*0.13, cx+HRX*0.06, EYE_Y-HRY*0.02, "W")
            c.rect(40-HRX*0.2, HC+HRY*0.52, 40+HRX*0.2, HC+HRY*0.62, "M")
            for y in (HC+HRY*0.2, HC+HRY*0.28):
                c.rect(40, y, 41.2, y+0.1, "D", only="S")
        # knees and ankles
        for cx in (L, R):
            c.rect(cx-3.5, LY0+(LY1-LY0)*0.55, cx+3.5, LY0+(LY1-LY0)*0.55+1, "D", only="S")
        return ["".join(r) for r in c.g]

    def item(name, res, fn):
        c = C(res); fn(c)
        packed = c.pack()
        if packed is not None:
            G[name] = packed

    # head
    # hair and faces — drawn in the item's own colour ("K"), which is how six
    # athletes stop being the same person in different kit.
    def brows(c):
        c.rect(40-HRX*0.55, HC-HRY*0.16, 40-HRX*0.15, HC-HRY*0.06, "K")
        c.rect(40+HRX*0.15, HC-HRY*0.16, 40+HRX*0.55, HC-HRY*0.06, "K")

    # Brows go on with the hair, in the hair's colour, but they are not part of
    # any one style — otherwise every wig in the shop is photographed with a
    # pair of eyebrows floating under it.
    item("brows", 3, brows)
    item("hair_short", 3, lambda c: (
        c.disc(40, HC-1, HRX, HRY, "K", y1=HC-HRY*0.45),
        c.rect(40-HRX+2, HC-HRY*0.5, 40+HRX-2, HC-HRY*0.35, "K")))
    item("hair_buzz", 3, lambda c: (
        c.disc(40, HC-0.5, HRX-0.3, HRY-0.6, "K", y1=HC-HRY*0.58)))
    item("hair_curly", 3, lambda c: (
        [c.disc(40+dx, HC-HRY*0.62+dy, 4.6, 4.2, "K")
         for dx, dy in ((-11, 3.0), (-6, -1.2), (0, -3.0), (6, -1.2), (11, 3.0), (-13, 7.5), (13, 7.5))],
        c.rect(40-HRX+1.4, HC-HRY*0.52, 40+HRX-1.4, HC-HRY*0.34, "K")))
    item("hair_long", 3, lambda c: (
        c.disc(40, HC-1, HRX+0.8, HRY+0.2, "K", y1=HC-HRY*0.34),
        c.poly([(40-HRX-0.8, HC-HRY*0.50), (40-HRX+3.2, HC-HRY*0.50),
                (40-HRX+2.0, HC+HRY*0.95), (40-HRX-3.4, HC+HRY*0.86)], "K"),
        c.poly([(40+HRX+0.8, HC-HRY*0.50), (40+HRX-3.2, HC-HRY*0.50),
                (40+HRX-2.0, HC+HRY*0.95), (40+HRX+3.4, HC+HRY*0.86)], "K"),
        c.rect(40-HRX+2, HC-HRY*0.5, 40+HRX-2, HC-HRY*0.35, "K")))
    item("hair_bun", 3, lambda c: (
        c.disc(40, HC-1, HRX, HRY, "K", y1=HC-HRY*0.45),
        c.rect(40-HRX+2, HC-HRY*0.5, 40+HRX-2, HC-HRY*0.35, "K"),
        c.disc(40, HC-HRY*1.02, 4.2, 3.8, "K")))
    item("hair_short_back", 3, lambda c: c.disc(40, HC, HRX, HRY, "K"))
    item("hair_buzz_back", 3, lambda c: c.disc(40, HC-0.3, HRX-0.3, HRY-0.5, "K"))
    item("hair_curly_back", 3, lambda c: (
        c.disc(40, HC, HRX, HRY, "K"),
        [c.disc(40+dx, HC-HRY*0.62+dy, 4.6, 4.2, "K")
         for dx, dy in ((-11, 3.0), (-6, -1.2), (0, -3.0), (6, -1.2), (11, 3.0), (-13, 7.5), (13, 7.5))]))
    item("hair_long_back", 3, lambda c: (
        c.disc(40, HC, HRX+0.8, HRY+0.2, "K"),
        c.poly([(40-HRX-0.8, HC), (40+HRX+0.8, HC),
                (40+HRX+3.4, HC+HRY*1.05), (40-HRX-3.4, HC+HRY*1.05)], "K")))
    item("hair_bun_back", 3, lambda c: (
        c.disc(40, HC, HRX, HRY, "K"), c.disc(40, HC-HRY*1.02, 4.2, 3.8, "K")))

    item("beard_stubble", 3, lambda c: (
        c.disc(40, HC+HRY*0.34, HRX*0.90, HRY*0.66, "K", y0=HC+HRY*0.46),
        c.rect(40-HRX*0.90, HC+HRY*0.16, 40-HRX*0.66, HC+HRY*0.52, "K"),
        c.rect(40+HRX*0.66, HC+HRY*0.16, 40+HRX*0.90, HC+HRY*0.52, "K"),
        c.rect(40-HRX*0.30, HC+HRY*0.36, 40+HRX*0.30, HC+HRY*0.44, "K"),
        c.rect(40-HRX*0.22, HC+HRY*0.52, 40+HRX*0.22, HC+HRY*0.62, "M")))
    item("beard_full", 3, lambda c: (
        c.disc(40, HC+HRY*0.30, HRX*0.94, HRY*0.74, "K", y0=HC+HRY*0.40),
        c.rect(40-HRX*0.94, HC+HRY*0.02, 40-HRX*0.62, HC+HRY*0.54, "K"),
        c.rect(40+HRX*0.62, HC+HRY*0.02, 40+HRX*0.94, HC+HRY*0.54, "K"),
        c.rect(40-HRX*0.34, HC+HRY*0.34, 40+HRX*0.34, HC+HRY*0.44, "K"),
        c.rect(40-HRX*0.22, HC+HRY*0.52, 40+HRX*0.22, HC+HRY*0.62, "M")))
    item("moustache", 3, lambda c: (
        c.rect(40-HRX*0.36, HC+HRY*0.34, 40+HRX*0.36, HC+HRY*0.46, "K"),
        c.poly([(40-HRX*0.36, HC+HRY*0.34), (40-HRX*0.52, HC+HRY*0.46),
                (40-HRX*0.36, HC+HRY*0.46)], "K"),
        c.poly([(40+HRX*0.36, HC+HRY*0.34), (40+HRX*0.52, HC+HRY*0.46),
                (40+HRX*0.36, HC+HRY*0.46)], "K")))
    item("helmet", 4, lambda c: (
        c.disc(40, HC-2.5, HRX+2.2, HRY-0.8, "K", y1=HC-HRY*0.08),
        c.poly([(40-HRX-1, HC-HRY*0.22), (40+HRX+1, HC-HRY*0.22), (40+HRX+1.6, HC-HRY*0.06), (40-HRX-1.6, HC-HRY*0.06)], "K"),
        [c.poly([(x, HC-HRY*0.85), (x+3.2, HC-HRY*0.88), (x+3.8, HC-HRY*0.28), (x+0.6, HC-HRY*0.25)], "A", only="K")
         for x in (40-HRX*0.62, 40-HRX*0.06, 40+HRX*0.5)],
        c.poly([(40-HRX-1.4, HC-HRY*0.14), (40+HRX+1.4, HC-HRY*0.14), (40+HRX+1.5, HC-HRY*0.07), (40-HRX-1.5, HC-HRY*0.07)], "W", only="K"),
        [c.poly([(sx, HC-HRY*0.1), (sx+1.4, HC-HRY*0.1), (sx+dx+1.6, HC+HRY*0.42), (sx+dx+0.4, HC+HRY*0.42)], "A")
         for sx, dx in ((40-HRX*0.88, 2.2), (40+HRX*0.8, -2.2))]))
    item("aero", 4, lambda c: (
        c.disc(40, HC-3, HRX+2.6, HRY+0.6, "K", y1=HC+HRY*0.12),
        c.poly([(40-HRX*0.75, HC-HRY*0.80), (40+HRX*0.25, HC-HRY*0.98), (40+HRX*0.55, HC-HRY*0.82),
                (40-HRX*0.55, HC-HRY*0.62)], "W"),
        c.rect(40-HRX, HC-HRY*0.2, 40+HRX+2, HC+HRY*0.12, "K"),
        c.disc(40, HC+HRY*0.16, HRX*1.06, HRY*0.42, "A"),
        [c.rect(40-HRX*0.62+i*0.5, HC-HRY*0.02+i*0.5, 40-HRX*0.5+i*0.5, HC+HRY*0.06+i*0.5, "W") for i in range(14)]))
    item("aero_back", 4, lambda c: (
        c.disc(40, HC-3, HRX+2.6, HRY+0.6, "K", y1=HC+HRY*0.3),
        [c.rect(40-(HRX*0.75*(1-t)**0.75+1), HC+HRY*0.1+t*34, 40+(HRX*0.75*(1-t)**0.75+1), HC+HRY*0.1+t*34+1, "K")
         for t in [k/60 for k in range(61)]]))
    item("swimcap", 4, lambda c: (
        c.disc(40, HC-2, HRX+0.4, HRY, "K", y1=HC-HRY*0.02),
        c.poly([(39.7, HC-HRY*0.9), (40.3, HC-HRY*0.9), (41.2, HC-HRY*0.2), (38.8, HC-HRY*0.2)], "A")))
    item("runcap", 4, lambda c: (
        c.disc(40, HC-2.5, HRX+0.4, HRY-1, "K", y1=HC-HRY*0.12),
        c.rect(40-HRX+1, HC-HRY*0.22, 40+HRX-1, HC-HRY*0.04, "K"),
        c.poly([(40+HRX*0.8, HC-HRY*0.2), (40+HRX+13, HC-HRY*0.14), (40+HRX+17, HC+HRY*0.02), (40+HRX+12, HC+HRY*0.08), (40+HRX*0.8, HC-HRY*0.02)], "K"),
        c.rect(40-HRX+1, HC-HRY*0.09, 40+HRX-1, HC-HRY*0.04, "A")))
    item("beanie", 4, lambda c: (
        c.disc(40, HC-1.5, HRX+0.9, HRY-0.4, "K", y1=HC-HRY*0.04),
        c.rect(40-HRX-0.6, HC-HRY*0.26, 40+HRX+0.6, HC-HRY*0.02, "A"),
        c.disc(40, HC-HRY*1.02, 2.6, 2.6, "A")))
    item("headband", 4, lambda c: (
        c.rect(40-HRX+0.1, HC-HRY*0.36, 40+HRX-0.1, HC-HRY*0.12, "K"),
        c.rect(40-HRX+0.1, HC-HRY*0.30, 40+HRX-0.1, HC-HRY*0.26, "A"),
        c.rect(40-HRX*0.7, HC-HRY*0.35, 40-HRX*0.35, HC-HRY*0.31, "W")))
    item("visor", 4, lambda c: (
        c.disc(40, HC-1.0, HRX+0.7, HRY-0.2, "K", y0=HC-HRY*0.46, y1=HC-HRY*0.14),
        c.poly([(40+HRX*0.75, HC-HRY*0.36), (40+HRX+7.5, HC-HRY*0.30), (40+HRX+9.5, HC-HRY*0.16),
                (40+HRX+8.5, HC-HRY*0.06), (40+HRX*0.75, HC-HRY*0.12)], "K"),
        c.disc(40+HRX+8.0, HC-HRY*0.21, 1.6, 1.3, "K"),
        c.disc(40, HC-1.0, HRX+0.7, HRY-0.2, "A", y0=HC-HRY*0.30, y1=HC-HRY*0.22),
        c.rect(40-HRX*0.7, HC-HRY*0.42, 40-HRX*0.3, HC-HRY*0.38, "W")))
    # eyes
    item("shades", 4, lambda c: (
        c.disc(40-HRX*0.45, EYE_Y, HRX*0.36, HRY*0.23, "K"), c.disc(40+HRX*0.45, EYE_Y, HRX*0.36, HRY*0.23, "K"),
        c.rect(40-HRX*0.1, EYE_Y-0.8, 40+HRX*0.1, EYE_Y+0.8, "K"),
        c.rect(40-HRX-0.5, EYE_Y-1.4, 40-HRX*0.72, EYE_Y-0.2, "K"),
        c.rect(40+HRX*0.72, EYE_Y-1.4, 40+HRX+0.5, EYE_Y-0.2, "K"),
        c.rect(40-HRX*0.7, EYE_Y-1.6, 40-HRX*0.5, EYE_Y-0.6, "W")))
    item("goggles_back", 4, lambda c: (
        c.rect(40-HRX-1, EYE_Y-1.6, 40+HRX+1, EYE_Y+1.6, "K"),
        c.rect(40-HRX*0.5, EYE_Y-1.6, 40-HRX*0.2, EYE_Y+1.6, "W")))
    item("goggles", 4, lambda c: (
        c.rect(40-HRX-1, EYE_Y-1.6, 40+HRX+1, EYE_Y+1.6, "K"),
        c.disc(40-HRX*0.45, EYE_Y, HRX*0.4, HRY*0.3, "K"), c.disc(40+HRX*0.45, EYE_Y, HRX*0.4, HRY*0.3, "K"),
        c.disc(40-HRX*0.45, EYE_Y, HRX*0.29, HRY*0.21, "A"), c.disc(40+HRX*0.45, EYE_Y, HRX*0.29, HRY*0.21, "A"),
        c.rect(40-HRX*0.62, EYE_Y-HRY*0.15, 40-HRX*0.44, EYE_Y-HRY*0.04, "W")))
    # torso
    def torso(c, hem, sleeve, stripe=True, band=None):
        c.trunk(SH, hem, TT, TW_, TH_, "K")
        c.disc(40, SH+2, TT+0.5, 6.5, "K")
        c.capsule(AX, AY0, AY0+sleeve, AHW+0.4, "K"); c.capsule(80-AX, AY0, AY0+sleeve, AHW+0.4, "K")
        if stripe: c.rect(37, SH-4, 43, hem, "A")
        if band: c.rect(40-TH_+1, hem-band-1, 40+TH_-1, hem-1, "A")
    item("jersey", 2, lambda c: torso(c, HIP-2, (AY1-AY0)*0.5, True, 2))
    item("tee", 2, lambda c: torso(c, HIP-1, (AY1-AY0)*0.32, False, 2.4))
    item("trisuit", 2, lambda c: (torso(c, HIP+4, (AY1-AY0)*0.42, False, None),
        c.capsule(L, LY0, LY0+(LY1-LY0)*0.55, LHW+0.5, "K"), c.capsule(R, LY0, LY0+(LY1-LY0)*0.55, LHW+0.5, "K"),
        c.rect(40-TW_-0.8, SH+3, 40-TW_+1.6, LY0+(LY1-LY0)*0.55, "A", only="K"),
        c.rect(40+TW_-1.6, SH+3, 40+TW_+0.8, LY0+(LY1-LY0)*0.55, "A", only="K"),
        c.rect(40-TT+1.0, SH-5.6, 40+TT-1.0, SH-3.8, "A")))
    # legs
    def shorts(c, frac):
        c.trunk(HIP-4, HIP+2, TH_, TH_, TH_, "K")
        end = LY0 + (LY1-LY0)*frac
        c.capsule(L, LY0-2, end, LHW+0.5, "K"); c.capsule(R, LY0-2, end, LHW+0.5, "K")
    item("bibs", 2, lambda c: shorts(c, 0.62))
    item("runshorts", 2, lambda c: shorts(c, 0.42))
    item("jammers", 2, lambda c: shorts(c, 0.78))
    # socks and shoes
    def socks(c, top_frac):
        top = LY0 + (LY1-LY0)*top_frac
        for cx in (L, R):
            c.capsule(cx, top, FY-1.5, LHW-0.1, "K"); c.rect(cx-LHW+0.1, top, cx+LHW-0.1, top+1, "A")
    item("socks_short", 3, lambda c: socks(c, 0.72))
    item("socks_tall", 3, lambda c: socks(c, 0.42))
    def shoe(c, sole_h, kind):
        hw = LHW + 0.2
        for cx in (L, R):
            c.rect(cx-hw, FY, cx+hw, FY+7, "K")
            c.disc(cx, FY+1, hw, 3.0, "K"); c.disc(cx, FY+6.2, hw, 2.6, "K")
            c.rect(cx-1.2, FY, cx+1.2, FY+1.6, "A")
            c.rect(cx-hw-0.3, FY+7-sole_h, cx+hw+0.3, FY+8.6, "A")
            if kind == "strap":
                c.rect(cx-hw, FY+2.2, cx+hw, FY+3.3, "A"); c.rect(cx-hw, FY+4.4, cx+hw, FY+5.5, "A")
            elif kind == "lace":
                for dy in (2.0, 3.5, 5.0): c.rect(cx-2.6, FY+dy, cx+2.6, FY+dy+0.6, "A")
            else:
                c.rect(cx-hw, FY+2.8, cx+hw, FY+4.0, "A")
                c.rect(cx-hw-0.3, FY+7.8, cx+hw+0.3, FY+9.0, "W")
    item("bikeshoes", 3, lambda c: shoe(c, 1.4, "strap"))
    item("runshoes", 3, lambda c: shoe(c, 2.2, "lace"))
    item("carbon", 3, lambda c: shoe(c, 2.8, "plate"))
    item("barefoot", 2, lambda c: [ (c.disc(cx, FY+3, LHW, 4.2, "S"), c.rect(cx-LHW, FY, cx+LHW, FY+4, "S")) for cx in (L, R) ])
    item("singlet", 2, lambda c: (
        c.trunk(SH+1, HIP-1, TT-1.2, TW_-0.8, TH_-0.8, "K"),
        c.disc(40, SH+3, TT-1.0, 5.5, "K"),
        c.rect(40-TH_+1, HIP-3.4, 40+TH_-1, HIP-1, "A")))
    item("longsleeve", 2, lambda c: (
        torso(c, HIP-1, (AY1-AY0)*0.92, False, None),
        c.poly([(AX-AHW-0.6, AY0), (40-TT+1, SH-2), (40-TT+1, SH+8), (AX-AHW-0.6, AY0+9)], "K"),
        c.poly([(80-AX+AHW+0.6, AY0), (40+TT-1, SH-2), (40+TT-1, SH+8), (80-AX+AHW+0.6, AY0+9)], "K"),
        c.rect(AX-AHW-0.6, AY0+(AY1-AY0)*0.86, AX+AHW+0.6, AY0+(AY1-AY0)*0.92, "A"),
        c.rect(80-AX-AHW-0.6, AY0+(AY1-AY0)*0.86, 80-AX+AHW+0.6, AY0+(AY1-AY0)*0.92, "A")))
    item("jacket", 2, lambda c: (
        torso(c, HIP, (AY1-AY0)*0.92, False, None),
        c.poly([(AX-AHW-0.6, AY0), (40-TT+1, SH-2), (40-TT+1, SH+8), (AX-AHW-0.6, AY0+9)], "K"),
        c.poly([(80-AX+AHW+0.6, AY0), (40+TT-1, SH-2), (40+TT-1, SH+8), (80-AX+AHW+0.6, AY0+9)], "K"),
        c.rect(39.2, SH-5, 40.8, HIP, "A"),
        c.rect(40-TT+0.5, SH-5.5, 40+TT-0.5, SH-3.2, "A"),
        c.rect(AX-AHW-0.6, AY0+(AY1-AY0)*0.86, AX+AHW+0.6, AY0+(AY1-AY0)*0.92, "A"),
        c.rect(80-AX-AHW-0.6, AY0+(AY1-AY0)*0.86, 80-AX+AHW+0.6, AY0+(AY1-AY0)*0.92, "A")))
    item("wetsuit", 2, lambda c: (
        torso(c, HIP+4, (AY1-AY0)*0.92, False, None),
        c.poly([(AX-AHW-0.6, AY0), (40-TT+1, SH-2), (40-TT+1, SH+8), (AX-AHW-0.6, AY0+9)], "K"),
        c.poly([(80-AX+AHW+0.6, AY0), (40+TT-1, SH-2), (40+TT-1, SH+8), (80-AX+AHW+0.6, AY0+9)], "K"),
        c.capsule(L, LY0, LY0+(LY1-LY0)*0.62, LHW+0.6, "K"), c.capsule(R, LY0, LY0+(LY1-LY0)*0.62, LHW+0.6, "K"),
        c.rect(40-TT+0.8, SH-5.8, 40+TT-0.8, SH-3.6, "A"),
        c.rect(39.4, SH-3.6, 40.6, SH+12, "A"),
        c.rect(40-TW_-0.6, SH+4, 40-TW_+1.2, HIP+3, "A", only="K"),
        c.rect(40+TW_-1.2, SH+4, 40+TW_+0.6, HIP+3, "A", only="K")))
    item("tights", 2, lambda c: (
        c.trunk(HIP-4, HIP+2, TH_, TH_, TH_, "K"),
        c.capsule(L, LY0-2, FY-0.5, LHW+0.4, "K"), c.capsule(R, LY0-2, FY-0.5, LHW+0.4, "K"),
        c.rect(L-LHW-0.4, FY-3.5, L+LHW+0.4, FY-2.3, "A"), c.rect(R-LHW-0.4, FY-3.5, R+LHW+0.4, FY-2.3, "A")))
    item("splitshorts", 2, lambda c: (
        c.trunk(HIP-4, HIP+2, TH_, TH_, TH_, "K"),
        c.rect(L-LHW-0.8, HIP+1, R+LHW+0.8, LY0+(LY1-LY0)*0.30, "K"),
        c.rect(40-2.0, HIP+3, 40+2.0, LY0+(LY1-LY0)*0.30, "."),
        c.poly([(L-LHW-0.9, LY0+(LY1-LY0)*0.30), (L+LHW*0.2, LY0+(LY1-LY0)*0.30),
                (L-LHW-0.9, LY0+(LY1-LY0)*0.14)], "."),
        c.poly([(R+LHW+0.9, LY0+(LY1-LY0)*0.30), (R-LHW*0.2, LY0+(LY1-LY0)*0.30),
                (R+LHW+0.9, LY0+(LY1-LY0)*0.14)], "."),
        c.rect(40-TH_+0.5, HIP-3.6, 40+TH_-0.5, HIP-2.2, "A")))
    item("trail", 3, lambda c: (shoe(c, 3.2, "lace"),
        [c.rect(cx-LHW-0.5+i*1.8, FY+7.4, cx-LHW+0.4+i*1.8, FY+8.4, ".") for cx in (L, R) for i in range(4)]))
    item("slides", 3, lambda c: [(
        c.rect(cx-LHW, FY-2, cx+LHW, FY+5.0, "S"),
        c.disc(cx, FY+4.4, LHW, 3.2, "S"),
        [c.rect(cx-LHW+0.2+i*1.5, FY+6.0, cx-LHW+1.3+i*1.5, FY+7.0, "D") for i in range(4)],
        c.rect(cx-LHW-0.8, FY+7.0, cx+LHW+0.8, FY+9.0, "K"),
        c.disc(cx, FY+8.0, LHW+0.8, 1.4, "K"),
        c.rect(cx-LHW-0.9, FY+8.6, cx+LHW+0.9, FY+9.6, "A"),
        c.rect(cx-LHW-0.3, FY+1.6, cx+LHW+0.3, FY+3.6, "K"),
        c.rect(cx-LHW-0.3, FY+2.0, cx+LHW+0.3, FY+2.6, "A")) for cx in (L, R)])
    item("socks_stripe", 3, lambda c: (socks(c, 0.42),
        [c.rect(cx-LHW+0.1, LY0+(LY1-LY0)*0.42+2.4+i*2.6, cx+LHW-0.1, LY0+(LY1-LY0)*0.42+3.6+i*2.6, "A")
         for cx in (L, R) for i in range(4)]))
    # hands
    item("gloves", 3, lambda c: [(
        c.rect(cx-AHW-1.8, AY1-AHW-2.6, cx+AHW+1.8, AY1+1.6, "K"),
        c.disc(cx, AY1+1.4, AHW+1.8, AHW+1.6, "K"),
        c.rect(cx-AHW-1.9, AY1-AHW-3.6, cx+AHW+1.9, AY1-AHW-1.6, "A"),
        c.rect(cx-AHW-1.2, AY1-AHW+0.4, cx+AHW+1.2, AY1-AHW+1.4, "W"),
        [c.rect(cx-AHW-0.9+i*1.9, AY1+1.8, cx-AHW+0.3+i*1.9, AY1+3.4, ".") for i in range(1, 3)]) for cx in (AX, 80-AX)])
    item("armwarmers", 2, lambda c: [(
        c.capsule(cx, AY0+(AY1-AY0)*0.42, AY1-1.5, AHW+0.5, "K"),
        c.rect(cx-AHW-0.5, AY0+(AY1-AY0)*0.42, cx+AHW+0.5, AY0+(AY1-AY0)*0.50, "A")) for cx in (AX, 80-AX)])
    # prizes — won, not sold
    item("laurel", 4, lambda c: (
        [c.disc(40 + (HRX + 1.7) * math.cos(a),
                HC - 1 + (HRY + 1.3) * math.sin(a), 2.5, 2.1, "K")
         for a in [(-0.93 + k * 0.078) * math.pi for k in range(12)]],
        [c.disc(40 + (HRX - 0.8) * math.cos(a),
                HC - 1 + (HRY - 0.6) * math.sin(a), 1.9, 1.6, "K")
         for a in [(-0.90 + k * 0.086) * math.pi for k in range(11)]],
        [c.disc(40 + sx * (HRX + 1.2), HC + HRY * 0.12, 2.0, 1.7, "A") for sx in (-1, 1)]))
    item("medal", 4, lambda c: (
        c.poly([(40-4.6, SH-4), (40-1.0, SH+7), (40+1.0, SH+7), (40-2.4, SH-4)], "A"),
        c.poly([(40+4.6, SH-4), (40+1.0, SH+7), (40-1.0, SH+7), (40+2.4, SH-4)], "A"),
        c.disc(40, SH+10.5, 4.4, 4.4, "K"),
        c.disc(40, SH+10.5, 3.1, 3.1, "W"),
        c.disc(40, SH+10.5, 2.2, 2.2, "K")))
    item("sash", 2, lambda c: (
        [c.rect(40-TT-1.5+t*0.70*TT, SH-5+t*28, 40-TT+6.5+t*0.70*TT, SH+1.0+t*28, "K")
         for t in [k/60 for k in range(61)]],
        [c.rect(40-TT-1.5+t*0.70*TT, SH-3.4+t*28, 40-TT+6.5+t*0.70*TT, SH-2.2+t*28, "A")
         for t in [k/60 for k in range(61)]]))
    # watch
    def watch(c):
        cx, cy = AX, (AY0+AY1)/2 + 2
        c.rect(cx-4.8, cy-4.4, cx+4.8, cy-1.4, "K"); c.rect(cx-4.8, cy+1.4, cx+4.8, cy+4.4, "K")
        c.disc(cx, cy, 4.15, 4.15, "K"); c.disc(cx, cy, 3.5, 3.5, "A")
        c.disc(cx, cy, 2.85, 2.85, "K"); c.disc(cx, cy, 2.6, 2.6, "W")
        c.rect(cx-1.55, cy-1.15, cx+1.55, cy-0.35, "K"); c.rect(cx-1.15, cy+0.25, cx+1.15, cy+0.7, "K")
        c.rect(cx+4.3, cy-1.0, cx+5.2, cy+0.0, "K")
    item("watch", 4, watch)
    # flags: their own sheets, with their own colours
    flags = {}
    for spec in FLAGS:
        f = Flag()
        spec["draw"](f)
        f.rail("R")
        flags[spec["id"]] = {"label": spec["label"], "pal": spec["pal"], "sheet": f.pack()}

    return {"W": W, "H": H, "base": body(False), "back": body(True), "g": G, "flags": flags}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "classic"
    out = build(CHIBI if which == "chibi" else CLASSIC)
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "lib", "avatar", "sprites.json")
    json.dump(out, open(dest, "w"))
    print("built", which, "| items:", len(out["g"]), "| flags:", len(out["flags"]), "->", os.path.relpath(dest))
