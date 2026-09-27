import { AuthConfig } from "convex/server";

const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0ClientId = process.env.AUTH0_CLIENT_ID;

export default {
  // Keep guest/local development usable before an Auth0 tenant is configured.
  providers:
    auth0Domain && auth0ClientId
      ? [{ domain: auth0Domain, applicationID: auth0ClientId }]
      : [],
} satisfies AuthConfig;
