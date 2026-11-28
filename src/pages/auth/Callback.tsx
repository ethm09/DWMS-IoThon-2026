import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { accountSyncErrorMessage } from "@/lib/auth-errors";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, isConfigured, signinRedirect } =
    useAuth();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } =
    useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncStarted = useRef(false);

  useEffect(() => {
    if (!isConfigured) {
      setSyncError(
        "Sign-in is unavailable on this installation. You can open the public demo.",
      );
      return;
    }
    if (error) {
      setSyncError("Sign-in could not be completed. Please try again or contact the platform administrator.");
      return;
    }
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate("/", { replace: true });
      return;
    }
    if (isConvexLoading || !isConvexAuthenticated || syncStarted.current)
      return;

    syncStarted.current = true;
    void updateCurrentUser()
      .then(() => navigate("/live", { replace: true }))
      .catch((failure: unknown) => {
        syncStarted.current = false;
        setSyncError(accountSyncErrorMessage(failure));
      });
  }, [
    error,
    isAuthenticated,
    isConfigured,
    isConvexAuthenticated,
    isConvexLoading,
    isLoading,
    navigate,
    updateCurrentUser,
  ]);

  useEffect(() => {
    if (!isConfigured || isLoading || !isAuthenticated || error || syncError) return;
    const timeout = window.setTimeout(() => {
      setSyncError(
        "Your session could not connect to the monitoring service. Sign in again or open the public demo.",
      );
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [isConfigured, isLoading, isAuthenticated, error, syncError]);

  if (syncError) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-md">{syncError}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate("/", { replace: true })}
          >
            Return home
          </Button>
          {isConfigured && (
            <Button
              onClick={() => {
                setSyncError(null);
                syncStarted.current = false;
                void signinRedirect().catch(() =>
                  setSyncError("Sign-in could not start. Please try again."),
                );
              }}
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
