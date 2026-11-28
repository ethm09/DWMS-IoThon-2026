import type { ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { useProcessMode } from "@/hooks/use-process-mode";
import { SignInButton } from "@/components/ui/signin";
import { Card, CardContent } from "@/components/ui/card";

/** Keep live entry explicit and mount protected queries only after fleet approval. */
export function LiveAccessState({
  children,
  title = "Live monitoring",
}: {
  children?: ReactNode;
  title?: string;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { isConfigured } = useAuth();
  const { user, isLoadingProfile, canViewFleet } = useUserRole();
  const { setDataMode } = useProcessMode();
  if (isAuthenticated && canViewFleet && children) return <>{children}</>;
  const pending = isLoading || isLoadingProfile;
  const message = pending
    ? "Checking access. No device values are loaded."
    : !isConfigured
      ? "Live sign-in is temporarily unavailable. No device values are loaded."
      : !isAuthenticated
        ? "Sign in to inspect device records. No device values are loaded."
        : !user
          ? "Your monitoring profile is not ready. Complete account setup before loading records."
          : "Your account is awaiting fleet approval. An administrator must grant access before any records are loaded.";
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">Live workspace</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No live data available</h2>
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
          <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Connection</dt>
              <dd className="mt-1 font-medium">Offline in this session</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Last valid reading
              </dt>
              <dd className="mt-1 font-medium">Unavailable</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {["pH", "TDS", "Turbidity", "Flow"].map((label) => (
          <Card key={label}>
            <CardContent className="space-y-2 py-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-mono text-3xl">—</p>
              <p className="text-sm text-muted-foreground">{label === "Flow" ? "Interface unverified" : "Unknown"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {!isAuthenticated && isConfigured && <SignInButton />}
        {isAuthenticated && !user && !pending && <Link to="/auth/callback" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">Complete account setup</Link>}
        <Link
          to="/demo"
          onClick={() => setDataMode("demo")}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-primary"
        >
          Open the demo
        </Link>
      </div>
    </div>
  );
}
export default LiveAccessState;
