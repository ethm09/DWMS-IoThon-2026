import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim() || "http://localhost:3000";
const convex = new ConvexReactClient(convexUrl);

function useUnauthenticatedAuth() {
  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: false,
      fetchAccessToken: async () => null,
    }),
    [],
  );
}

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  const { isConfigured } = useAuth();
  if (isConfigured) {
    return (
      <ConvexProviderWithAuth0 client={convex}>
        {children}
      </ConvexProviderWithAuth0>
    );
  }

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useUnauthenticatedAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
