"use client";

import { useEffect, useState } from "react";
import type { AppState } from "@/lib/types";
import type { DayKey } from "@/lib/dates";
import { RecordsTab } from "./RecordsTab";
import { HallOfFame } from "./HallOfFame";
import { TitlesTab } from "./TitlesTab";

type Book = "records" | "fame";
const STORAGE_KEY = "amacomp-records-view";

/**
 * One tab for everything all-time, with a toggle at the top: the record book
 * (speed and power, from Strava streams) and the Hall of Fame (volume — biggest
 * week, most points in a day — followed by the titles: week wins, months and
 * seasons). Remembers which one you were last looking at.
 *
 * Titles used to be its own tab. It sits under the Hall of Fame because both
 * answer "what has anyone ever done", and folding them together freed the nav
 * slot the Club needed.
 */
export function RecordsAndFame({ state, refDay }: { state: AppState; refDay: DayKey }) {
  const [book, setBook] = useState<Book>("records");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot, restoring the last view
      if (saved === "fame" || saved === "records") setBook(saved);
    } catch {
      /* private mode — default to the record book */
    }
  }, []);

  function choose(next: Book) {
    setBook(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the choice still applies for this visit */
    }
  }

  const options: { id: Book; label: string }[] = [
    { id: "records", label: "Records" },
    { id: "fame", label: "Hall of Fame" },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Records or Hall of Fame"
        className="flex gap-1 rounded-xl pane border border-line bg-tile p-1"
      >
        {options.map((o) => {
          const on = book === o.id;
          return (
            <button
              key={o.id}
              role="tab"
              aria-selected={on}
              onClick={() => choose(o.id)}
              className={`eyebrow flex-1 rounded-lg py-2.5 transition-colors ${
                on ? (o.id === "fame" ? "bg-gold text-white" : "bg-ink text-on-ink") : "text-ink-2"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {book === "records" ? (
        <RecordsTab state={state} refDay={refDay} />
      ) : (
        <div className="space-y-8">
          <HallOfFame state={state} />
          <TitlesTab state={state} refDay={refDay} />
        </div>
      )}
    </div>
  );
}
