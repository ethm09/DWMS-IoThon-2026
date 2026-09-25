import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ScrollText, Search, Filter, Trash2, Download, Clock,
  User, Shield, Activity, AlertTriangle, Power, Cpu,
  RotateCcw, Wrench, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProcessMode, type DwmsEvent } from "@/hooks/use-process-mode.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { toast } from "sonner";

// ── Event type styling ───────────────────────────────────────────────────────

type EventCategory = "emergency" | "pump" | "mode" | "correction" | "system" | "filtration";

function categorizeEvent(type: string): EventCategory {
  const lower = type.toLowerCase();
  if (lower.includes("emergency") || lower.includes("shutdown")) return "emergency";
  if (lower.includes("pump")) return "pump";
  if (lower.includes("mode") || lower.includes("manual") || lower.includes("auto")) return "mode";
  if (lower.includes("correction") || lower.includes("calibrat") || lower.includes("threshold")) return "correction";
  if (lower.includes("filtration") || lower.includes("filter")) return "filtration";
  return "system";
}

const CATEGORY_CONFIG: Record<EventCategory, { color: string; icon: React.ElementType; label: string }> = {
  emergency: { color: "#ef4444", icon: AlertTriangle, label: "Emergency" },
  pump: { color: "#22c55e", icon: Power, label: "Pump" },
  mode: { color: "#a855f7", icon: Cpu, label: "Mode Change" },
  correction: { color: "#3b82f6", icon: Wrench, label: "Correction" },
  filtration: { color: "#06b6d4", icon: Activity, label: "Filtration" },
  system: { color: "#6b7280", icon: RotateCcw, label: "System" },
};

const MODE_COLORS: Record<string, string> = {
  auto: "#22c55e",
  manual: "#a855f7",
  emergency: "#ef4444",
};

// ── Event Row Component ──────────────────────────────────────────────────────

