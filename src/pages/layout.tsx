import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, Bell, Cpu, History, LayoutDashboard, MapPin, Brain, Shield, SlidersHorizontal, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { useProcessMode } from "@/hooks/use-process-mode";
import { workspacePath } from "@/lib/workspace";
import { SignInButton } from "@/components/ui/signin";
import LiveAccessState from "@/components/live-access-state";
import { Spinner } from "@/components/ui/spinner";

const navigation = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/historical", label: "Trends", icon: History },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/devices", label: "Devices", icon: Cpu },
  { to: "/remote-monitoring", label: "Sites", icon: MapPin },
  { to: "/ai-decision", label: "Ethm", icon: Brain },
];

export default function AppLayout({ workspace }: { workspace: "live" | "demo" }) {
  const { pathname } = useLocation();
  const { isConfigured } = useAuth();
  const { isAdmin, canControl } = useUserRole();
  const { dataMode, setDataMode } = useProcessMode();
  const expectedMode = workspace === "live" ? "hardware" : "demo";
  const ready = dataMode === expectedMode;
  useEffect(() => { if (!ready) setDataMode(expectedMode); }, [ready, expectedMode, setDataMode]);
  const target = (path: string) => workspacePath(path, pathname);
  return <div className="min-h-screen bg-background text-foreground">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
    <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col bg-[#0B2039] text-white lg:flex">
      <Link to="/" className="flex items-center gap-3 px-5 py-7" aria-label="DWMS home"><img src="/brand/mark.svg" alt="" className="h-11 w-11" /><span><span className="block text-xl font-semibold tracking-tight">DWMS</span><span className="block text-xs text-slate-300">Water Intelligence</span></span></Link>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-3">
        {navigation.map(item => <NavLink key={item.to} to={target(item.to)} end={item.to === "/dashboard"} className={({ isActive }) => cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", isActive ? "bg-[#087EA4] text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white")}><item.icon className="h-5 w-5" aria-hidden="true" />{item.label}</NavLink>)}
        {workspace === "live" && <NavLink to={target("/activity-log")} className={({isActive}) => cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm", isActive ? "bg-[#087EA4] text-white" : "text-slate-300 hover:bg-white/10")}><History className="h-5 w-5" />Events</NavLink>}
        <Link to={target("/dashboard#process")} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-slate-300 hover:bg-white/10"><Activity className="h-5 w-5" />Process</Link>
        {workspace === "live" && canControl && <div className="space-y-1 border-t border-white/10 pt-4 mt-4">
          <Link to={target("/data-source")} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-300 hover:bg-white/10"><Settings2 className="h-4 w-4" />Connection</Link>
          <Link to={target("/thresholds")} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-300 hover:bg-white/10"><SlidersHorizontal className="h-4 w-4" />Safety rules</Link>
          {isAdmin && <Link to={target("/admin")} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-300 hover:bg-white/10"><Shield className="h-4 w-4" />Access</Link>}
        </div>}
      </nav>
      <div className="relative overflow-hidden px-5 pb-16 pt-5 text-sm text-slate-300"><span className="relative z-10">Monitor. Detect. Respond.<br /><span className="text-xs text-slate-400">IoThon 2026 prototype</span></span><img src="/brand/waves.svg" alt="" className="absolute inset-x-0 bottom-0 h-14 w-full" /></div>
    </aside>
    <div className="lg:pl-56">
      <header className="relative sticky top-0 z-20 overflow-hidden bg-[#0B2039] px-4 pb-7 pt-4 text-white md:px-8">
        <div className="relative z-10 flex min-h-12 flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3" aria-label="DWMS home"><img src="/brand/mark.svg" alt="" className="h-9 w-9 lg:hidden" /><span><span className="block text-lg font-semibold tracking-tight lg:hidden">DWMS</span><span className="block text-xs text-slate-300 lg:text-sm">Water Intelligence <span className="hidden sm:inline">· Monitor. Detect. Respond.</span></span></span></Link>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3"><span className={cn("rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm", workspace === "demo" ? "border-cyan-200/30 bg-cyan-50/10 text-cyan-50" : "border-white/20 text-slate-200")}>{workspace === "demo" ? "Simulation mode" : "Live workspace"}</span>
            <Link to={workspace === "demo" ? "/live" : "/demo"} className="inline-flex min-h-10 items-center rounded-lg border border-white/20 px-3 text-xs font-medium hover:bg-white/10 sm:text-sm">{workspace === "demo" ? "Launch Live" : "Explore Demo"}</Link>
            {workspace === "live" && isConfigured && <SignInButton variant="outline" className="min-h-10 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" />}
          </div>
        </div>
        <img src="/brand/waves.svg" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 h-5 w-full" />
      </header>
      <main id="main-content" className="min-w-0 pb-24 lg:pb-8">{!ready ? <div role="status" className="flex items-center gap-3 p-8"><Spinner />Opening workspace…</div> : workspace === "live" ? <LiveAccessState><Outlet /></LiveAccessState> : <Outlet />}</main>
      <nav aria-label="Additional navigation" className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 pb-28 text-sm text-muted-foreground lg:hidden"><Link to={target("/remote-monitoring")} className="py-2">Sites</Link><Link to={target("/ai-decision")} className="py-2">Ethm</Link><Link to={target("/dashboard#process")} className="py-2">Process</Link></nav>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_#0B203908] lg:hidden">{navigation.slice(0,4).map(item => <NavLink key={item.to} to={target(item.to)} end={item.to === "/dashboard"} className={({isActive})=>cn("flex min-h-[68px] flex-col items-center justify-center gap-1 text-xs font-medium",isActive ? "bg-[#EAF5FA] text-primary" : "text-muted-foreground")}><item.icon className="h-5 w-5" aria-hidden="true" />{item.label}</NavLink>)}</nav>
    </div>
  </div>;
}
