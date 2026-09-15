#!/usr/bin/env python3
"""
Builds the "AmaComp Steps" iOS Shortcut as a file, so nobody has to assemble it
by hand on a phone (docs/steps-shortcut.md is the by-hand version).

    python3 scripts/build-steps-shortcut.py --out "AmaComp Steps.shortcut"
    python3 scripts/build-steps-shortcut.py --token <code> --out ryan.shortcut

With --token the code is baked in: a personal shortcut, installed with one tap
and no code to hand over (scripts/make-step-shortcuts.mjs makes one per
athlete). Without it, the shortcut takes its code from AmaComp's "Open the
shortcut" button and keeps it in iCloud Drive/Shortcuts/AmaComp/token.txt.

A shortcut file only imports on iOS once it's signed, and signing needs a Mac
signed into iCloud: this runs `shortcuts sign --mode anyone` on the result.

What it does, on every run:
  1. Get the code (baked in, or saved from AmaComp); stop with an alert if none.
  2. (see above)
  3. Find Health Samples: Steps, start date today, grouped by day. Grouping is
     what merges the phone and a watch the way the Health app does — summing the
     raw samples would count a walk twice.
  4. POST {"<today>": "<steps>"} to /api/steps with the code as a bearer token.
  5. Stay quiet — it runs on every app open. It speaks once, the first time a
     report lands ("Connected"), and whenever the server turns a report down.

Only today is sent. "Is in the last N days" is a rolling window, so a grouped
total for the oldest day would be a partial one — and a report REPLACES that
day's stored total. Today, sent on every app open, never undercounts.
"""
import argparse, os, plistlib, subprocess, sys, time, uuid

NAME = "AmaComp Steps"
OBJ = "￼"


def uid():
    return str(uuid.uuid4()).upper()


def out(u, name):
    return {"OutputName": name, "OutputUUID": u, "Type": "ActionOutput"}


VAR_INPUT = {"Type": "ExtensionInput"}


def named(v):
    return {"Type": "Variable", "VariableName": v}


def attach(value):
    return {"Value": value, "WFSerializationType": "WFTextTokenAttachment"}


def text(*parts):
    """A token string: plain strings and variable dicts, in order."""
    s, ranges = "", {}
    for p in parts:
        if isinstance(p, str):
            s += p
        else:
            ranges[f"{{{len(s.encode('utf-16-le')) // 2}, 1}}"] = p
            s += OBJ
    return {"Value": {"attachmentsByRange": ranges, "string": s}, "WFSerializationType": "WFTextTokenString"}


def cond_input(value):
    return {"Type": "Variable", "Variable": attach(value)}


def act(ident, **params):
    return {"WFWorkflowActionIdentifier": f"is.workflow.actions.{ident}", "WFWorkflowActionParameters": params}


def if_block(value, code, body, otherwise=None, string=None):
    g = uid()
    head = dict(GroupingIdentifier=g, WFControlFlowMode=0, WFCondition=code, WFInput=cond_input(value))
    if string is not None:
        head["WFConditionalActionString"] = string
    acts = [act("conditional", **head), *body]
    if otherwise is not None:
        acts += [act("conditional", GroupingIdentifier=g, WFControlFlowMode=1), *otherwise]
    acts.append(act("conditional", GroupingIdentifier=g, WFControlFlowMode=2, UUID=uid()))
    return acts


