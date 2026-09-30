import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useAuth } from "@/hooks/use-auth.ts";

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
        "Auth0 is not configured. Set the VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID environment variables.",
      );
      return;
    }
    if (error) {
      setSyncError(error.message);
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
      .then(() => navigate("/", { replace: true }))
      .catch((syncError: unknown) => {
        syncStarted.current = false;
        setSyncError(
          syncError instanceof Error
            ? syncError.message
            : "Could not sync the signed-in user.",
        );
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
          <Button onClick={() => void signinRedirect()}>Try again</Button>
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
