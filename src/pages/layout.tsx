import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, BarChart3, Info, Droplets, Activity, Bell, Brain, Wrench, FileText, Cpu, Radio, History, Shield, LogOut, Menu, X, SlidersHorizontal, ScrollText, BellRing, Settings2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { SignInButton } from "@/components/ui/signin.tsx";
import PwaInstallBanner from "@/components/pwa-install-banner.tsx";
import NotificationBell from "@/components/notification-bell.tsx";
import { useNotificationBridge } from "@/hooks/use-notification-bridge.ts";
import EthmAssistant from "@/components/ethm-assistant.tsx";
import EthmPopups from "@/components/ethm-popups.tsx";

const ROLE_COLORS = {
  admin: { color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" },
  operator: { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" },
  viewer: { color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/30" },
};

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, minRole: "viewer" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, minRole: "viewer" },
  { to: "/simulation", label: "Simulation", icon: Activity, minRole: "operator" },
  { to: "/alerts", label: "Alerts", icon: Bell, minRole: "viewer" },
  { to: "/ai-decision", label: "AI Engine", icon: Brain, minRole: "operator" },
  { to: "/maintenance", label: "Health", icon: Wrench, minRole: "viewer" },
  { to: "/reports", label: "Reports", icon: FileText, minRole: "viewer" },
  { to: "/thresholds", label: "Thresholds", icon: SlidersHorizontal, minRole: "viewer" },
  { to: "/activity-log", label: "Activity Log", icon: ScrollText, minRole: "operator" },
  { to: "/notifications", label: "Notifications", icon: BellRing, minRole: "viewer" },
  { to: "/digital-twin", label: "Digital Twin", icon: Cpu, minRole: "viewer" },
  { to: "/remote-monitoring", label: "Remote", icon: Radio, minRole: "viewer" },
  { to: "/historical", label: "History", icon: History, minRole: "viewer" },
  { to: "/devices", label: "Sensors", icon: Cpu, minRole: "operator" },
  { to: "/data-source", label: "Data Source", icon: Settings2, minRole: "operator" },
  { to: "/admin", label: "Access", icon: Shield, minRole: "admin" },
  { to: "/about", label: "About", icon: Info, minRole: "viewer" },
];

function isAccessible(minRole: string, role?: string) {
  // undefined = loading, show viewer items while loading
  if (!role) return minRole === "viewer";
  const order = ["viewer", "operator", "admin"];
  return order.indexOf(role) >= order.indexOf(minRole);
}

function UserBadge() {
  const { user: authUser, removeUser } = useAuth();
  const { user, role } = useUserRole();
  const cfg = role ? ROLE_COLORS[role] : ROLE_COLORS.viewer;

  return (
    <div className="p-3 border-t border-border space-y-2">
      {user && (
        <div className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">
              {(user.name ?? user.email ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-foreground truncate">{user.name ?? "User"}</div>
            <div className={cn("text-[8px] font-bold tracking-widest rounded px-1.5 py-0.5 inline-block mt-0.5", cfg.color, cfg.bg, `border ${cfg.border}`)}>
              {role?.toUpperCase() ?? "—"}
            </div>
          </div>
          <button
            onClick={() => removeUser()}
            className="p-1 rounded hover:bg-accent transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <motion.div
        className="mx-auto w-16 h-0.5 rounded-full bg-primary"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
}

// Primary mobile tabs — the 4 most important + "More"
const MOBILE_TABS = ["/", "/simulation", "/alerts", "/historical"];

function MobileDrawer({ items, open, onClose }: { items: typeof navItems; open: boolean; onClose: () => void }) {
  const { user: authUser, removeUser } = useAuth();
  const { user, role } = useUserRole();
  const cfg = role ? ROLE_COLORS[role] : ROLE_COLORS.viewer;
  const location = useLocation();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-72 bg-background border-r border-border z-50 flex flex-col md:hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-bold tracking-[0.2em] text-primary leading-none">LDWMS</div>
                  <div className="text-[9px] tracking-wider text-muted-foreground mt-0.5">DEFENSE WATER MONITORING</div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent cursor-pointer text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {items.map((item) => {
                const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold tracking-wider transition-all cursor-pointer",
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label.toUpperCase()}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </NavLink>
                );
              })}
            </nav>

            {/* User badge */}
            <Authenticated>
              <div className="p-3 border-t border-border">
                {user && (
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">{user.name ?? "User"}</div>
                      <div className={cn("text-[9px] font-bold tracking-widest rounded px-1.5 py-0.5 inline-block mt-0.5", cfg.color, cfg.bg, `border ${cfg.border}`)}>
                        {role?.toUpperCase() ?? "—"}
                      </div>
                    </div>
                    <button
                      onClick={() => { void removeUser(); onClose(); }}
                      className="p-1.5 rounded hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground"
                      title="Sign out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </Authenticated>
            <Unauthenticated>
              <div className="p-4 border-t border-border flex flex-col items-center gap-2">
                <div className="text-[9px] text-muted-foreground tracking-widest">NOT SIGNED IN</div>
                <SignInButton />
              </div>
            </Unauthenticated>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function AppLayout() {
  const { role, isGuest } = useUserRole();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Bridge process-mode safety events to persistent notifications
  useNotificationBridge();

  // Guests see viewer-level nav; undefined = still loading (show viewer items too)
  const effectiveRole = isGuest ? "viewer" : role;
  const visibleItems = navItems.filter(item => isAccessible(item.minRole, effectiveRole));
  const mobileTabItems = visibleItems.filter(item => MOBILE_TABS.includes(item.to));

  // Check if current page is in the "More" menu (not a primary tab)
  const isMoreActive = !MOBILE_TABS.includes(location.pathname) && location.pathname !== "/";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <PwaInstallBanner />

      {/* Mobile drawer */}
      <MobileDrawer items={visibleItems} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-primary leading-none">LDWMS</div>
              <div className="text-[9px] tracking-wider text-muted-foreground leading-none mt-0.5">DEFENSE WATER MONITORING</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wider transition-all cursor-pointer",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label.toUpperCase()}</span>
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom — user badge or sign in */}
        <Authenticated>
          <UserBadge />
        </Authenticated>
        <Unauthenticated>
          <div className="p-4 border-t border-border flex flex-col items-center gap-2">
            <div className="text-[9px] text-cyan-400 tracking-widest font-bold border border-cyan-400/30 bg-cyan-400/10 rounded px-2 py-0.5">GUEST VIEW</div>
            <div className="text-[8px] text-muted-foreground text-center">Read-only access. Sign in for full control.</div>
            <SignInButton />
          </div>
        </Unauthenticated>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden ml-14 md:ml-0">
        {/* Top bar */}
        <header className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-xs font-bold tracking-[0.15em] text-primary">LDWMS</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono text-muted-foreground tracking-wider hidden md:block">
              DEFENSE WATER MONITORING SYSTEM
            </div>
            <NotificationBell />
            <Unauthenticated>
              <SignInButton />
            </Unauthenticated>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Ethm AI — global safety pop-ups + floating chat assistant */}
      <EthmPopups />
      <EthmAssistant />

      {/* Mobile left nav — slim icon sidebar */}
      <nav className="fixed left-0 top-0 bottom-0 w-14 flex flex-col items-center border-r border-border bg-background/95 backdrop-blur-lg md:hidden z-[9999] py-3 gap-1">
        {/* Logo */}
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center mb-3 shrink-0">
          <Droplets className="w-5 h-5 text-primary" />
        </div>

        {/* Tab icons */}
        <div className="flex-1 flex flex-col items-center gap-1 overflow-y-auto">
          {mobileTabItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all relative",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_4px_oklch(0.7_0.15_145)]")} />
                  {isActive && (
                    <motion.div
                      layoutId="mobile-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* More button at bottom */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer transition-all mt-auto shrink-0",
            isMoreActive
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Menu className={cn("w-5 h-5", isMoreActive && "drop-shadow-[0_0_4px_oklch(0.7_0.15_145)]")} />
        </button>
      </nav>
    </div>
  );
}
