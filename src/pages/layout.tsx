import { Link, NavLink, Outlet } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import {
  Activity,
  Bell,
  Cpu,
  History,
  LayoutDashboard,
  MapPin,
  Settings2,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { SignInButton } from "@/components/ui/signin.tsx";
import { RegisteredUserGate } from "@/components/registered-user-gate";
import { Button } from "@/components/ui/button";

const navigation = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/historical", label: "Trends", icon: History },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/devices", label: "Devices", icon: Cpu },
  { to: "/remote-monitoring", label: "Sites", icon: MapPin },
];

export default function AppLayout() {
  const { isAuthenticated } = useConvexAuth();
  const { isConfigured } = useAuth();
  const { isAdmin, canControl } = useUserRole();
  const { dataMode, setDataMode } = useProcessMode();
  const isSimulation = !isAuthenticated || dataMode === "demo";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-sidebar md:flex">
        <Link
          to="/"
          className="flex items-center gap-3 border-b border-sidebar-border px-5 py-6"
          aria-label="DWMS home"
        >
          <img
            src="/brand/mark.svg"
            alt=""
            className="h-10 w-10 object-contain"
          />
          <span>
            <span className="block text-lg font-semibold tracking-tight text-sidebar-foreground">
              DWMS
            </span>
            <span className="block text-sm text-slate-300">
              Water Intelligence
            </span>
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 px-3 py-6"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-sidebar-accent hover:text-white",
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/dashboard#process"
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-300 hover:bg-sidebar-accent"
          >
            <Activity className="h-5 w-5" aria-hidden="true" />
            Process
          </Link>
          {isAuthenticated && !isSimulation && canControl && (
            <details className="pt-5 text-sm text-slate-300">
              <summary className="cursor-pointer rounded-lg px-3 py-3">
                Operator tools
              </summary>
              <NavLink
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-sidebar-accent"
                to="/data-source"
              >
                <Settings2 className="h-4 w-4" />
                Data source
              </NavLink>
              <NavLink
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-sidebar-accent"
                to="/thresholds"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Safety rules
              </NavLink>
              {isAdmin && (
                <NavLink
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-sidebar-accent"
                  to="/admin"
                >
                  <Shield className="h-4 w-4" />
                  Access
                </NavLink>
              )}
            </details>
          )}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-5 text-sm text-slate-300">
          DWMS prototype
          <br />
          <span className="text-sidebar-primary">IoThon 2026</span>
        </div>
      </aside>
      <div className="md:pl-56">
        <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-4  md:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold md:hidden"
            aria-label="DWMS home"
          >
            <img src="/brand/mark.svg" alt="" className="h-8 w-8" />
            DWMS
          </Link>
          <div className="hidden text-sm text-muted-foreground md:block">
            <span className="font-medium text-foreground">
              Water Intelligence
            </span>{" "}
            · Monitor. Detect. Respond.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              title={
                isSimulation
                  ? "Fixed sample values; no hardware actions"
                  : "Readings received from configured devices"
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
                isSimulation
                  ? "border-[#D7E9F2] bg-[#EAF4F9] text-[#8A5A00]"
                  : "border-primary/25 bg-primary/10 text-primary",
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                aria-hidden="true"
              />
              {isSimulation ? "Simulation mode" : "Device data"}
            </span>
            {isAuthenticated && (
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={() => setDataMode(isSimulation ? "hardware" : "demo")}
              >
                {isSimulation ? "View device data" : "Use simulation"}
              </Button>
            )}
            {isConfigured && (
              <SignInButton variant="outline" className="min-h-11" />
            )}
          </div>
        </header>
        <main id="main-content" className="min-w-0 pb-24 md:pb-8">
          {isAuthenticated ? <RegisteredUserGate><Outlet /></RegisteredUserGate> : <Outlet />}
        </main>
        <nav
          aria-label="Additional navigation"
          className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 pb-28 text-sm text-muted-foreground md:hidden"
        >
          <Link to="/remote-monitoring" className="py-2">
            Sites
          </Link>
          <Link to="/dashboard#process" className="py-2">
            Process
          </Link>
          <Link to="/" className="py-2">
            About DWMS
          </Link>
        </nav>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]  md:hidden"
      >
        {navigation.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium",
                isActive ? "text-primary" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