function EventRow({ event, index }: { event: DwmsEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const category = categorizeEvent(event.type);
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;
  const modeColor = MODE_COLORS[event.systemMode] ?? "#6b7280";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="rounded-lg border p-3 transition-colors hover:bg-accent/20"
      style={{ borderColor: `${cfg.color}22` }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${cfg.color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{event.type}</span>
            <span
              className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}33` }}
            >
              {cfg.label.toUpperCase()}
            </span>
          </div>

          {/* Details preview */}
          {event.decision && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.decision}</div>
          )}
          {event.action && !event.decision && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.action}</div>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {new Date(event.timestamp).toLocaleString()}
            </span>
            <span
              className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded"
              style={{ color: modeColor, background: `${modeColor}12` }}
            >
              {event.systemMode.toUpperCase()}
            </span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <Power className="w-2.5 h-2.5" />
              PUMP {event.pumpStatus ? "ON" : "OFF"}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        {(event.parameter || event.oldValue !== undefined || event.newValue !== undefined || event.decision || event.action) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-accent/50 cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-2">
              {event.parameter && (
                <div className="rounded-lg bg-muted/30 p-2">
                  <div className="text-[8px] font-bold tracking-widest text-muted-foreground">PARAMETER</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">{event.parameter}</div>
                </div>
              )}
              {event.oldValue !== undefined && event.oldValue !== null && (
                <div className="rounded-lg bg-muted/30 p-2">
                  <div className="text-[8px] font-bold tracking-widest text-muted-foreground">OLD VALUE</div>
                  <div className="font-mono text-xs font-bold text-foreground mt-0.5">{String(event.oldValue)}</div>
                </div>
              )}
              {event.newValue !== undefined && event.newValue !== null && (
                <div className="rounded-lg bg-muted/30 p-2">
                  <div className="text-[8px] font-bold tracking-widest text-muted-foreground">NEW VALUE</div>
                  <div className="font-mono text-xs font-bold text-foreground mt-0.5">{String(event.newValue)}</div>
                </div>
              )}
              {event.decision && (
                <div className="rounded-lg bg-muted/30 p-2 col-span-2">
                  <div className="text-[8px] font-bold tracking-widest text-muted-foreground">DECISION</div>
                  <div className="text-xs text-foreground/80 mt-0.5">{event.decision}</div>
                </div>
              )}
              {event.action && (
                <div className="rounded-lg bg-muted/30 p-2 col-span-2">
                  <div className="text-[8px] font-bold tracking-widest text-muted-foreground">ACTION TAKEN</div>
                  <div className="text-xs text-foreground/80 mt-0.5">{event.action}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ActivityLog() {
  const { eventLog, clearEventLog } = useProcessMode();
  const { isAdmin, role } = useUserRole();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Filter events
  const filteredEvents = useMemo(() => {
    let events = [...eventLog];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.type.toLowerCase().includes(q) ||
          (e.parameter?.toLowerCase().includes(q) ?? false) ||
          (e.decision?.toLowerCase().includes(q) ?? false) ||
          (e.action?.toLowerCase().includes(q) ?? false)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      events = events.filter((e) => categorizeEvent(e.type) === categoryFilter);
    }

    // Mode filter
    if (modeFilter !== "all") {
      events = events.filter((e) => e.systemMode === modeFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = Date.now();
      const cutoff =
        dateFilter === "1h" ? now - 60 * 60 * 1000
          : dateFilter === "6h" ? now - 6 * 60 * 60 * 1000
            : dateFilter === "24h" ? now - 24 * 60 * 60 * 1000
              : dateFilter === "7d" ? now - 7 * 24 * 60 * 60 * 1000
                : 0;
      events = events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    }

    return events;
  }, [eventLog, searchQuery, categoryFilter, modeFilter, dateFilter]);

  // Stats
  const stats = useMemo(() => {
    const categories: Record<EventCategory, number> = {
      emergency: 0, pump: 0, mode: 0, correction: 0, filtration: 0, system: 0,
    };
    for (const event of eventLog) {
      categories[categorizeEvent(event.type)]++;
    }
    return categories;
  }, [eventLog]);

  const handleExport = () => {
    const csv = [
      "Timestamp,Type,Category,Parameter,Old Value,New Value,Decision,Action,System Mode,Pump Status",
      ...eventLog.map((e) =>
        [
          e.timestamp,
          `"${e.type}"`,
          categorizeEvent(e.type),
          e.parameter ?? "",
          e.oldValue ?? "",
          e.newValue ?? "",
          `"${e.decision ?? ""}"`,
          `"${e.action ?? ""}"`,
          e.systemMode,
          e.pumpStatus ? "ON" : "OFF",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dwms-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Activity log exported as CSV");
  };

  const handleClear = () => {
    clearEventLog();
    toast.success("Activity log cleared");
  };

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || modeFilter !== "all" || dateFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setModeFilter("all");
    setDateFilter("all");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase flex items-center gap-2">
            <ScrollText className="w-5 h-5" /> Activity Log
          </h2>
          <p className="text-xs text-muted-foreground tracking-wider mt-0.5">
            {isAdmin ? "Full system audit trail" : "Your activity history"} — {eventLog.length} total events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              onClick={handleExport}
              size="sm"
              variant="ghost"
              className="font-bold tracking-widest text-[9px] cursor-pointer text-muted-foreground hover:text-foreground"
              disabled={eventLog.length === 0}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> EXPORT CSV
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={handleClear}
              size="sm"
              variant="ghost"
              className="font-bold tracking-widest text-[9px] cursor-pointer text-destructive hover:text-destructive"
              disabled={eventLog.length === 0}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> CLEAR LOG
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {(Object.entries(CATEGORY_CONFIG) as [EventCategory, typeof CATEGORY_CONFIG[EventCategory]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(categoryFilter === key ? "all" : key)}
            className="rounded-lg border p-2.5 text-center cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              borderColor: categoryFilter === key ? cfg.color : `${cfg.color}33`,
              background: categoryFilter === key ? `${cfg.color}15` : `${cfg.color}05`,
            }}
          >
            <cfg.icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: cfg.color }} />
            <div className="font-mono text-lg font-bold" style={{ color: cfg.color }}>
              {stats[key]}
            </div>
            <div className="text-[7px] font-bold tracking-widest text-muted-foreground mt-0.5">
              {cfg.label.toUpperCase()}
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4" /> FILTERS
            </span>
            {hasActiveFilters && (
              <Button
                onClick={clearFilters}
                size="sm"
                variant="ghost"
                className="text-[9px] font-bold tracking-widest cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3 mr-1" /> CLEAR
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>

            {/* Category */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-sm cursor-pointer">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="pump">Pump</SelectItem>
                <SelectItem value="mode">Mode Change</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
                <SelectItem value="filtration">Filtration</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>

            {/* Mode */}
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="h-8 text-sm cursor-pointer">
                <SelectValue placeholder="All modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-8 text-sm cursor-pointer">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      {hasActiveFilters && (
        <div className="text-[10px] font-bold tracking-widest text-muted-foreground">
          Showing {filteredEvents.length} of {eventLog.length} events
        </div>
      )}

      {/* Event list */}
      {filteredEvents.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScrollText />
            </EmptyMedia>
            <EmptyTitle>
              {eventLog.length === 0 ? "No activity recorded yet" : "No matching events"}
            </EmptyTitle>
            <EmptyDescription>
              {eventLog.length === 0
                ? "System events will appear here as you interact with the DWMS"
                : "Try adjusting your filters to find what you're looking for"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filteredEvents.map((event, i) => (
            <EventRow key={event.id} event={event} index={i} />
          ))}
        </div>
      )}

      {/* Access info */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border p-3 flex items-center gap-2"
          style={{ borderColor: "#eab30833", background: "#eab3080a" }}
        >
          <Shield className="w-4 h-4 text-yellow-500 shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            <strong className="text-yellow-500">Limited view:</strong> You are viewing events from your current session.
            Admin users have access to the full audit trail with export and management capabilities.
          </span>
        </motion.div>
      )}
    </div>
  );
}
