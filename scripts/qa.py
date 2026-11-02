"""A walk through the whole of AmaComp, pressing the buttons.

    NEXT_PUBLIC_CLUB_LIVE=1 npx next build
    DATABASE_URL= SESSION_SECRET=qa NEXT_PUBLIC_CLUB_LIVE=1 npx next start -p 3177
    python3 scripts/qa.py

The var goes on BOTH lines. NEXT_PUBLIC_* is inlined at build time and read
from the environment at run time, so a build without it and a server with it
disagree — React throws hydration #418, the non-admin's page never hydrates,
and every button he owns quietly does nothing. That reads as five broken
features and is not a bug in the app.

It needs playwright and a copy of Chrome:  pip install playwright

WHY IT WRITES. The gift bug (0cb04e1) rendered perfectly and blanked the app
the moment anybody tapped the button, because the route answered with a
partial payload and useLeague swapped it into the app state. Everything had
been exercised through the API, where that is invisible. So the second half of
this walk presses every button that writes and then checks the number actually
moved — a screen that renders is not a screen that works.

IT WRITES, so it refuses to run against the live app. Point it at a throwaway
server with no DATABASE_URL and it seeds its own league first.

Three things are checked on every screen, because these are the three that
have actually gone wrong here: a thrown error, the page scrolling sideways,
and an element spilling out of the panel it lives in. A row that scrolls
sideways on purpose (the shop's category chips) is not a spill.
"""
import datetime
import json
import os
import random
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("pip install playwright  (and `playwright install chromium`)")

U = os.environ.get("AMAGOH_URL", "http://localhost:3177")
CHROME = os.environ.get(
    "CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
if "railway.app" in U or "amagoh" in U.replace("localhost", ""):
    sys.exit(f"{U} looks live. This walk writes — point it at a throwaway server.")

NAMES = ["Ryan", "Jona", "Jonah", "Davide", "Philippe", "James"]
SPORTS = [("run", (4, 14)), ("bike", (20, 70)), ("swim", (0.8, 2.5)), ("gym", (1, 1))]

TAB = """(n)=>{const els=[...document.querySelectorAll('button,a,span')]
  .filter(e=>e.textContent.trim().toUpperCase()===n && e.getBoundingClientRect().top>690);
  if(els.length){els[els.length-1].click();return true} return false}"""
ROOM = """(n)=>{const b=[...document.querySelectorAll('[role=tab]')]
  .find(e=>e.textContent.trim()===n); if(b){b.click();return true} return false}"""
PERIOD = """(n)=>{const b=[...document.querySelectorAll('button')]
  .find(e=>e.textContent.trim().toUpperCase()===n && e.getBoundingClientRect().top<400);
  if(b){b.click();return true} return false}"""
# Clicked through evaluate rather than Playwright, so an open sheet's backdrop
# cannot intercept and send the walk into a sixty-attempt retry loop.
CLICK = """(t)=>{const b=[...document.querySelectorAll('button')]
  .find(e=>e.textContent.trim().toLowerCase()===t.toLowerCase()&&!e.disabled);
  if(b){b.click();return true} return false}"""
HAS = """(t)=>{const b=[...document.querySelectorAll('button')]
  .find(e=>e.textContent.toLowerCase().includes(t.toLowerCase())&&!e.disabled);
  if(b){b.click();return true} return false}"""
SPILL = """()=>{const bad=[];
  for (const s of document.querySelectorAll('section,article,div[class*="rounded-2xl"]')) {
    const r=s.getBoundingClientRect(); if(r.width<40) continue;
    const ov=getComputedStyle(s).overflowX; if(ov==='auto'||ov==='scroll') continue;
    for (const e of s.querySelectorAll('button,span,p,h2,h3')) {
      if(e.closest('[class*="overflow-x-auto"],[class*="overflow-x-scroll"]')) continue;
      const b=e.getBoundingClientRect();
      if(b.width>0 && (b.right>r.right+1 || b.left<r.left-1)) {
        bad.push((e.textContent||'').trim().slice(0,30)); break; }
    }
  }
  return bad.slice(0,4);}"""
OVERFLOW = "()=>document.documentElement.scrollWidth > window.innerWidth + 1"

problems: list[str] = []


def jpost(ctx, path, payload):
    return ctx.request.post(U + path, data=json.dumps(payload),
                            headers={"content-type": "application/json"})


def state(ctx):
    return json.loads(ctx.request.get(U + "/api/session").text())


def seed(browser):
    """A league with enough history that every tab has something to draw."""
    ctx = {}
    for n in NAMES:
        c = browser.new_context()
        jpost(c, "/api/session", {"name": n})
        ctx[n] = c
    ids = {a["name"]: a["id"] for a in state(ctx["Ryan"])["athletes"]}
    today = datetime.date.today()
    # A float FIRST, in a finished week, and not only so there are coins.
    # A grant lands as an activity row, which is what takes each man out of the
    # coming-soon hold (lib/waiting) — a brand-new league seeded during the
    # run-out week of a season is otherwise refused its very first session.
    last = (today - datetime.timedelta(days=today.weekday() + 7)).isoformat()
    for n in NAMES:
        jpost(ctx["Ryan"], "/api/grants", {
            "kind": "award", "athleteId": ids[n], "points": 1500,
            "occurredOn": last, "note": "float"})
    random.seed(7)
    made = 0
    for n in NAMES:
        for d in range(28):
            if random.random() < 0.45:
                continue
            sport, (lo, hi) = random.choice(SPORTS)
            r = jpost(ctx[n], "/api/activities", {
                "sport": sport,
                "occurredOn": (today - datetime.timedelta(days=d)).isoformat(),
                "km": round(random.uniform(lo, hi), 2),
                "elevationM": round(random.uniform(0, 600), 1) if sport in ("run", "bike") else None,
                "note": None,
            })
            if r.status != 200:
                problems.append(f"seed: {n} {r.status} {r.text()[:80]}")
                break
            made += 1
    # The Bible box (lib/bible): without a tick for today, nothing logged today
    # scores and every "did the number move" check below reads as broken.
    for n in NAMES:
        ctx[n].request.patch(U + "/api/session", data=json.dumps({"bibleRead": True}),
                             headers={"content-type": "application/json"})
    print(f"seeded {len(NAMES)} athletes, {made} sessions")
    for c in ctx.values():
        c.close()


def sign_in(browser, name, width=390, palette="dark"):
    c = browser.new_context(viewport={"width": width, "height": 880},
                            device_scale_factor=2,
                            color_scheme="dark" if palette == "dark" else "light")
    jpost(c, "/api/session", {"name": name})
    pg = c.new_page()
    errs: list[str] = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U, wait_until="networkidle")
    pg.wait_for_timeout(1500)
    got = pg.query_selector("text=Got it")
    if got:
        got.click()
        pg.wait_for_timeout(300)
    # A season card (the run-in, the champion, the kickoff) covers the whole
    # app and swallows every click behind it. Tap through whatever is up.
    for _ in range(10):
        if not pg.query_selector('[role=dialog]'):
            break
        if not pg.evaluate("""()=>{const b=[...document.querySelectorAll('[role=dialog] button')]
            .filter(e=>!e.disabled).pop(); if(b){b.click();return true} return false}"""):
            break
        pg.wait_for_timeout(700)
    pg.evaluate('(p)=>document.documentElement.setAttribute("data-palette",p)', palette)
    return c, pg, errs


