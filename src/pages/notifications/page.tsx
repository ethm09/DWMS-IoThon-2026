import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell, BellOff, AlertCircle, AlertTriangle, Info, CheckCheck,
  Trash2, Settings2, Volume2, VolumeX, Globe, Server,
  SlidersHorizontal, Wrench, Radio, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Authenticated, AuthLoading } from "convex/react";

type NotificationLevel = "critical" | "warning" | "info";
type NotificationCategory = "threshold" | "device" | "system" | "maintenance";

const LEVEL_CONFIG: Record<NotificationLevel, { color: string; bg: string; border: string; icon: React.FC<{ className?: string }> }> = {
  critical: { color: "#ef4444", bg: "#ef444412", border: "#ef444455", icon: AlertCircle },
  warning: { color: "#eab308", bg: "#eab30812", border: "#eab30855", icon: AlertTriangle },
  info: { color: "#06b6d4", bg: "#06b6d412", border: "#06b6d455", icon: Info },
};

const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; icon: React.FC<{ className?: string }> }> = {
  threshold: { label: "Threshold", icon: SlidersHorizontal },
  device: { label: "Device", icon: Radio },
  system: { label: "System", icon: Server },
  maintenance: { label: "Maintenance", icon: Wrench },
};

function NotificationsList() {
  const [levelFilter, setLevelFilter] = useState<NotificationLevel | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | "all">("all");

  const notifications = useQuery(api.notifications.list, { limit: 50 });
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const dismissNotification = useMutation(api.notifications.dismiss);
  const dismissAll = useMutation(api.notifications.dismissAll);

  if (notifications === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const filtered = notifications.filter((n) => {
    if (levelFilter !== "all" && n.level !== levelFilter) return false;
    if (categoryFilter !== "all" && n.category !== categoryFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tracking-wider">
            {unreadCount} unread of {notifications.length} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="cursor-pointer text-xs tracking-widest gap-1"
            style={{ background: "transparent", border: "1px solid oklch(0.25 0.04 145)", color: "oklch(0.55 0.04 145)" }}
            onClick={async () => {
              const count = await markAllAsRead();
              toast.success(`Marked ${count} notifications as read`);
            }}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="w-3.5 h-3.5" /> MARK ALL READ
          </Button>
          <Button
            size="sm"
            className="cursor-pointer text-xs tracking-widest gap-1"
            style={{ background: "transparent", border: "1px solid oklch(0.25 0.04 145)", color: "oklch(0.55 0.04 145)" }}
            onClick={async () => {
              const count = await dismissAll();
              toast.success(`Dismissed ${count} notifications`);
            }}
            disabled={notifications.length === 0}
          >
            <Trash2 className="w-3.5 h-3.5" /> DISMISS ALL
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["all", "critical", "warning", "info"] as const).map((level) => {
          const label = level === "all" ? "ALL" : level.toUpperCase();
          const color = level === "all" ? "#6b7280" : LEVEL_CONFIG[level].color;
          return (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border cursor-pointer transition-all"
              style={{
                color: levelFilter === level ? "#0f172a" : color,
                background: levelFilter === level ? color : `${color}15`,
                borderColor: color,
              }}
            >
              {label}
            </button>
          );
        })}
        <div className="w-px bg-border mx-1" />
        {(["all", "threshold", "device", "system", "maintenance"] as const).map((cat) => {
          const label = cat === "all" ? "ALL" : CATEGORY_CONFIG[cat].label.toUpperCase();
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border cursor-pointer transition-all"
              style={{
                color: categoryFilter === cat ? "#0f172a" : "oklch(0.55 0.04 145)",
                background: categoryFilter === cat ? "oklch(0.55 0.04 145)" : "oklch(0.55 0.04 145 / 0.1)",
                borderColor: "oklch(0.55 0.04 145 / 0.4)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Notifications list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Bell className="w-4 h-4" /> NOTIFICATIONS
            {unreadCount > 0 && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444455" }}
              >
                {unreadCount} NEW
              </motion.span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {filtered.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><BellOff /></EmptyMedia>
                    <EmptyTitle>No notifications</EmptyTitle>
                    <EmptyDescription>
                      {levelFilter !== "all" || categoryFilter !== "all"
                        ? "Try adjusting your filters"
                        : "You're all caught up"}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
              {filtered.map((notification) => {
                const cfg = LEVEL_CONFIG[notification.level];
                const Icon = cfg.icon;
                const catCfg = CATEGORY_CONFIG[notification.category];
                const CatIcon = catCfg.icon;

                return (
                  <motion.div
                    key={notification._id}
                    initial={{ opacity: 0, x: -16, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: 16, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-lg border p-3 flex items-start gap-3 relative"
                    style={{
                      borderColor: cfg.border,
                      background: notification.read ? "transparent" : cfg.bg,
                      opacity: notification.read ? 0.7 : 1,
                    }}
                  >
                    {/* Unread indicator */}
                    {!notification.read && (
                      <div
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ background: cfg.color }}
                      />
                    )}

                    <span style={{ color: cfg.color }}><Icon className="w-4 h-4 shrink-0 mt-0.5" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold tracking-widest" style={{ color: cfg.color }}>
                          {notification.title}
                        </span>
                        <span
                          className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
                          style={{
                            background: "oklch(0.15 0.04 145)",
                            color: "oklch(0.55 0.04 145)",
                            border: "1px solid oklch(0.25 0.04 145)",
                          }}
                        >
                          <CatIcon className="w-2.5 h-2.5" />
                          {catCfg.label.toUpperCase()}
                        </span>
                        {notification.parameter && (
                          <span
                            className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.border}` }}
                          >
                            {notification.parameter}: {notification.value}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {notification.message}
                      </p>
                      <div className="text-[9px] font-mono text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead({ notificationId: notification._id })}
                          className="text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer p-1"
                          title="Mark as read"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => dismissNotification({ notificationId: notification._id })}
                        className="text-muted-foreground/40 hover:text-red-400 transition-colors cursor-pointer p-1"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreferencesPanel() {
  const preferences = useQuery(api.notifications.getPreferences);
  const updatePreferences = useMutation(api.notifications.updatePreferences);

  if (preferences === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const handleToggle = (key: string, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    // Remove _id and _creationTime if present
    const { ...clean } = updated;
    const payload = {
      enableCritical: clean.enableCritical,
      enableWarning: clean.enableWarning,
      enableInfo: clean.enableInfo,
      enableThreshold: clean.enableThreshold,
      enableDevice: clean.enableDevice,
      enableSystem: clean.enableSystem,
      enableMaintenance: clean.enableMaintenance,
      soundEnabled: clean.soundEnabled,
      browserNotifications: clean.browserNotifications,
    };
    updatePreferences(payload);
    toast.success("Preferences updated");
  };

  return (
    <div className="space-y-6">
      {/* Level preferences */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Filter className="w-4 h-4" /> ALERT LEVELS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { key: "enableCritical", label: "Critical Alerts", desc: "Emergency and critical threshold breaches", color: "#ef4444" },
            { key: "enableWarning", label: "Warning Alerts", desc: "Parameters approaching unsafe levels", color: "#eab308" },
            { key: "enableInfo", label: "Info Alerts", desc: "System status updates and informational notices", color: "#06b6d4" },
          ] as const).map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <div>
                  <div className="text-xs font-bold tracking-wider">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                </div>
              </div>
              <Switch
                checked={preferences[item.key]}
                onCheckedChange={(v) => handleToggle(item.key, v)}
                className="cursor-pointer"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Category preferences */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> NOTIFICATION CATEGORIES
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { key: "enableThreshold", label: "Threshold Alerts", desc: "When sensor values exceed safe limits", icon: SlidersHorizontal },
            { key: "enableDevice", label: "Device Alerts", desc: "Device connectivity and hardware issues", icon: Radio },
            { key: "enableSystem", label: "System Alerts", desc: "Mode changes, shutdowns, and system events", icon: Server },
            { key: "enableMaintenance", label: "Maintenance Alerts", desc: "Calibration reminders and maintenance schedules", icon: Wrench },
          ] as const).map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs font-bold tracking-wider">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                </div>
              </div>
              <Switch
                checked={preferences[item.key]}
                onCheckedChange={(v) => handleToggle(item.key, v)}
                className="cursor-pointer"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sound and browser */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Volume2 className="w-4 h-4" /> DELIVERY OPTIONS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center gap-3">
              {preferences.soundEnabled ? <Volume2 className="w-4 h-4 text-muted-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
              <div>
                <div className="text-xs font-bold tracking-wider">Alert Sound</div>
                <div className="text-[10px] text-muted-foreground">Play a sound for new critical alerts</div>
              </div>
            </div>
            <Switch
              checked={preferences.soundEnabled}
              onCheckedChange={(v) => handleToggle("soundEnabled", v)}
              className="cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="text-xs font-bold tracking-wider">Browser Notifications</div>
                <div className="text-[10px] text-muted-foreground">Show desktop notifications when app is in background</div>
              </div>
            </div>
            <Switch
              checked={preferences.browserNotifications}
              onCheckedChange={(v) => handleToggle("browserNotifications", v)}
              className="cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BroadcastPanel() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState<NotificationLevel>("info");
  const [category, setCategory] = useState<NotificationCategory>("system");
  const broadcast = useMutation(api.notifications.broadcast);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    try {
      const count = await broadcast({
        level,
        category,
        title: title.trim(),
        message: message.trim(),
        minRole: "viewer",
      });
      toast.success(`Notification sent to ${count} users`);
      setTitle("");
      setMessage("");
    } catch {
      toast.error("Failed to send notification");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
          <Radio className="w-4 h-4" /> BROADCAST NOTIFICATION
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground">LEVEL</label>
          <div className="flex gap-2">
            {(["critical", "warning", "info"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest border cursor-pointer transition-all"
                style={{
                  color: level === l ? "#0f172a" : LEVEL_CONFIG[l].color,
                  background: level === l ? LEVEL_CONFIG[l].color : LEVEL_CONFIG[l].bg,
                  borderColor: LEVEL_CONFIG[l].border,
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground">CATEGORY</label>
          <div className="flex gap-2 flex-wrap">
            {(["threshold", "device", "system", "maintenance"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest border cursor-pointer transition-all"
                style={{
                  color: category === c ? "#0f172a" : "oklch(0.55 0.04 145)",
                  background: category === c ? "oklch(0.55 0.04 145)" : "transparent",
                  borderColor: "oklch(0.25 0.04 145)",
                }}
              >
                {CATEGORY_CONFIG[c].label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground">TITLE</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. System Maintenance Scheduled"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-muted-foreground">MESSAGE</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Notification details..."
            rows={3}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm tracking-wider focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <Button
          onClick={handleSend}
          className="cursor-pointer w-full tracking-widest font-bold"
          disabled={!title.trim() || !message.trim()}
        >
          SEND TO ALL USERS
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationsContent() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Notification Center</h2>
        <p className="text-xs text-muted-foreground tracking-wider">
          Manage alerts, configure preferences, and broadcast notifications
        </p>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="notifications" className="cursor-pointer text-xs tracking-widest font-bold gap-1">
            <Bell className="w-3.5 h-3.5" /> NOTIFICATIONS
          </TabsTrigger>
          <TabsTrigger value="preferences" className="cursor-pointer text-xs tracking-widest font-bold gap-1">
            <Settings2 className="w-3.5 h-3.5" /> PREFERENCES
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="cursor-pointer text-xs tracking-widest font-bold gap-1">
            <Radio className="w-3.5 h-3.5" /> BROADCAST
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsList />
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <PreferencesPanel />
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          <BroadcastPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <>
      <AuthLoading>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </AuthLoading>
      <Authenticated>
        <NotificationsContent />
      </Authenticated>
    </>
  );
}
