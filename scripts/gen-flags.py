"""Builds lib/flagArt.ts from the real flag files.

    python3 scripts/gen-flags.py

Ryan, 2026-09-30: "dont hand draw any of them". Every flag on the shelf is
therefore a copy of the official construction, not somebody's impression of
one — the two that were hand-drawn (Lebanon's cedar, Quebec's fleur-de-lis)
both looked it, and no amount of nudging curves was going to fix that.

The sources are the public-domain flag files on Wikimedia Commons. This script
fetches them, normalises each into the 30x20 box the app draws a flag in, and
writes the result out as one TypeScript file. It needs the network, so it is
run by hand and its OUTPUT is committed — nothing at build time or run time
reaches for a URL.

Two things have to be got right or the flags quietly break each other:

* IDS ARE SHARED. These files use short ids — Brazil has `a` through `t`,
  Kenya has `A` to `D`, Quebec has `a` and `b` — and the shop draws every flag
  into one page. Two flags defining `id="a"` means the second `use` in the
  document resolves to the first flag's shape. Every id and every reference to
  one is prefixed here with the flag's own code.
* THE BOXES DIFFER. Canada and Jordan are 2:1, Brazil is 10:7, the rest 3:2,
  and Brazil's viewBox starts at a negative corner. Each is mapped onto 30x20
  with its own transform; the app draws flags at a fixed shape anyway, the same
  way it always has.
"""
import os
import re
import sys
import time
import urllib.request

OUT = "lib/flagArt.ts"
# Downloads land here and are reused. Wikimedia answers 429 to a burst of
# eight, and re-running this script should not depend on their patience.
CACHE = os.environ.get("FLAG_CACHE", ".flag-cache")

# id -> (label, Wikimedia Commons path). AmaComp is not here: there is no real
# flag to copy, so the house flag is the one drawing we are allowed to invent.
SOURCES = {
    "ca": ("Canada", "c/cf/Flag_of_Canada.svg"),
    "qc": ("Quebec", "5/5f/Flag_of_Quebec.svg"),
    "lb": ("Lebanon", "5/59/Flag_of_Lebanon.svg"),
    "it": ("Italy", "0/03/Flag_of_Italy.svg"),
    "jp": ("Japan", "9/9e/Flag_of_Japan.svg"),
    "jo": ("Jordan", "c/c0/Flag_of_Jordan.svg"),
    "br": ("Brazil", "0/05/Flag_of_Brazil.svg"),
    "ke": ("Kenya", "4/49/Flag_of_Kenya.svg"),
}

W, H = 30, 20


def fetch(path: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    local = os.path.join(CACHE, os.path.basename(path))
    if os.path.exists(local):
        with open(local) as f:
            return f.read()
    url = f"https://upload.wikimedia.org/wikipedia/commons/{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "amacomp-flags/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8")
    with open(local, "w") as f:
        f.write(body)
    time.sleep(1)
    return body


def normalise(fid: str, svg: str) -> str:
    """One flag file, as markup that can sit inside our own 30x20 <svg>."""
    open_tag = re.search(r"<svg\b[^>]*>", svg, re.S)
    if not open_tag:
        raise SystemExit(f"{fid}: no <svg> tag")
    head = open_tag.group(0)

    vb = re.search(r'viewBox="\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)', head)
    if vb:
        x0, y0, vw, vh = (float(g) for g in vb.groups())
    else:
        wm = re.search(r'width="([\d.]+)"', head)
        hm = re.search(r'height="([\d.]+)"', head)
        if not (wm and hm):
            raise SystemExit(f"{fid}: no viewBox and no size")
        x0, y0, vw, vh = 0.0, 0.0, float(wm.group(1)), float(hm.group(1))

    body = svg[open_tag.end():]
    body = body[: body.rindex("</svg>")]
    # Metadata the app has no use for, and whitespace between elements.
    body = re.sub(r"<\?xml[^>]*\?>", "", body)
    body = re.sub(r"<title>.*?</title>", "", body, flags=re.S)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r">\s+<", "><", body).strip()

    # Namespace every id and every reference to one.
    body = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{fid}-{m.group(1)}"', body)
    body = re.sub(r'\b(xlink:href|href)="#([^"]+)"',
                  lambda m: f'{m.group(1)}="#{fid}-{m.group(2)}"', body)
    body = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{fid}-{m.group(1)})", body)

    sx, sy = W / vw, H / vh
    tx, ty = -x0, -y0
    shift = f" translate({fmt(tx)},{fmt(ty)})" if (tx or ty) else ""
    return f'<g transform="scale({fmt(sx)},{fmt(sy)}){shift}">{body}</g>'


def fmt(n: float) -> str:
    return f"{n:.6f}".rstrip("0").rstrip(".") or "0"


def main() -> None:
    parts = []
    for fid, (label, path) in SOURCES.items():
        art = normalise(fid, fetch(path))
        parts.append((fid, label, path, art))
        print(f"  {fid}  {label:<10} {len(art):>6} chars")

    esc = lambda s: s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")

    # A lane needs a flag's emblem ON ITS OWN when the flag's bands run
    # vertically: the whole drawing cannot be laid over stretched vertical
    # bands without disagreeing with them. Quebec is the one that needs
    # lifting out here — Canada's leaf already lives in lib/away.ts.
    quarter = re.search(r'<path fill="#003da5" d="([^"]+)"', fetch(SOURCES["qc"][1])).group(1)
    fleur = quarter[quarter.index("M", 1):]
    extras = (
        "\n/**\n * Quebec's fleur-de-lis on its own, lifted out of the quarter path. The\n"
        " * box was measured with getBBox rather than guessed.\n */\n"
        'export const FLEUR_BOX = "1414 400 1172 1600";\n'
        f'export const FLEUR =\n  "{fleur}";\n'
    )
    body = "".join(
        f"  // {label} — commons/{path}\n  {fid}:\n    `{esc(art)}`,\n"
        for fid, label, path, art in parts
    )

    header = f'''/**
 * The flags, copied.
 *
 * GENERATED by scripts/gen-flags.py — do not edit by hand. Each entry is one
 * official flag file from Wikimedia Commons (public domain), normalised into
 * the 30x20 box the app draws a flag in, with its ids prefixed so that two
 * flags on the same page cannot resolve each other's shapes.
 *
 * Ryan, 2026-09-30: "dont hand draw any of them". The hand-drawn cedar and
 * fleur-de-lis that preceded this were rejected twice, and rightly — a flag is
 * a specification, so the only way to get one right is to copy it.
 *
 * The house flag is not in here. There is no AmaComp to copy, so that one is
 * drawn in lib/flags.ts, which is the single exception and says so.
 */

export const FLAG_ART: Record<string, string> = {{
{body}}};
{extras}'''
    with open(OUT, "w") as f:
        f.write(header)
    print(f"wrote {OUT} ({len(header)} bytes, {len(parts)} flags)")


if __name__ == "__main__":
    sys.exit(main())