def look(pg, where):
    pg.wait_for_timeout(700)
    if pg.evaluate(OVERFLOW):
        problems.append(f"{where}: page scrolls sideways")
    spilt = pg.evaluate(SPILL)
    if spilt:
        problems.append(f"{where}: spills {spilt}")
    text = pg.inner_text("body")
    if "Application error" in text or "client-side exception" in text:
        problems.append(f"{where}: CRASHED")
    return text


def read_walk(browser):
    """Every screen, as the admin and as a regular man, in both palettes."""
    for who, palette, width in (("Ryan", "dark", 390), ("Philippe", "dark", 390),
                                ("Ryan", "light", 390), ("Ryan", "dark", 834)):
        c, pg, errs = sign_in(browser, who, width, palette)
        tag = f"{who}/{palette}/{width}"
        for tab in ("WEEK", "BOARD", "LOG", "RECORDS", "CLUB", "BETS"):
            if not pg.evaluate(TAB, tab):
                continue
            pg.wait_for_timeout(900)
            look(pg, f"{tag}/{tab}")
            if tab == "BOARD":
                for per in ("TODAY", "WEEK", "MONTH", "SEASON", "ALL"):
                    if pg.evaluate(PERIOD, per):
                        look(pg, f"{tag}/BOARD/{per}")
            if tab == "CLUB":
                for room in ("Wallet", "Shop", "Profile"):
                    if pg.evaluate(ROOM, room):
                        look(pg, f"{tag}/CLUB/{room}")
            if tab == "BETS":
                for room in ("Bets", "Bounties"):
                    if pg.evaluate(ROOM, room):
                        look(pg, f"{tag}/ARENA/{room}")
        pg.evaluate(TAB, "BOARD")
        pg.wait_for_timeout(800)
        pg.evaluate("""()=>{const b=[...document.querySelectorAll('button')]
            .find(e=>/Jona|Davide|James/.test(e.textContent||'')); if(b) b.click();}""")
        pg.wait_for_timeout(1100)
        look(pg, f"{tag}/PROFILE SHEET")
        if errs:
            problems.append(f"{tag}: page errors {errs[:2]}")
        print(f"  read  {tag}")
        c.close()


