# Building the "AmaComp Steps" shortcut

Steps reach AmaComp through one free iOS Shortcut that everyone shares. It has to
be built **once, on an iPhone** (the Mac's Shortcuts app has no Health actions),
then shared by iCloud link. Paste that link into `STEPS_SHORTCUT_URL` in
`lib/steps.ts` and deploy; Settings → Steps then offers it to everyone.

How it works end to end is in `lib/steps.ts`. The server end is `POST /api/steps`.

## Build it

Open **Shortcuts → +**, name it exactly **AmaComp Steps**, and add these actions
in order. Names are as they appear on iOS 17–27.

### A. Take the code when AmaComp hands it over
1. **If** — *Shortcut Input* · **has any value**
2. &nbsp;&nbsp;**Save File** — save *Shortcut Input* to the **Shortcuts** folder, subpath
   `AmaComp/token.txt`. Turn **Ask Where to Save** off and **Overwrite If File
   Exists** on.
3. **End If**

### B. Load the code
4. **Get File** — from the Shortcuts folder, path `AmaComp/token.txt`.
   Turn **Error If Not Found** off.
5. **Set Variable** — `Token`
6. **If** — *Token* · **does not have any value**
7. &nbsp;&nbsp;**Show Alert** — "Open AmaComp → Settings → Steps and tap Get my code."
8. &nbsp;&nbsp;**Stop This Shortcut**
9. **End If**

### C. Skip if it sent under 20 minutes ago (not when run from AmaComp)
10. **If** — *Shortcut Input* · **does not have any value**
11. &nbsp;&nbsp;**Get File** — path `AmaComp/last.txt`, **Error If Not Found** off
12. &nbsp;&nbsp;**If** — *File* · **has any value**
13. &nbsp;&nbsp;&nbsp;&nbsp;**Get Dates from Input** — *File*
14. &nbsp;&nbsp;&nbsp;&nbsp;**Get Time Between Dates** — from *Dates* to *Current Date*, in **Minutes**
15. &nbsp;&nbsp;&nbsp;&nbsp;**If** — *Time Between Dates* · **is less than** · `20`
16. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;**Stop This Shortcut**
17. &nbsp;&nbsp;&nbsp;&nbsp;**End If**
18. &nbsp;&nbsp;**End If**
19. **End If**

### D. Read the day totals
20. **Find Health Samples** — **Steps**, where **Start Date is in the last 2 days**.
    **Group By: Day**, **Fill Missing** off, sort by **Start Date**.
21. **Dictionary** — leave it empty. **Set Variable** — `Map`
22. **Repeat with Each** — *Health Samples*
23. &nbsp;&nbsp;**Get Details of Health Sample** — **Start Date** of *Repeat Item*
24. &nbsp;&nbsp;**Format Date** — Date Format **Custom**, `yyyy-MM-dd`. **Set Variable** — `Day`
25. &nbsp;&nbsp;**Get Details of Health Sample** — **Value** of *Repeat Item*. **Set Variable** — `Count`
26. &nbsp;&nbsp;**Set Dictionary Value** — set `Day` to `Count` in *Map*
27. &nbsp;&nbsp;**Set Variable** — `Map` (to the *Dictionary* it outputs)
28. **End Repeat**

### E. Send them
29. **Get Contents of URL** — `https://amagohtrain-production.up.railway.app/api/steps`
    - Method **POST**
    - Headers: `Authorization` = `Bearer ` then the *Token* variable;
      `Content-Type` = `application/json`
    - Request Body **File** → *Map*
30. **If** — *Contents of URL* · **contains** · `"ok":true`
31. &nbsp;&nbsp;**Format Date** — *Current Date*, **ISO 8601**
32. &nbsp;&nbsp;**Save File** — to `AmaComp/last.txt`, Ask Where to Save off, Overwrite on
33. &nbsp;&nbsp;**If** — *Shortcut Input* · **has any value**
34. &nbsp;&nbsp;&nbsp;&nbsp;**Show Notification** — "Connected — your steps are on the board."
35. &nbsp;&nbsp;**End If**
36. **End If**

The body it sends looks like `{"2026-09-14":"11,240","2026-09-15":"7,002"}`. The
server accepts that and several other shapes, so a slightly different build still
works. Each report **replaces** that day's total; it never adds to it.

## Test on your phone before sharing

1. **Connect.** AmaComp → Settings → Steps → **Get my code** → **Open the
   shortcut**. The first run asks for Health and website access — **Always
   Allow**. You should get the "Connected" notification.
2. **Double counting — the important one.** Compare today on AmaComp's Board →
   Steps → Today with the Health app's Steps. If AmaComp is higher, the grouped
   totals aren't merging your phone and watch. In step 20, add a filter
   **Source is [your watch]** — Garmin shows as "Connect", Amazfit as "Zepp".
   Amazfit users are the most likely to need this.
3. **Automatic runs.** Make the automation (Settings → Steps, step 3), open
   Messages, wait 20 minutes, open it again, and check the "Last report" time in
   Settings moves. If iOS asks for confirmation each time despite **Run
   Immediately** (a known bug since iOS 18.2), note it.
4. **Share.** Shortcut → share → **Copy iCloud Link**. On iOS 27 you can include
   the automation in the share, which saves everyone step 3.
