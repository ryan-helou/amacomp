import { AppShell } from "@/components/AppShell";
import { leagueLogToday, leagueToday } from "@/lib/dates";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function Page() {
  const state = await readState();
  // The league's own calendar, not the container's — see LEAGUE_TZ. The client
  // takes over from the device clock on mount either way, but the markup it
  // hydrates over has to be right, and on a UTC host it wasn't after 8 PM.
  return (
    <AppShell initial={state} serverToday={leagueToday()} serverLogDay={leagueLogToday()} />
  );
}
