/** Auth0 React expects the tenant/custom hostname, not an issuer URL. */
function auth0Hostname(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return "";
  try {
    const domain = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (
      domain.protocol !== "https:" ||
      !domain.hostname ||
      domain.port ||
      domain.username ||
      domain.password ||
      domain.search ||
      domain.hash ||
      (domain.pathname !== "/" && domain.pathname !== "")
    )
      return "";
    return domain.hostname;
  } catch {
    return "";
  }
}

export const auth0Domain = auth0Hostname(import.meta.env.VITE_AUTH0_DOMAIN);
export const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim() ?? "";
export const auth0Configured = Boolean(auth0Domain && auth0ClientId);
