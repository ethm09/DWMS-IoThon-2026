import type { ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import { SignInButton } from "@/components/ui/signin";
import { Spinner } from "@/components/ui/spinner";

/** Do not mount real-data queries until the signed-in profile is registered. */
export function RegisteredUserGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  if (isAuthenticated && user) return <>{children}</>;
  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 p-6 text-sm text-muted-foreground"
      >
        <Spinner />
        Checking your monitoring account…
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-lg font-semibold">
        {isAuthenticated
          ? "Complete your monitoring account"
          : "Sign in to view device records"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {isAuthenticated
          ? "Your session is signed in, but its monitoring profile is not ready. Complete account setup before loading device data."
          : "Real device data and local device activity require a signed-in account. The simulation remains available."}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {isAuthenticated ? (
          <Link
            className="text-sm font-medium text-primary underline underline-offset-4"
            to="/auth/callback"
          >
            Complete account setup
          </Link>
        ) : (
          <SignInButton />
        )}
        <Link
          className="text-sm text-primary underline underline-offset-4"
          to="/dashboard"
        >
          Return to monitoring
        </Link>
      </div>
    </div>
  );
}
