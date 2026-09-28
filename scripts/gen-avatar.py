"""Builds every avatar sprite from one set of proportions.

    python3 scripts/gen-avatar.py            # rewrites lib/avatar/sprites.json
    python3 scripts/gen-avatar.py chibi      # pocket-size proportions instead


Change LAYOUT and the whole wardrobe follows — that is the point of generating
the art rather than drawing it. Colour roles: S skin, D skin shade, H hair,
E eye, M mouth, K the item's colour, A its accent, W a highlight.
"""
import json, sys

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
            c.disc(40, HC, HRX, HRY, "H")
        else:
            c.disc(40, HC-1, HRX, HRY, "H", y1=HC-HRY*0.45)
            c.rect(40-HRX+2, HC-HRY*0.5, 40+HRX-2, HC-HRY*0.35, "H", only="S")
            for cx in (40-HRX*0.45, 40+HRX*0.45):
                c.disc(cx, EYE_Y, HRX*0.19, HRY*0.21, "E")
                c.rect(cx-HRX*0.06, EYE_Y-HRY*0.13, cx+HRX*0.06, EYE_Y-HRY*0.02, "W")
            c.rect(40-HRX*0.55, HC-HRY*0.16, 40-HRX*0.15, HC-HRY*0.06, "H")
            c.rect(40+HRX*0.15, HC-HRY*0.16, 40+HRX*0.55, HC-HRY*0.06, "H")
            c.rect(40-HRX*0.2, HC+HRY*0.52, 40+HRX*0.2, HC+HRY*0.62, "M")
            for y in (HC+HRY*0.2, HC+HRY*0.28):
                c.rect(40, y, 41.2, y+0.1, "D", only="S")
        # knees and ankles
        for cx in (L, R):
            c.rect(cx-3.5, LY0+(LY1-LY0)*0.55, cx+3.5, LY0+(LY1-LY0)*0.55+1, "D", only="S")
        return ["".join(r) for r in c.g]

    def item(name, res, fn):
        c = C(res); fn(c); G[name] = c.pack()

    # head
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
    # eyes
    item("shades", 4, lambda c: (
        c.disc(40-HRX*0.45, EYE_Y, HRX*0.36, HRY*0.23, "K"), c.disc(40+HRX*0.45, EYE_Y, HRX*0.36, HRY*0.23, "K"),
        c.rect(40-HRX*0.1, EYE_Y-0.8, 40+HRX*0.1, EYE_Y+0.8, "K"),
        c.rect(40-HRX-0.5, EYE_Y-1.4, 40-HRX*0.72, EYE_Y-0.2, "K"),
        c.rect(40+HRX*0.72, EYE_Y-1.4, 40+HRX+0.5, EYE_Y-0.2, "K"),
        c.rect(40-HRX*0.7, EYE_Y-1.6, 40-HRX*0.5, EYE_Y-0.6, "W")))
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
    item("trisuit", 2, lambda c: (torso(c, HIP+4, (AY1-AY0)*0.42, True, None),
        c.capsule(L, LY0, LY0+(LY1-LY0)*0.55, LHW+0.4, "K"), c.capsule(R, LY0, LY0+(LY1-LY0)*0.55, LHW+0.4, "K")))
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
    # watch
    def watch(c):
        cx, cy = AX, (AY0+AY1)/2 + 2
        c.rect(cx-4.8, cy-4.4, cx+4.8, cy-1.4, "K"); c.rect(cx-4.8, cy+1.4, cx+4.8, cy+4.4, "K")
        c.disc(cx, cy, 4.15, 4.15, "K"); c.disc(cx, cy, 3.5, 3.5, "A")
        c.disc(cx, cy, 2.85, 2.85, "K"); c.disc(cx, cy, 2.6, 2.6, "W")
        c.rect(cx-1.55, cy-1.15, cx+1.55, cy-0.35, "K"); c.rect(cx-1.15, cy+0.25, cx+1.15, cy+0.7, "K")
        c.rect(cx+4.3, cy-1.0, cx+5.2, cy+0.0, "K")
    item("watch", 4, watch)
    return {"W": W, "H": H, "base": body(False), "back": body(True), "g": G}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "classic"
    out = build(CHIBI if which == "chibi" else CLASSIC)
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "lib", "avatar", "sprites.json")
    json.dump(out, open(dest, "w"))
    print("built", which, "| items:", len(out["g"]), "->", os.path.relpath(dest))
