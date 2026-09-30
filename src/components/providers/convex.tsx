import { ConvexProviderWithAuth0 } from "convex/react-auth0";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useMemo } from "react";
import { auth0Configured } from "@/lib/auth-config.ts";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "http://localhost:3000";
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
  if (auth0Configured) {
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
