import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

type Role = "admin" | "operator" | "viewer";

export function useUserRole() {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  // user === undefined → still loading; user === null → guest (not signed in)
  const role = user?.role as Role | undefined;

  return {
    user: user ?? null,
    role,
    isGuest: !isAuthenticated || user === null,
    isLoadingProfile: isAuthenticated && user === undefined,
    canViewFleet:
      user?.role === "admin" ||
      user?.role === "operator" ||
      user?.fleetAccess === true,
    isAdmin: user?.role === "admin",
    isOperator: user?.role === "operator",
    isViewer: user?.role === "viewer",
    canControl: user?.role === "admin" || user?.role === "operator",
    hasRole: (roles: Role[]) =>
      user ? roles.includes(user.role as Role) : false,
  };
}