def build(base, token=None):
    a = []

    if token:
        # 1. The code, baked in.
        t_tok = uid()
        a += [
            act("gettext", UUID=t_tok, WFTextActionText=token),
            act("setvariable", WFVariableName="Token", WFInput=attach(out(t_tok, "Text"))),
        ]
    else:
        # 1. Keep the code AmaComp hands over, then load it.
        t_in = uid()
        a += if_block(VAR_INPUT, 100, [
            act("gettext", UUID=t_in, WFTextActionText=text(VAR_INPUT)),
            act("documentpicker.save", UUID=uid(), WFInput=attach(out(t_in, "Text")),
                WFAskWhereToSave=False, WFSaveFileOverwrite=True,
                WFFileDestinationPath=text("AmaComp/token.txt")),
        ])
        f = uid()
        t_tok = uid()
        a += [
            act("documentpicker.open", UUID=f, WFGetFilePath=text("AmaComp/token.txt"),
                WFFileErrorIfNotFound=False, WFShowFilePicker=False),
            act("detect.text", UUID=t_tok, WFInput=attach(out(f, "File"))),
            act("setvariable", WFVariableName="Token", WFInput=attach(out(t_tok, "Text"))),
        ]
        a += if_block(named("Token"), 101, [
            act("alert", WFAlertActionTitle="AmaComp Steps",
                WFAlertActionMessage=text("Open AmaComp → Settings → Steps and tap Get my code, then Open the shortcut."),
                WFAlertActionCancelButtonShown=False),
            act("exit"),
        ])

    # 3. Today's steps, merged across phone and watch.
    h = uid()
    a.append(act(
        "filter.health.quantity", UUID=h,
        WFContentItemFilter={
            "Value": {
                "WFActionParameterFilterPrefix": 1,
                "WFContentPredicateBoundedDate": False,
                "WFActionParameterFilterTemplates": [
                    {"Bounded": True, "Operator": 4, "Property": "Type", "Removable": False,
                     "Values": {"Enumeration": {"Value": "Steps", "WFSerializationType": "WFStringSubstitutableState"}}},
                    {"Bounded": True, "Operator": 1002, "Property": "Start Date", "Removable": True,
                     "Values": {"Number": "7", "Unit": 16}},
                ],
            },
            "WFSerializationType": "WFContentPredicateTableTemplate",
        },
        WFHKSampleFilteringGroupBy="Day",
        WFHKSampleFilteringFillMissing=False,
        WFContentItemSortProperty="Start Date",
        WFContentItemSortOrder="Latest First",
        WFContentItemLimitEnabled=True,
        WFContentItemLimitNumber=1.0,
    ))
    v = uid()
    n = uid()
    d = uid()
    a += [
        act("properties.health.quantity", UUID=v, WFContentItemPropertyName="Value",
            WFInput=attach(out(h, "Health Samples"))),
        act("detect.number", UUID=n, WFInput=attach(out(v, "Value"))),
    ]
    # Nothing walked yet today (just after midnight): nothing to send.
    a += if_block(out(n, "Numbers"), 101, [act("exit")])
    a += [
        act("format.date", UUID=d, WFDate=text({"Type": "CurrentDate"}),
            WFDateFormatStyle="Custom", WFDateFormat="yyyy-MM-dd", WFDateFormatString="yyyy-MM-dd",
            WFTimeFormatStyle="None"),
    ]

    # 4. Send.
    u = uid()
    a.append(act(
        "downloadurl", UUID=u, Advanced=True, ShowHeaders=True,
        WFURL=f"{base}/api/steps", WFHTTPMethod="POST", WFHTTPBodyType="JSON",
        WFHTTPHeaders={"Value": {"WFDictionaryFieldValueItems": [
            {"WFItemType": 0, "WFKey": text("Authorization"), "WFValue": text("Bearer ", named("Token"))},
        ]}, "WFSerializationType": "WFDictionaryFieldValue"},
        WFJSONValues={"Value": {"WFDictionaryFieldValueItems": [
            {"WFItemType": 0, "WFKey": text(out(d, "Formatted Date")), "WFValue": text(out(n, "Numbers"))},
        ]}, "WFSerializationType": "WFDictionaryFieldValue"},
    ))

    # 5. Quiet on success, except the first time; say so when it's turned down.
    resp = out(u, "Contents of URL")
    seen = uid()
    marker = uid()
    a += if_block(resp, 99, [
        act("documentpicker.open", UUID=seen, WFGetFilePath=text("AmaComp/connected.txt"),
            WFFileErrorIfNotFound=False, WFShowFilePicker=False),
        *if_block(out(seen, "File"), 101, [
            act("notification", WFNotificationActionTitle="AmaComp",
                WFNotificationActionBody=text("Connected — today's steps (", out(n, "Numbers"),
                                              ") are on the board. From now on it runs by itself.")),
            act("gettext", UUID=marker, WFTextActionText=text({"Type": "CurrentDate"})),
            act("documentpicker.save", UUID=uid(), WFInput=attach(out(marker, "Text")),
                WFAskWhereToSave=False, WFSaveFileOverwrite=True,
                WFFileDestinationPath=text("AmaComp/connected.txt")),
        ]),
    ], otherwise=[
        act("notification", WFNotificationActionTitle="AmaComp Steps didn't send",
            WFNotificationActionBody=text(resp)),
    ], string='"ok":true')

    return {
        "WFWorkflowActions": a,
        "WFWorkflowClientVersion": "2700.0.4",
        "WFWorkflowClientRelease": "26A0000a",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowIcon": {"WFWorkflowIconGlyphNumber": 59511, "WFWorkflowIconStartColor": 4292093695},
        "WFWorkflowName": NAME,
        "WFWorkflowImportQuestions": [],
        "WFWorkflowTypes": [],
        "WFWorkflowHasShortcutInputVariables": True,
        "WFWorkflowInputContentItemClasses": ["WFStringContentItem"],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasOutputFallback": False,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://amagohtrain-production.up.railway.app")
    ap.add_argument("--token", default=None, help="bake this athlete's step code in")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    unsigned = args.out[: -len(".shortcut")] + " (unsigned).shortcut"
    with open(unsigned, "wb") as fh:
        plistlib.dump(build(args.base.rstrip("/"), args.token), fh, fmt=plistlib.FMT_BINARY)
    # Apple's signing service throws 502/503s in bursts; a later try goes through.
    for attempt in range(6):
        r = subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", unsigned, "--output", args.out],
                           capture_output=True, text=True)
        if r.returncode == 0:
            break
        time.sleep(10 * (attempt + 1))
    os.remove(unsigned)
    if r.returncode != 0:
        sys.exit(f"signing failed: {r.stderr or r.stdout}")
    print("wrote", os.path.abspath(args.out))


if __name__ == "__main__":
    main()
