import { AuthConfig } from "convex/server";

/** Auth0 issues SPA ID tokens for its HTTPS issuer and the SPA client ID. */
export function auth0Issuer(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const issuer = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (
      issuer.protocol !== "https:" ||
      !issuer.hostname ||
      issuer.port ||
      issuer.username ||
      issuer.password ||
      issuer.search ||
      issuer.hash ||
      (issuer.pathname !== "/" && issuer.pathname !== "")
    )
      return null;
    return `${issuer.origin}/`;
  } catch {
    return null;
  }
}

const issuer = auth0Issuer(process.env.AUTH0_DOMAIN);
const clientId = process.env.AUTH0_CLIENT_ID?.trim();

export default {
  // Missing/invalid configuration grants no authenticated access. Local demo
  // stays available; real data requires an authenticated registered user.
  providers:
    issuer && clientId ? [{ domain: issuer, applicationID: clientId }] : [],
} satisfies AuthConfig;
