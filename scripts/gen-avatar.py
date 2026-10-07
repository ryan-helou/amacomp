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
    def curls(c, back=False):
        """Curls, not seven bubbles in a row.

        A cap of hair first so there are no gaps down to the scalp, then a
        crowd of small discs of three sizes around its edge — same rule as a
        cauliflower: one size reads as a pattern, three read as texture.
        """
        if back:
            c.disc(40, HC, HRX, HRY, "K")
        c.disc(40, HC-1.6, HRX-0.4, HRY-1.0, "K", y1=HC-HRY*0.30)
        c.rect(40-HRX+1.2, HC-HRY*0.44, 40+HRX-1.2, HC-HRY*0.28, "K")
        for ang, r in ((-1.44, 3.1), (-1.20, 4.0), (-0.96, 3.2), (-0.70, 4.2),
                       (-0.44, 3.3), (-0.18, 4.1), (0.08, 3.2), (0.34, 4.2),
                       (0.60, 3.3), (0.86, 4.1), (1.10, 3.2), (1.34, 3.9),
                       (1.52, 3.0)):
            cx = 40 + (HRX - 1.4) * math.sin(ang)
            cy = HC - 1.4 - (HRY - 2.6) * math.cos(ang)
            c.disc(cx, cy, r, r*0.92, "K")

    item("hair_curly", 3, lambda c: curls(c))
    item("hair_curly_back", 3, lambda c: curls(c, back=True))
    item("hair_bun", 3, lambda c: (
        c.disc(40, HC-1, HRX, HRY, "K", y1=HC-HRY*0.45),
        c.rect(40-HRX+2, HC-HRY*0.5, 40+HRX-2, HC-HRY*0.35, "K"),
        # The knot was a nub. It is the point of the style, so it is a knot.
        c.disc(40, HC-HRY*1.06, 5.4, 4.8, "K")))
    item("hair_short_back", 3, lambda c: c.disc(40, HC, HRX, HRY, "K"))
    item("hair_buzz_back", 3, lambda c: c.disc(40, HC-0.3, HRX-0.3, HRY-0.5, "K"))

    item("hair_bun_back", 3, lambda c: (
        c.disc(40, HC, HRX, HRY, "K"), c.disc(40, HC-HRY*1.06, 5.4, 4.8, "K")))

    item("beard_stubble", 3, lambda c: (
        c.disc(40, HC+HRY*0.48, HRX*0.88, HRY*0.60, "K", y0=HC+HRY*0.56),
        c.rect(40-HRX*0.92, HC+HRY*0.54, 40-HRX*0.74, HC+HRY*0.70, "K"),
        c.rect(40+HRX*0.74, HC+HRY*0.54, 40+HRX*0.92, HC+HRY*0.70, "K"),
        c.rect(40-HRX*0.30, HC+HRY*0.46, 40+HRX*0.30, HC+HRY*0.52, "K"),
        c.rect(40-HRX*0.22, HC+HRY*0.52, 40+HRX*0.22, HC+HRY*0.62, "M")))
    item("beard_full", 3, lambda c: (
        c.disc(40, HC+HRY*0.44, HRX*0.92, HRY*0.66, "K", y0=HC+HRY*0.50),
        c.rect(40-HRX*0.96, HC+HRY*0.48, 40-HRX*0.74, HC+HRY*0.70, "K"),
        c.rect(40+HRX*0.74, HC+HRY*0.48, 40+HRX*0.96, HC+HRY*0.70, "K"),
        c.rect(40-HRX*0.34, HC+HRY*0.44, 40+HRX*0.34, HC+HRY*0.52, "K"),
        c.rect(40-HRX*0.22, HC+HRY*0.52, 40+HRX*0.22, HC+HRY*0.62, "M")))
    # It hung down over the top of the mouth, so the face read as a frown with
    # hair on it. The mouth starts at HC+HRY*0.52; nothing here goes past 0.51.
    item("moustache", 3, lambda c: c.poly([
        (40-HRX*0.40, HC+HRY*0.51), (40-HRX*0.33, HC+HRY*0.42),
        (40-HRX*0.11, HC+HRY*0.40), (40, HC+HRY*0.44),
        (40+HRX*0.11, HC+HRY*0.40), (40+HRX*0.33, HC+HRY*0.42),
        (40+HRX*0.40, HC+HRY*0.51), (40+HRX*0.30, HC+HRY*0.48),
        (40, HC+HRY*0.50), (40-HRX*0.30, HC+HRY*0.48)], "K"))
    def helmet(c):
        """A road helmet: shell, vents cut INTO the shell, rim, straps.

        The vents were three white bars painted on the outside, which is why
        it read as a striped hat. A vent is a hole, so these are cut out of
        the shell to the dark inside, and they follow the dome instead of
        standing upright on it.
        """
        c.disc(40, HC-2.5, HRX+2.2, HRY-0.8, "K", y1=HC-HRY*0.08)
        c.poly([(40-HRX-1, HC-HRY*0.22), (40+HRX+1, HC-HRY*0.22),
                (40+HRX+1.6, HC-HRY*0.06), (40-HRX-1.6, HC-HRY*0.06)], "K")
        # five vents, the outer ones shorter and raked, as they sit on a curve
        for x, top, bot, rake in ((-0.70, 0.52, 0.22, -1.5), (-0.36, 0.74, 0.24, -0.7),
                                  (0.00, 0.82, 0.25, 0.0), (0.36, 0.74, 0.24, 0.7),
                                  (0.70, 0.52, 0.22, 1.5)):
            cx = 40 + HRX*x
            c.poly([(cx-1.5, HC-HRY*top), (cx+1.5, HC-HRY*top),
                    (cx+1.5+rake, HC-HRY*bot), (cx-1.5+rake, HC-HRY*bot)], ".", only="K")
        # the rim, lit along the top edge, and a pad showing under it
        c.poly([(40-HRX-1.4, HC-HRY*0.16), (40+HRX+1.4, HC-HRY*0.16),
                (40+HRX+1.5, HC-HRY*0.11), (40-HRX-1.5, HC-HRY*0.11)], "W", only="K")
        c.rect(40-HRX*0.68, HC-HRY*0.09, 40+HRX*0.68, HC-HRY*0.03, "A", only="K")
        # straps down to a buckle under each ear
        for sx, dx in ((40-HRX*0.90, 2.4), (40+HRX*0.86, -2.4)):
            c.poly([(sx, HC-HRY*0.08), (sx+1.1, HC-HRY*0.08),
                    (sx+dx+1.3, HC+HRY*0.46), (sx+dx+0.5, HC+HRY*0.46)], "A")

    item("helmet", 4, helmet)
    def aero(c):
        """Shell, brow, visor.

        The visor used to be an ellipse as wide and as deep as the whole face —
        a gold dinner plate with a nose behind it. It is a band across the eyes
        now: the shell comes down to the brow, the visor hangs off that brow,
        and its bottom edge is darkened so the glass has a rim.
        """
        c.disc(40, HC-3.2, HRX+2.4, HRY+0.4, "K", y1=HC+HRY*0.06)
        c.rect(40-HRX-1.4, HC-HRY*0.14, 40+HRX+2.2, HC+HRY*0.06, "K")
        # Cheek pieces down each side. Without them the glass has nothing
        # holding it and the whole thing reads as a bowl balanced on a chin.
        for sx in (-1, 1):
            c.poly([(40+sx*(HRX+1.5), HC-HRY*0.10), (40+sx*(HRX-2.2), HC-HRY*0.10),
                    (40+sx*(HRX-3.6), HC+HRY*0.54), (40+sx*(HRX-0.2), HC+HRY*0.44)], "K")
        VT, VB = HC + HRY*0.06, HC + HRY*0.36
        c.poly([(40-HRX*0.88, VT+1.4), (40-HRX*0.78, VT), (40+HRX*0.78, VT),
                (40+HRX*0.88, VT+1.4), (40+HRX*0.82, VB-1.2), (40+HRX*0.70, VB),
                (40-HRX*0.70, VB), (40-HRX*0.82, VB-1.2)], "A")
        c.rect(40-HRX*0.80, VB-1.3, 40+HRX*0.80, VB, "K")
        # No glare. The streaks down the shell and across the glass read as
        # torn paper stuck to a helmet, not as light on it.

    item("aero", 4, aero)
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
    # A kippa: a small round cap on the crown, narrower than the head and only
    # a slice of it, sitting a touch proud of the hair. The band near its edge
    # is the accent — the stitched ring on a knitted one.
    item("kippa", 4, lambda c: (
        c.disc(40, HC-1.4, HRX*0.60, HRY, "K", y1=HC-HRY*0.74),
        c.disc(40, HC-1.4, HRX*0.60, HRY, "A", y0=HC-HRY*0.84, y1=HC-HRY*0.77)))
    item("visor", 4, lambda c: (
        c.disc(40, HC-1.0, HRX+0.7, HRY-0.2, "K", y0=HC-HRY*0.46, y1=HC-HRY*0.14),
        c.poly([(40+HRX*0.75, HC-HRY*0.36), (40+HRX+7.5, HC-HRY*0.30), (40+HRX+9.5, HC-HRY*0.16),
                (40+HRX+8.5, HC-HRY*0.06), (40+HRX*0.75, HC-HRY*0.12)], "K"),
        c.disc(40+HRX+8.0, HC-HRY*0.21, 1.6, 1.3, "K"),
        c.disc(40, HC-1.0, HRX+0.7, HRY-0.2, "A", y0=HC-HRY*0.30, y1=HC-HRY*0.22),
        c.rect(40-HRX*0.7, HC-HRY*0.42, 40-HRX*0.3, HC-HRY*0.38, "W")))
    # eyes
    def shades(c):
        """A wayfarer.

        Two things make the shape, and the first pass had neither working. The
        BROW is one heavy rail straight across both lenses, thicker than any
        other part of the frame. And the lens has to be a different colour
        from the frame, or the whole pair is one dark blob the width of the
        face: the frame is the item's colour, the glass is its accent.

        It also has to sit ON the eyes. The first pass hung off the brow and
        covered the cheeks, which read as a welding mask.
        """
        top, bot = EYE_Y - HRY*0.155, EYE_Y + HRY*0.115
        out, inn = HRX*0.88, 2.0
        for sx in (-1, 1):
            xo, xi = 40 + sx*out, 40 + sx*inn
            lo, hi = min(xo, xi), max(xo, xi)
            # the glass, wider at the brow and tucked in at the bottom
            c.poly([(xi, top), (xo, top - 1.0), (xo - sx*0.8, bot - 0.9),
                    (xi + sx*0.8, bot)], "A")
            # rim down the outer edge and along the bottom, thin
            c.poly([(xo, top - 1.0), (xo - sx*1.0, top - 0.8),
                    (xo - sx*1.6, bot - 0.8), (xo - sx*0.8, bot - 0.9)], "K")
            c.rect(lo + 0.6, bot - 1.0, hi - 0.6, bot + 0.1, "K")
            # the heavy brow rail, proud of the glass all the way out
            c.rect(lo, top - 2.2, hi, top - 0.1, "K")
            # the arm, back toward the ear
            c.rect(40 + sx*(out - 0.4), top - 2.0, 40 + sx*(HRX + 0.8), top - 0.2, "K")
        # the bridge: on a wayfarer it is part of the brow, not a wire
        c.rect(40 - inn - 0.4, top - 2.2, 40 + inn + 0.4, top + 0.9, "K")
        # one hard reflection across the left lens
        [c.rect(40 - out + 1.2 + i*0.30, top + 0.4 + i*0.30,
                40 - out + 3.0 + i*0.30, top + 1.9 + i*0.30, "W") for i in range(6)]

    item("shades", 4, shades)

    def viper(c):
        """A one-piece shield, the way a sprint pair is built: no bridge, no
        rims, just a single lens from temple to temple with a blade of frame
        along the top and a notch cut for the nose."""
        top, bot = EYE_Y - HRY*0.155, EYE_Y + HRY*0.16
        out = HRX*0.94
        c.poly([(40 - out, top - 0.2), (40, top - 1.4), (40 + out, top - 0.2),
                (40 + out - 0.8, bot - 1.4), (40 + HRX*0.50, bot),
                (40 - HRX*0.50, bot), (40 - out + 0.8, bot - 1.4)], "A")
        # the blade of frame along the brow, and the arms off its ends
        c.poly([(40 - out, top - 0.2), (40, top - 1.4), (40 + out, top - 0.2),
                (40 + out, top + 1.0), (40, top - 0.2), (40 - out, top + 1.0)], "K")
        for sx in (-1, 1):
            c.rect(40 + sx*(out - 0.6), top - 0.4, 40 + sx*(HRX + 0.8), top + 1.4, "K")
        # the notch over the nose
        c.poly([(40 - 2.2, bot + 0.2), (40 + 2.2, bot + 0.2), (40, bot - 2.2)], ".")
        # the sweep of light a curved shield carries, corner to corner
        [c.rect(40 - out + 1.4 + i*0.40, top + 0.9 + i*0.26,
                40 - out + 3.2 + i*0.40, top + 2.5 + i*0.26, "W") for i in range(9)]

    item("viper", 4, viper)
    # torso
    def torso(c, hem, sleeve, stripe=True, band=None):
        c.trunk(SH, hem, TT, TW_, TH_, "K")
        c.disc(40, SH+2, TT+0.5, 6.5, "K")
        c.capsule(AX, AY0, AY0+sleeve, AHW+0.4, "K"); c.capsule(80-AX, AY0, AY0+sleeve, AHW+0.4, "K")
        if stripe: c.rect(37, SH-4, 43, hem, "A")
        if band: c.rect(40-TH_+1, hem-band-1, 40+TH_-1, hem-1, "A")
    item("jersey", 2, lambda c: torso(c, HIP-2, (AY1-AY0)*0.5, True, 2))
    item("tee", 2, lambda c: torso(c, HIP-1, (AY1-AY0)*0.32, False, 2.4))
    # It had sleeves and a collar, so it read as a vest with piping. A tri
    # suit is sleeveless and it does not stop at the waist: one piece from
    # the shoulder straps to mid-thigh, a panel down each flank, a short zip.
    def trisuit(c):
        END = LY0 + (LY1-LY0)*0.58
        c.trunk(SH+2, HIP+4, TT-1.2, TW_-0.6, TH_-0.4, "K")
        # The straps have to land ON the shoulder. The body's shoulder is a disc
        # centred at SH+2 with a half-height of 6.5, so above about SH-0.5
        # there is nothing out there but the neck — a strap drawn to SH-2.4,
        # as these were, hangs its top corner in mid-air.
        for sx in (-1, 1):
            c.poly([(40+sx*(TT-1.5), SH+4.5), (40+sx*(TT-6.0), SH+4.5),
                    (40+sx*(TT-6.5), SH-0.5), (40+sx*(TT-2.1), SH-0.5)], "K")
        c.capsule(L, LY0, END, LHW+0.5, "K"); c.capsule(R, LY0, END, LHW+0.5, "K")
        c.rect(40-TW_-0.9, SH+4, 40-TW_+1.9, END, "A", only="K")
        c.rect(40+TW_-1.9, SH+4, 40+TW_+0.9, END, "A", only="K")
        c.rect(39.3, SH+2, 40.7, SH+12, "A", only="K")

    item("trisuit", 2, trisuit)
    # The full-length one. Ryan, 2026-10-07: "an all black tri suit that is
    # full long sleeve and pants, all black." Sleeves to the wrist and legs to
    # the ankle, like the wetsuit — but no cuffs and no collar, which are what
    # make the wetsuit a wetsuit. What keeps it a TRI suit is the same panel
    # down each flank and the short zip, drawn in the accent.
    def trisuit_long(c):
        END = LY0 + (LY1-LY0)*0.97
        torso(c, HIP+4, (AY1-AY0)*0.96, False, None)
        c.poly([(AX-AHW-0.6, AY0), (40-TT+1, SH-2), (40-TT+1, SH+8), (AX-AHW-0.6, AY0+9)], "K")
        c.poly([(80-AX+AHW+0.6, AY0), (40+TT-1, SH-2), (40+TT-1, SH+8), (80-AX+AHW+0.6, AY0+9)], "K")
        c.capsule(L, LY0, END, LHW+0.5, "K"); c.capsule(R, LY0, END, LHW+0.5, "K")
        c.rect(40-TW_-0.9, SH+4, 40-TW_+1.9, HIP+4, "A", only="K")
        c.rect(40+TW_-1.9, SH+4, 40+TW_+0.9, HIP+4, "A", only="K")
        c.rect(39.3, SH+2, 40.7, SH+12, "A", only="K")

    item("trisuit_long", 2, trisuit_long)
    # legs
    def shorts(c):
        """ONE pair of shorts, Ryan's call: the bibs, the jammers and the
        tights were four lengths of the same box and told you nothing apart
        at board size. What is left is a running short with a waistband and a
        split up each outside seam, and colour does the rest."""
        c.trunk(HIP-4, HIP+2, TH_, TH_, TH_, "K")
        end = LY0 + (LY1-LY0)*0.46
        c.capsule(L, LY0-2, end, LHW+0.7, "K"); c.capsule(R, LY0-2, end, LHW+0.7, "K")
        c.rect(40-TH_, HIP-4, 40+TH_, HIP-2.2, "A")          # waistband
        for cx, sx in ((L, -1), (R, 1)):                      # the side split
            c.rect(cx + sx*(LHW-0.1), end-4.6, cx + sx*(LHW+0.8), end-0.6, "A", only="K")

    item("shorts", 2, shorts)
    # shoes
    def shoe(c, sole_h, kind):
        """Five shoes off one last.

        Seen from the front a shoe is a box, so four of these were the same
        box in four colours. The marks on the upper are the only thing that
        can tell them apart at the size the shop draws them, so each kind gets
        one loud mark rather than three quiet ones.
        """
        hw = LHW + 0.2
        for cx in (L, R):
            c.rect(cx-hw, FY, cx+hw, FY+7, "K")
            c.disc(cx, FY+1, hw, 3.0, "K"); c.disc(cx, FY+6.2, hw, 2.6, "K")
            c.rect(cx-hw-0.3, FY+7-sole_h, cx+hw+0.3, FY+8.6, "A")
            if kind == "strap":
                # two broad ratchet straps and a buckle on the outside
                c.rect(cx-hw-0.2, FY+1.8, cx+hw+0.2, FY+3.4, "A")
                c.rect(cx-hw-0.2, FY+4.4, cx+hw+0.2, FY+6.0, "A")
                c.rect(cx+hw-1.4, FY+1.6, cx+hw+0.4, FY+3.6, "W")
            elif kind == "lace":
                # a tongue with the laces crossing it, widening down the foot
                c.rect(cx-1.3, FY, cx+1.3, FY+2.4, "A")
                for i in range(3):
                    y = FY + 2.2 + i*1.5
                    c.rect(cx-1.8-i*0.7, y, cx+1.8+i*0.7, y+0.7, "A")
            else:
                # the plate: a bright wafer sandwiched in a deep midsole
                c.rect(cx-hw-0.4, FY+7-sole_h-1.0, cx+hw+0.4, FY+7-sole_h+0.2, "W")
                c.rect(cx-1.2, FY, cx+1.2, FY+2.6, "A")
    item("bikeshoes", 3, lambda c: shoe(c, 1.4, "strap"))
    item("runshoes", 3, lambda c: shoe(c, 2.2, "lace"))
    item("carbon", 3, lambda c: shoe(c, 2.8, "plate"))
    item("barefoot", 2, lambda c: [ (c.disc(cx, FY+3, LHW, 4.2, "S"), c.rect(cx-LHW, FY, cx+LHW, FY+4, "S")) for cx in (L, R) ])
    # A yoke across the shoulders made this a tee with the sleeves cut off.
    # Two straps and the gap between them is the whole of a singlet.
    item("singlet", 2, lambda c: (
        c.trunk(SH+2, HIP-1, TT-1.4, TW_-0.8, TH_-0.8, "K"),
        [c.poly([(40+sx*(TT-1.0), SH+3.5), (40+sx*(TT-4.6), SH+3.5),
                 (40+sx*(TT-5.6), SH-1.6), (40+sx*(TT-2.0), SH-2.2)], "K") for sx in (-1, 1)],
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
    # Two seams down the flanks made it a hoodie with drawstrings. What says
    # wetsuit is that it covers everything and is sealed at each end: sleeves
    # to the wrist, legs past the knee, a cuff on all four, a collar and a zip.
    def wetsuit(c):
        END = LY0 + (LY1-LY0)*0.82
        torso(c, HIP+4, (AY1-AY0)*0.94, False, None)
        c.poly([(AX-AHW-0.6, AY0), (40-TT+1, SH-2), (40-TT+1, SH+8), (AX-AHW-0.6, AY0+9)], "K")
        c.poly([(80-AX+AHW+0.6, AY0), (40+TT-1, SH-2), (40+TT-1, SH+8), (80-AX+AHW+0.6, AY0+9)], "K")
        c.capsule(L, LY0, END, LHW+0.6, "K"); c.capsule(R, LY0, END, LHW+0.6, "K")
        for cx in (AX, 80-AX):
            c.rect(cx-AHW-1.0, AY1-3.6, cx+AHW+1.0, AY1-2.2, "A")
        for cx in (L, R):
            c.rect(cx-LHW-0.8, END-2.0, cx+LHW+0.8, END-0.6, "A")
        # A collar goes round the NECK. Drawn the width of the chest, as this
        # was, most of it floated above the shoulders with nothing under it.
        c.rect(35.4, SH-5.4, 44.6, SH-3.2, "A")
        c.rect(39.4, SH-3.4, 40.6, SH+13, "A")

    item("wetsuit", 2, wetsuit)
    item("trail", 3, lambda c: (shoe(c, 3.2, "lace"),
        [c.rect(cx-LHW-0.4, FY+5.2, cx+LHW+0.4, FY+6.6, "A") for cx in (L, R)],
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
    # The four Ryan kept from the ideas sheet, plus the durag he asked for.
    item("bucket", 4, lambda c: (
        c.disc(40, HC-1, HRX-0.6, HRY-2.0, "K", y1=HC-HRY*0.05),
        c.disc(40, HC-HRY*0.06, HRX+5.0, 2.6, "K"),
        c.rect(40-HRX+1, HC-HRY*0.42, 40+HRX-1, HC-HRY*0.3, "A", only="K")))
    item("cowboy", 4, lambda c: (
        c.disc(40, HC-3.0, HRX-2.0, HRY-3.0, "K", y1=HC-HRY*0.18),
        c.rect(40-HRX+3, HC-HRY*0.62, 40+HRX-3, HC-HRY*0.16, "K"),
        c.disc(40, HC-HRY*0.14, HRX+7.5, 2.4, "K"),
        c.rect(40-HRX+2.4, HC-HRY*0.34, 40+HRX-2.4, HC-HRY*0.24, "A", only="K")))
    def santa(c):
        """A Santa hat that is actually in the picture.

        The old one put its apex at HC - HRY*1.5, which is y = -5 — above the
        top of the drawing, let alone above the bust window, which starts at
        y = 2. So the cone was sliced off flat and the pom-pom with it, and
        what was left read as a red beanie with a white stripe.

        A Santa hat is a cone that FLOPS. Drawn here as a tapering band along
        a centre line that rises off the brow, bends over at the crown and
        hangs down past the ear, with the bobble at the end of the droop where
        it can be seen rather than somewhere off the top of the page.
        """
        def taper(path, ch):
            """A band of falling width along a path: quad per segment, each
            one square to the direction of travel, so the hat narrows evenly
            instead of pinching at the bends."""
            for (x0, y0, w0), (x1, y1, w1) in zip(path, path[1:]):
                dx, dy = x1 - x0, y1 - y0
                n = math.hypot(dx, dy) or 1.0
                px, py = -dy / n, dx / n
                c.poly([(x0 + px*w0, y0 + py*w0), (x1 + px*w1, y1 + py*w1),
                        (x1 - px*w1, y1 - py*w1), (x0 - px*w0, y0 - py*w0)], ch)

        brim = HC - HRY*0.30
        # The cap first, as a dome on the skull. The cone alone left the hair
        # showing through on the side it leaned away from, and the quads that
        # made the bend notched its silhouette; a dome under them hides both.
        c.disc(40, HC - 2.0, HRX + 0.8, HRY - 0.5, "K", y1=brim + 1.2)
        # then the droop, off the crown and down past the ear
        taper([(40 - 2.0, 7.0, HRX*0.52),
               (40 + 6.0, 5.0, HRX*0.38),
               (40 + HRX*0.92, 7.6, HRX*0.22),
               (40 + HRX + 3.0, 12.4, HRX*0.11)], "K")
        # the fur brim, hugging the skull rather than ruled straight across
        c.disc(40, brim - 1.0, HRX + 1.8, 5.2, "A", y0=brim - 2.6, y1=brim + 2.2)
        c.rect(40 - HRX - 1.2, brim - 2.2, 40 + HRX + 1.2, brim + 1.6, "A")
        # and the bobble, at the end of the droop where it can be seen
        c.disc(40 + HRX + 3.4, 12.8, 3.2, 3.0, "A")
        c.disc(40 + HRX + 2.4, 11.8, 1.1, 1.0, "W")

    item("santa", 4, santa)

    def durag(c, back=False):
        """A durag: the cap flat to the skull, the band across the brow, and
        the tails. From the front you get the two short ends by the ears; from
        behind, the long tails down the back of the neck, which is the whole
        look and the reason it needs its own back sprite."""
        c.disc(40, HC-0.5, HRX+0.3, HRY-0.2, "K", y1=HC-HRY*0.14)
        c.rect(40-HRX-0.6, HC-HRY*0.30, 40+HRX+0.6, HC-HRY*0.12, "A")
        # the seam that runs front to back over the crown
        c.rect(39.4, HC-HRY*0.95, 40.6, HC-HRY*0.30, "A", only="K")
        if back:
            c.disc(40, HC, HRX+0.3, HRY, "K")
            c.rect(40-HRX-0.6, HC-HRY*0.30, 40+HRX+0.6, HC-HRY*0.12, "A")
            c.rect(39.4, HC-HRY*1.0, 40.6, HC+HRY*0.1, "A")
            # The tails start BELOW the cap and widen as they fall. Drawn from
            # the crown they were almost entirely hidden under it — all you
            # saw was a nub at the neck.
            c.rect(40-3.4, HC+HRY*0.86, 40+3.4, HC+HRY*1.05, "A")
            c.poly([(40-3.0, HC+HRY*1.00), (40+3.0, HC+HRY*1.00),
                    (40+8.6, HC+HRY*2.00), (40+4.2, HC+HRY*2.06)], "K")
            c.poly([(40-3.0, HC+HRY*1.00), (40+3.0, HC+HRY*1.00),
                    (40-4.2, HC+HRY*2.06), (40-8.6, HC+HRY*2.00)], "K")
        else:
            for sx in (-1, 1):
                c.poly([(40+sx*(HRX-1.4), HC-HRY*0.16), (40+sx*(HRX+1.2), HC-HRY*0.16),
                        (40+sx*(HRX+2.0), HC+HRY*0.40), (40+sx*(HRX-0.6), HC+HRY*0.34)], "K")

    item("durag", 4, lambda c: durag(c))
    item("durag_back", 4, lambda c: durag(c, back=True))

    def skigoggles(c):
        """Proper ski goggles: a wide strap right round, a chunky frame, one
        big lens with a brow curve and a nose notch under it, and a hard
        reflection across the glass. The first pass was a flat orange ellipse
        on a thin line, which read as a sleep mask."""
        top, bot = EYE_Y - HRY*0.30, EYE_Y + HRY*0.26
        # strap, all the way round and a touch proud of the head
        c.rect(40-HRX-2.0, EYE_Y-HRY*0.17, 40+HRX+2.0, EYE_Y+HRY*0.05, "K")
        # frame: wider at the brow, tucked at the cheeks
        c.poly([(40-HRX-1.0, top+1.2), (40-HRX*0.78, top), (40+HRX*0.78, top),
                (40+HRX+1.0, top+1.2), (40+HRX+0.6, bot-1.6), (40+HRX*0.66, bot),
                (40-HRX*0.66, bot), (40-HRX-0.6, bot-1.6)], "K")
        # the glass, inset all round
        c.poly([(40-HRX*0.92, top+2.0), (40-HRX*0.66, top+1.0), (40+HRX*0.66, top+1.0),
                (40+HRX*0.92, top+2.0), (40+HRX*0.74, bot-2.2), (40+HRX*0.44, bot-1.2),
                (40-HRX*0.44, bot-1.2), (40-HRX*0.74, bot-2.2)], "A")
        # the notch over the nose, cut back out of the glass
        c.poly([(40-2.0, bot-1.2), (40+2.0, bot-1.2), (40, bot-3.2)], "K")
        # one hard reflection, upper left, the way light hits a curved lens
        [c.rect(40-HRX*0.62+i*0.38, top+1.8+i*0.38, 40-HRX*0.44+i*0.38, top+4.6+i*0.38, "W")
         for i in range(9)]

    item("skigoggles", 4, skigoggles)

    # ---- The ones Ryan kept, plus the three he asked for ----
    item("polo", 2, lambda c: (
        torso(c, HIP-1, (AY1-AY0)*0.32, False, 2.4),
        c.poly([(40-5.4, SH-3), (40, SH+6), (40+5.4, SH-3)], "A"),
        c.rect(39.4, SH+1, 40.6, SH+9, "A", only="K"),
        c.disc(40, SH+3.4, 0.7, 0.7, "W")))

    def seven(c, n, x, y, w, h, ch):
        """One digit, seven-segment, so a squad number survives being 14 px
        tall. Drawn rather than typed: there is no font in a sprite sheet."""
        t = h * 0.17
        seg = {
            "a": (x, y, x + w, y + t), "g": (x, y + h / 2 - t / 2, x + w, y + h / 2 + t / 2),
            "d": (x, y + h - t, x + w, y + h),
            "f": (x, y, x + t, y + h / 2), "b": (x + w - t, y, x + w, y + h / 2),
            "e": (x, y + h / 2, x + t, y + h), "c": (x + w - t, y + h / 2, x + w, y + h),
        }
        on = {0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc",
              5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abfgcd"}[n]
        for k in on:
            c.rect(*seg[k], ch)

    def basketball(c):
        """A basketball KIT, vest and shorts in one drawing.

        Ryan, 2026-10-02: "only sell the kit together". So this is one item
        rather than two, the way the tri suit already is — which also means
        the trim runs from the shoulder to the hem without the two halves
        having to be bought in the right order to line up.

        It crosses the waist, and the renderer splits a sheet at ZONE_SPLIT so
        each half lands in its own zone (see avatarSvg). That is what stops a
        pair of shorts from painting over the bottom of it.
        """
        # shorts first, so the vest's hem falls over the waistband
        c.trunk(HIP-4, HIP+2, TH_, TH_, TH_, "K")
        end = LY0 + (LY1-LY0)*0.62          # longer than a running short
        c.capsule(L, LY0-2, end, LHW+0.9, "K"); c.capsule(R, LY0-2, end, LHW+0.9, "K")
        c.rect(40-TH_, HIP-4, 40+TH_, HIP-2.0, "A")
        for cx, sx in ((L, -1), (R, 1)):
            c.rect(cx + sx*(LHW+0.1), HIP-2, cx + sx*(LHW+1.0), end-1.0, "A", only="K")
        c.trunk(SH+2, HIP+1, TT-1.4, TW_-1.0, TH_-1.0, "K")
        for sx in (-1, 1):
            c.poly([(40+sx*(TT-1.4), SH+4.5), (40+sx*(TT-5.2), SH+4.5),
                    (40+sx*(TT-6.2), SH-0.5), (40+sx*(TT-2.0), SH-0.5)], "K")
        # neck and armhole trim, then the side stripe
        c.poly([(40-5.6, SH-1.0), (40, SH+6.0), (40+5.6, SH-1.0)], "A")
        c.poly([(40-4.2, SH-1.0), (40, SH+4.4), (40+4.2, SH-1.0)], "W")
        for sx in (-1, 1):
            c.rect(40+sx*(TW_-1.4) - 0.9, SH+6, 40+sx*(TW_-1.4) + 0.9, HIP+1, "A", only="K")
        seven(c, 2, 40 - 7.6, SH + 9.5, 6.2, 11.5, "W")
        seven(c, 3, 40 + 1.4, SH + 9.5, 6.2, 11.5, "W")

    item("basketball", 3, basketball)

    def dungarees(c):
        """Denim dungarees: a bib that is actually a bib, straps over the
        shoulders with buckles, and trousers with a seam. The first pass had a
        bib the size of a stamp and straps you could not see."""
        # trousers first, so the bib sits over them
        c.trunk(HIP-5, HIP+4, TH_+0.4, TH_+0.4, TH_+0.4, "K")
        c.capsule(L, LY0-1, LY0+(LY1-LY0)*0.95, LHW+1.6, "K")
        c.capsule(R, LY0-1, LY0+(LY1-LY0)*0.95, LHW+1.6, "K")
        for cx in (L, R):
            c.rect(cx - LHW - 1.6, LY0 + 2, cx - LHW - 0.7, LY0+(LY1-LY0)*0.95, "A", only="K")
        # the bib: broad, up to the chest, with a patch pocket
        c.rect(40 - 8.4, SH + 6.5, 40 + 8.4, HIP - 2, "K")
        c.rect(40 - 5.6, SH + 10, 40 + 5.6, SH + 18, "A", only="K")
        c.rect(40 - 4.6, SH + 11, 40 + 4.6, SH + 17, "K")
        # straps over the shoulders, with a buckle each
        for sx in (-1, 1):
            c.poly([(40 + sx * 8.4, SH + 8.5), (40 + sx * 4.6, SH + 8.5),
                    (40 + sx * 5.6, SH - 1.0), (40 + sx * 9.4, SH - 1.0)], "K")
            c.rect(40 + sx * 8.6 - 1.8, SH + 5.0, 40 + sx * 8.6 + 1.8, SH + 7.6, "A")
        c.rect(40 - 9.0, HIP - 4.5, 40 + 9.0, HIP - 3.0, "A", only="K")

    item("dungarees", 3, dungarees)

    def gi(c):
        """A gi: wide sleeves, two lapels crossed left over right, a thick
        belt with a knot and two ends hanging, and loose trousers. The first
        pass was a white jumpsuit with a V on it."""
        c.trunk(SH, HIP + 4, TT, TW_ + 1.0, TH_ + 1.0, "K")
        c.disc(40, SH + 2, TT + 0.5, 6.5, "K")
        # wide sleeves — a gi hangs off the arm and FLARES at the cuff. A
        # capsule gave a round blob at the shoulder; a sleeve is a trapezium.
        for sx in (-1, 1):
            cx = AX if sx < 0 else 80 - AX
            y0, y1 = AY0 - 1.0, AY0 + (AY1 - AY0) * 0.60
            c.poly([(cx - AHW - 0.6, y0), (cx + AHW + 0.6, y0),
                    (cx + AHW + sx * -0.2 + 3.0, y1), (cx - AHW + sx * -0.2 - 3.0, y1)], "K")
            c.poly([(cx + AHW + sx * -0.2 + 3.0, y1 - 2.0),
                    (cx - AHW + sx * -0.2 - 3.0, y1 - 2.0),
                    (cx - AHW + sx * -0.2 - 3.0, y1),
                    (cx + AHW + sx * -0.2 + 3.0, y1)], "A", only="K")
        c.capsule(L, LY0, LY0 + (LY1 - LY0) * 0.80, LHW + 2.0, "K")
        c.capsule(R, LY0, LY0 + (LY1 - LY0) * 0.80, LHW + 2.0, "K")
        # the two lapels, the right one crossing over the left
        c.poly([(40 - TT + 1.0, SH - 3.0), (40 - 1.0, SH + 15.0),
                (40 + 2.6, SH + 15.0), (40 - TT + 5.0, SH - 3.0)], "A")
        c.poly([(40 + TT - 1.0, SH - 3.0), (40 + 1.0, SH + 15.0),
                (40 - 2.6, SH + 15.0), (40 + TT - 5.0, SH - 3.0)], "A")
        # belt, knot, and the two ends
        c.rect(40 - TT - 0.5, SH + 15.0, 40 + TT + 0.5, SH + 20.0, "A")
        # the knot: a block of belt sitting proud of the band, split by one
        # line of gi showing through, which is what reads as a tied knot. A
        # white square in the middle read as a target.
        c.rect(40 - 3.4, SH + 13.8, 40 + 3.4, SH + 21.2, "A")
        c.rect(40 - 3.4, SH + 17.1, 40 + 3.4, SH + 17.9, "K")
        for sx in (-1, 1):
            c.rect(40 + sx * 1.8 - 1.4, SH + 20.6, 40 + sx * 1.8 + 1.4, SH + 29.0, "A")

    item("gi", 3, gi)

    # prizes — won, not sold. Drawn with more care than the first pass: a
    # wreath of real leaves, a medal with a struck rim, a sash with edging.
    def leaf(c, cx, cy, ln, wd, ang, ch):
        """A pointed oval lying along `ang` — a leaf, not a green dot."""
        ca, sa = math.cos(ang), math.sin(ang)
        pts = []
        for t, w in ((-1.0, 0.0), (-0.35, 1.0), (0.35, 1.0), (1.0, 0.0),
                     (0.35, -1.0), (-0.35, -1.0)):
            px, py = t * ln, w * wd
            pts.append((cx + px * ca - py * sa, cy + px * sa + py * ca))
        c.poly(pts, ch)

    def crown(c):
        """A crown with a CAP in it.

        The last one was a rim: five gold points standing on a gold band with
        the hair showing through between them, which from a few feet away is a
        comb. What makes a crown read as one object is the velvet filling the
        space the points enclose — so that is drawn first, the points stand on
        it, and a row of pearls runs the top edge of the band to stop the two
        halves reading as separate pieces of jewellery.

        Everything is still measured off the head ellipse rather than picked:
        the band's bottom edge sits just inside the widest the skull gets at
        that height, and the top edge just inside where the hair reaches, so
        the crown rests ON him at every angle instead of hovering at corners.
        """
        # The band is a RECTANGLE, Ryan's call, and he is right: a crown's rim
        # is a cylinder, so head-on it is a straight-sided band whose corners
        # stand clear of the skull. The taper this had was fitting it to the
        # head like a headband, which is not what a crown does — it sits ON
        # you, it is not moulded to you.
        YB0, YB1 = 7.4, 14.6           # band, top and bottom
        HW = 15.8                      # one half-width, top and bottom
        # The velvet cap: a dome sitting in the mouth of the crown, drawn
        # before anything else so every piece of gold lands on top of it.
        c.disc(40, YB0 + 0.4, HW - 1.4, 7.4, "A", y1=YB0 + 0.9)
        # Five points, tallest in the middle, each finished with a pearl. The
        # bases overlap, so the points read as one rim and not five spikes.
        for x, top in ((0.0, -1.4), (-6.0, 0.6), (6.0, 0.6), (-11.0, 2.8), (11.0, 2.8)):
            c.poly([(40+x-2.9, YB0+1.0), (40+x+2.9, YB0+1.0), (40+x, top)], "K")
            c.disc(40+x, top + 0.7, 1.3, 1.3, "W")
        # the band itself, over the feet of the points
        c.rect(40-HW, YB0, 40+HW, YB1, "K")
        # Jewels set in it, each with a glint in the upper left — the same
        # light that shades the rest of the figure.
        for x in (-8.0, 0.0, 8.0):
            c.disc(40+x, YB1-3.4, 2.1, 2.2, "A")
            c.disc(40+x-0.7, YB1-4.2, 0.7, 0.7, "W")
        # A row of pearls along the top edge, which is the join between the
        # band and the points and the thing that makes it one piece.
        for i in range(-6, 7):
            c.disc(40 + i*2.1, YB0 + 0.5, 0.75, 0.75, "W")
        # A lit top edge and a shadowed lower lip: without them the band is a
        # flat gold rectangle with dots on it.
        c.rect(40-HW+0.6, YB1-1.2, 40+HW-0.6, YB1, "A")

    item("crown", 4, crown)

    def circlet(c):
        """The podium's other two places.

        A circlet, not a crown: the same band sitting in the same place, but
        thinner, with three short points and no cap and no pearls. Second and
        third are the same drawing in silver and in bronze — a podium is told
        apart by its metal, which is the whole idea of the thing.
        """
        YB0, YB1 = 9.6, 14.6
        HW = 15.8
        for x, top in ((0.0, 2.6), (-8.2, 4.4), (8.2, 4.4)):
            c.poly([(40+x-2.6, YB0+0.8), (40+x+2.6, YB0+0.8), (40+x, top)], "K")
            c.disc(40+x, top + 0.7, 1.2, 1.2, "A")
        c.rect(40-HW, YB0, 40+HW, YB1, "K")
        c.disc(40, YB1-2.4, 1.8, 1.8, "A")
        c.rect(40-HW+0.5, YB0, 40+HW-0.5, YB0+0.8, "W")
        c.rect(40-HW+0.6, YB1-1.0, 40+HW-0.6, YB1, "A")

    item("circlet", 4, circlet)

    item("medal", 4, lambda c: (
        # A striped ribbon, not two bare straps.
        c.poly([(40-4.8, SH-4), (40-1.2, SH+7.5), (40+0.6, SH+7.5), (40-2.6, SH-4)], "A"),
        c.poly([(40+4.8, SH-4), (40+1.2, SH+7.5), (40-0.6, SH+7.5), (40+2.6, SH-4)], "A"),
        c.poly([(40-4.0, SH-4), (40-1.6, SH+5.0), (40-0.9, SH+5.0), (40-3.3, SH-4)], "W"),
        c.poly([(40+4.0, SH-4), (40+1.6, SH+5.0), (40+0.9, SH+5.0), (40+3.3, SH-4)], "W"),
        # The medallion: a struck rim, a sunk field, a star.
        c.disc(40, SH+11.0, 5.0, 5.0, "K"),
        c.disc(40, SH+11.0, 4.0, 4.0, "A"),
        c.disc(40, SH+11.0, 3.4, 3.4, "K"),
        c.poly([(40, SH+8.6), (40+0.9, SH+10.4), (40+2.8, SH+10.5), (40+1.3, SH+11.7),
                (40+1.9, SH+13.5), (40, SH+12.4), (40-1.9, SH+13.5), (40-1.3, SH+11.7),
                (40-2.8, SH+10.5), (40-0.9, SH+10.4)], "W"),
        c.disc(40-2.0, SH+9.2, 1.1, 1.1, "W")))

    def sash(c):
        # Shoulder to opposite hip, in one straight band, with gold edging down
        # both sides — the edging is what separates a sash from a bandage. The
        # ends are pulled in from the silhouette so no part of it hangs in air.
        x0, y0, x1, y1 = 31.0, 48.0, 47.5, 85.0
        def band(a, b, ch):
            c.poly([(x0+a, y0), (x0+b, y0), (x1+b, y1), (x1+a, y1)], ch)
        band(-4.2, 4.2, "K")
        band(-4.2, -2.9, "A")
        band(2.9, 4.2, "A")
        # a rosette where it lands on the hip
        c.disc(x1, y1 - 1.5, 2.9, 2.9, "A")
        c.disc(x1, y1 - 1.5, 1.6, 1.6, "K")

    item("sash", 3, sash)

    return {"W": W, "H": H, "base": body(False), "back": body(True), "g": G}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "classic"
    out = build(CHIBI if which == "chibi" else CLASSIC)
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "lib", "avatar", "sprites.json")
    json.dump(out, open(dest, "w"))
    print("built", which, "| items:", len(out["g"]), "->", os.path.relpath(dest))
