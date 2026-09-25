import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCheck, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Authenticated } from "convex/react";

type NotificationLevel = "critical" | "warning" | "info";

const LEVEL_ICON: Record<NotificationLevel, React.FC<{ className?: string }>> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  critical: "#ef4444",
  warning: "#eab308",
  info: "#06b6d4",
};

function NotificationBellInner() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = useQuery(api.notifications.unreadCount);
  const notifications = useQuery(api.notifications.list, { limit: 8 });
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const count = unreadCount ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
        title="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {count > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
            style={{ background: "#ef4444", fontSize: "9px", color: "white", fontWeight: 700 }}
          >
            {count > 99 ? "99+" : count}
          </motion.div>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-primary">NOTIFICATIONS</span>
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "#ef444422", color: "#ef4444" }}
                  >
                    {count} NEW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-primary"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notification items */}
            <div className="max-h-80 overflow-y-auto">
              {notifications === undefined ? (
                <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground tracking-wider">No notifications</p>
                </div>
              ) : (
                notifications.slice(0, 8).map((n) => {
                  const Icon = LEVEL_ICON[n.level];
                  const color = LEVEL_COLOR[n.level];
                  return (
                    <div
                      key={n._id}
                      className="px-4 py-3 border-b border-border/50 last:border-0 hover:bg-accent/30 cursor-pointer transition-colors relative"
                      onClick={() => {
                        if (!n.read) {
                          markAsRead({ notificationId: n._id });
                        }
                        setOpen(false);
                        navigate("/notifications");
                      }}
                    >
                      {!n.read && (
                        <div
                          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                          style={{ background: color }}
                        />
                      )}
                      <div className="flex items-start gap-2.5 pl-2">
                        <span style={{ color }}><Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" /></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold tracking-widest truncate" style={{ color: n.read ? undefined : color }}>
                            {n.title}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{n.message}</p>
                          <div className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border">
              <button
                onClick={() => { setOpen(false); navigate("/notifications"); }}
                className="w-full text-center text-[10px] font-bold tracking-widest text-primary hover:underline cursor-pointer py-1"
              >
                VIEW ALL NOTIFICATIONS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NotificationBell() {
  return (
    <Authenticated>
      <NotificationBellInner />
    </Authenticated>
  );
}