def check(label, ok, detail=""):
    print(f"  {'ok  ' if ok else 'FAIL'}  {label}{(' — ' + detail) if detail else ''}")
    if not ok:
        problems.append(label)


def write_walk(browser):
    """Everything that writes, pressed for real."""
    cR, pgR, eR = sign_in(browser, "Ryan")
    cJ, pgJ, eJ = sign_in(browser, "Jona")

    # Logging. Ryan has no Log TAB — the new shape puts it behind the "+", and
    # the same sheet carries Edit and Delete for recent sessions.
    before = len(state(cR)["activities"])
    pgR.evaluate("""()=>{const b=document.querySelector('[aria-label="Log a session"]'); if(b) b.click();}""")
    pgR.wait_for_timeout(900)
    pgR.evaluate(HAS, "Run")
    pgR.wait_for_timeout(400)
    pgR.locator('input[inputmode="decimal"]').first.fill("7.5")
    pgR.evaluate(CLICK, "Add to the board")
    pgR.wait_for_timeout(1700)
    check("log a session", len(state(cR)["activities"]) == before + 1)

    # Adding closes the sheet, so it has to be opened again. Edit then opens a
    # SECOND form under the add form, which means the first distance box on the
    # page is still the add form's — the edited one is the prefilled one.
    pgR.evaluate("""()=>{const b=document.querySelector('[aria-label="Log a session"]'); if(b) b.click();}""")
    pgR.wait_for_timeout(1000)
    pgR.evaluate(CLICK, "Edit")
    pgR.wait_for_timeout(900)
    boxes = pgR.locator('input[inputmode="decimal"]')
    for i in range(boxes.count()):
        if (boxes.nth(i).input_value() or "").strip():
            boxes.nth(i).fill("9.9")
            break
    pgR.evaluate(CLICK, "Save changes")
    pgR.wait_for_timeout(1600)
    check("edit a session",
          any(abs((a.get("km") or 0) - 9.9) < 0.01 for a in state(cR)["activities"]))

    before = len(state(cR)["activities"])
    pgR.evaluate(CLICK, "Delete")
    pgR.wait_for_timeout(700)
    pgR.evaluate("""()=>{const b=[...document.querySelectorAll('button')]
        .find(e=>/delete|remove|yes/i.test(e.textContent)&&!e.disabled); if(b) b.click();}""")
    pgR.wait_for_timeout(1600)
    check("delete a session", len(state(cR)["activities"]) < before)
    pgR.evaluate(CLICK, "Close")
    pgR.wait_for_timeout(500)

    # The shop
    pgR.evaluate(TAB, "CLUB"); pgR.wait_for_timeout(900)
    pgR.evaluate(ROOM, "Shop"); pgR.wait_for_timeout(1200)
    owned = len(state(cR)["purchases"])
    box = pgR.query_selector('[aria-label^="Buy "]')
    if box:
        box.scroll_into_view_if_needed(); box.click(); pgR.wait_for_timeout(800)
        pgR.evaluate(HAS, "Buy for"); pgR.wait_for_timeout(1500)
    check("buy an item", len(state(cR)["purchases"]) == owned + 1)

    pgR.evaluate(CLICK, "save")
    pgR.wait_for_timeout(1500)
    check("save the locker", state(cR)["myLoadout"] is not None)

    gifts = len([p for p in state(cR)["purchases"] if p.get("paidBy")])
    box = pgR.query_selector('[aria-label^="Buy "]')
    if box:
        box.scroll_into_view_if_needed(); box.click(); pgR.wait_for_timeout(800)
        pgR.evaluate(CLICK, "Gift"); pgR.wait_for_timeout(500)
        pgR.evaluate(HAS, "Jona"); pgR.wait_for_timeout(1600)
    check("gift an item",
          len([p for p in state(cR)["purchases"] if p.get("paidBy")]) == gifts + 1)
    pgR.evaluate(CLICK, "Back"); pgR.wait_for_timeout(300)

    sent = len(state(cR)["transfers"])
    pgR.evaluate(ROOM, "Wallet"); pgR.wait_for_timeout(900)
    pgR.evaluate(CLICK, "Send coins"); pgR.wait_for_timeout(600)
    pgR.evaluate(HAS, "Send "); pgR.wait_for_timeout(1600)
    check("send coins", len(state(cR)["transfers"]) == sent + 1)

    # A word bet, all the way through, across two phones
    pgR.evaluate(TAB, "BETS"); pgR.wait_for_timeout(1000)
    pgR.evaluate(CLICK, "New bet"); pgR.wait_for_timeout(600)
    pgR.evaluate(CLICK, "your word"); pgR.wait_for_timeout(400)
    pgR.select_option("select", label="Jona"); pgR.wait_for_timeout(300)
    terms = pgR.query_selector('input[placeholder^="First one"]')
    if terms:
        terms.fill("QA: first one up Mont Royal")
    pgR.evaluate(HAS, "Offer"); pgR.wait_for_timeout(1600)
    check("propose a word bet", bool(state(cR)["bets"]))

    pgJ.reload(wait_until="networkidle"); pgJ.wait_for_timeout(1400)
    pgJ.evaluate(TAB, "BETS"); pgJ.wait_for_timeout(1100)
    pgJ.evaluate(CLICK, "Take it"); pgJ.wait_for_timeout(1600)
    check("accept it", any(b["state"] == "accepted" for b in state(cJ)["bets"]))

    pgJ.evaluate(CLICK, "I won"); pgJ.wait_for_timeout(1600)
    check("call it", any(b["calledBy"] for b in state(cJ)["bets"]))

    pgR.reload(wait_until="networkidle"); pgR.wait_for_timeout(1400)
    pgR.evaluate(TAB, "BETS"); pgR.wait_for_timeout(1100)
    pgR.evaluate(CLICK, "Agreed"); pgR.wait_for_timeout(1600)
    check("confirm it", any(b["state"] == "settled" for b in state(cR)["bets"]))

    # A bounty, posted / claimed / paid
    pgR.evaluate(ROOM, "Bounties"); pgR.wait_for_timeout(900)
    pgR.evaluate(CLICK, "Post one"); pgR.wait_for_timeout(600)
    title = pgR.query_selector('input[placeholder^="Swim at the lake"]')
    if title:
        title.fill("QA: ride in the rain")
    pgR.evaluate(HAS, "Put "); pgR.wait_for_timeout(1600)
    check("post a bounty", bool(state(cR)["bounties"]))

    pgJ.reload(wait_until="networkidle"); pgJ.wait_for_timeout(1400)
    pgJ.evaluate(TAB, "BETS"); pgJ.wait_for_timeout(900)
    pgJ.evaluate(ROOM, "Bounties"); pgJ.wait_for_timeout(900)
    pgJ.evaluate(CLICK, "I did it"); pgJ.wait_for_timeout(1600)
    check("claim it", any(b["state"] == "claimed" for b in state(cJ)["bounties"]))

    pgR.reload(wait_until="networkidle"); pgR.wait_for_timeout(1400)
    pgR.evaluate(TAB, "BETS"); pgR.wait_for_timeout(900)
    pgR.evaluate(ROOM, "Bounties"); pgR.wait_for_timeout(900)
    pgR.evaluate(HAS, "Pay "); pgR.wait_for_timeout(1600)
    check("pay it", any(b["state"] == "paid" for b in state(cR)["bounties"]))

    # The corners the tab walk doesn't reach
    pgR.evaluate("""()=>{const b=[...document.querySelectorAll('button')]
        .find(e=>/settings/i.test(e.getAttribute('aria-label')||'')); if(b) b.click();}""")
    pgR.wait_for_timeout(1100)
    check("settings opens", len(pgR.inner_text("body")) > 400)
    pgR.evaluate(CLICK, "Close"); pgR.wait_for_timeout(500)

    pgR.evaluate(TAB, "WEEK"); pgR.wait_for_timeout(900)
    seen = set()
    for _ in range(4):
        pgR.evaluate("""()=>{const b=[...document.querySelectorAll('button')]
            .find(e=>(e.getAttribute('aria-label')||'').match(/previous|earlier|back/i));
            if(b) b.click();}""")
        pgR.wait_for_timeout(700)
        seen.add(pgR.inner_text("body")[:120])
    check("page back through weeks", len(seen) > 1, f"{len(seen)} different weeks")

    for who, errs in (("Ryan", eR), ("Jona", eJ)):
        if errs:
            problems.append(f"{who}: page errors {errs[:2]}")
    cR.close(); cJ.close()


def main():
    print(f"QA against {U}\n")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        seed(browser)
        print("\nreading every screen")
        read_walk(browser)
        print("\npressing everything that writes")
        write_walk(browser)
        browser.close()
    print("\n=== PROBLEMS ===" if problems else "\n=== clean ===")
    for x in problems:
        print(" *", x)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
