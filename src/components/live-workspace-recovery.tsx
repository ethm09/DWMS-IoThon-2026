import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { useProcessMode } from "@/hooks/use-process-mode";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin";
import { QueryErrorBoundary } from "@/components/query-error-boundary";

function LiveRecovery({ retry }: { retry: () => void }) {
  const { setSelectedDeviceId, clearEventLog } = useProcessMode();
  useEffect(() => {
    // Clear volatile display data only. This never deletes history or commands equipment.
    setSelectedDeviceId("");
    clearEventLog();
  }, [setSelectedDeviceId, clearEventLog]);
  return <main className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
    <Link to="/" className="inline-flex items-center gap-3 text-xl font-semibold"><img src="/brand/mark.svg" alt="" className="h-10 w-10" />DWMS</Link>
    <section role="alert" className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">Live view unavailable</h1>
      <p className="text-sm text-muted-foreground">Your connection or account access may have changed. Device values and controls are hidden until access can be checked again.</p>
      <p className="text-sm text-muted-foreground">Physical device state is not confirmed by this view.</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={retry}>Retry live view</Button>
        <SignInButton variant="outline" />
        <Button asChild variant="outline"><Link to="/demo">Open Demo</Link></Button>
      </div>
    </section>
  </main>;
}

function AccessRecovery({ children }: { children: ReactNode }) {
  const { user } = useUserRole();
  const accessKey = `${user?._id ?? "no-profile"}:${user?.role ?? "none"}:${user?.fleetAccess === true}`;
  return <QueryErrorBoundary resetKey={accessKey} fallback={retry => <LiveRecovery retry={retry} />}>{children}</QueryErrorBoundary>;
}

export default function LiveWorkspaceRecovery({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, isAuthenticated, isConfigured } = useAuth();
  if (pathname !== "/live" && !pathname.startsWith("/live/")) return <>{children}</>;
  const sessionKey = `${isConfigured}:${isAuthenticated}:${user?.profile.email ?? "no-account"}:${pathname}`;
  // The outer boundary also catches failure of the current-profile query itself.
  return <QueryErrorBoundary resetKey={sessionKey} fallback={retry => <LiveRecovery retry={retry} />}>
    <AccessRecovery>{children}</AccessRecovery>
  </QueryErrorBoundary>;
}
