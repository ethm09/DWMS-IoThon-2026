export const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN?.trim() ?? "";
export const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim() ?? "";
export const auth0Configured = Boolean(auth0Domain && auth0ClientId);
