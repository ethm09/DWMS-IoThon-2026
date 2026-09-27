import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useCallback, useMemo, type ReactNode } from "react";
import { AuthContext, unconfiguredAuthState } from "@/hooks/use-auth.ts";
import {
  auth0ClientId,
  auth0Configured,
  auth0Domain,
} from "@/lib/auth-config.ts";

function Auth0SessionBridge({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, error, loginWithRedirect, logout } =
    useAuth0();

  const signinRedirect = useCallback(async () => {
    await loginWithRedirect();
  }, [loginWithRedirect]);

  const removeUser = useCallback(async () => {
    await logout({ logoutParams: { returnTo: window.location.origin } });
  }, [logout]);

  const authState = useMemo(
    () => ({
      user: user
        ? {
            profile: {
              name: user.name ?? user.nickname,
              email: user.email,
            },
          }
        : null,
      isAuthenticated,
      isLoading,
      error: error ?? null,
      isConfigured: true,
      signinRedirect,
      removeUser,
    }),
    [user, isAuthenticated, isLoading, error, signinRedirect, removeUser],
  );

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!auth0Configured) {
    return (
      <AuthContext.Provider value={unconfiguredAuthState}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/auth/callback`,
        scope: "openid profile email",
        prompt: "select_account",
      }}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      <Auth0SessionBridge>{children}</Auth0SessionBridge>
    </Auth0Provider>
  );
}
