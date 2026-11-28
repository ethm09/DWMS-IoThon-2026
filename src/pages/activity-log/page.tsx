import CommandHistory from "@/components/command-history";
import LiveAccessState from "@/components/live-access-state";
export default function ActivityLog() {
  return <LiveAccessState><div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8"><div><p className="text-sm font-medium text-primary">DWMS Live</p><h1 className="mt-2 text-2xl font-semibold">Events</h1></div><CommandHistory /></div></LiveAccessState>;
}
