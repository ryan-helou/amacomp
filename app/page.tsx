import { AppShell } from "@/components/AppShell";
import { logToday, today } from "@/lib/dates";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function Page() {
  const state = await readState();
  return <AppShell initial={state} serverToday={today()} serverLogDay={logToday()} />;
}
