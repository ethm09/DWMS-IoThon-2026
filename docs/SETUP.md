# Setup: Live, Demo, Hardware and Ethm

## Demo

Use Node.js 24 and pnpm 10: `pnpm install --frozen-lockfile`, then `pnpm dev`. Open `/dashboard` in Simulation mode. The [public Demo](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site) needs no account or probes and never controls physical output. Follow [DEMO.md](DEMO.md).

## Live and Ethm: reuse existing infrastructure

Copy `.env.example` to `.env.local` and use the existing deployment/SPA; do not create replacement services.

| Frontend public value | Existing backend counterpart |
|---|---|
| `VITE_CONVEX_URL=https://canny-mosquito-637.convex.cloud` | Existing Convex deployment |
| `VITE_CONVEX_SITE_URL=https://canny-mosquito-637.convex.site` | Its HTTP actions |
| `VITE_AUTH0_DOMAIN=dev-i3qysqy0xf3uqtvv.us.auth0.com` | Existing `AUTH0_DOMAIN`; canonical issuer `https://dev-i3qysqy0xf3uqtvv.us.auth0.com/` |
| `VITE_AUTH0_CLIENT_ID=Z8rnHb9dVeG1YH3nqlfeuZ1ZT2Yfd4Bx` | Recovered public SPA ID; match existing `AUTH0_CLIENT_ID`; owner confirmation pending |

Preserve the existing verified `DWMS_INITIAL_ADMIN_EMAIL` and server-only `OPENAI_API_KEY`. New users start as viewers; an administrator registers devices and operators control existing devices. The owner reports that the OpenAI key is already configured; this does not verify a successful Ethm request. Ethm is read-only and needs authenticated device evidence plus an available model service. No client secret or custom API audience is used by this SPA ID-token integration. Never put server keys/deployment credentials in frontend variables or recordings.

## Auth0 application settings

Add/verify these exact entries in the **existing Single Page Application**, retaining its working origins:

| Setting | Values |
|---|---|
| Allowed Callback URLs | `http://localhost:5173/auth/callback` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/auth/callback` |
| Allowed Logout URLs | `http://localhost:5173` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site` |
| Allowed Web Origins | `http://localhost:5173` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site` |

Callbacks include `/auth/callback`; logout/origin entries do not. Add the actual origin if the port/host changes. Tokens are cached in memory; refresh, sign-in restoration and logout need an actual provider/browser rehearsal. Confirm signup is enabled if registration is intended.

**Observed external gates, 2026-11-26:** the existing SPA authorization request for the new Site returned **Callback URL mismatch**. The ID above was recovered from the original Vercel bundle, not generated; no account/credential was created. This workspace also lacks an authorized Convex deployment session. A read-only live check found the older production registry query accepted an anonymous request (zero records). Current protected source/tests are not a deployed-security claim.

## Hardware

Use [HARDWARE.md](HARDWARE.md), the single reconnection/intake/calibration/commissioning guide. The owner-reported earlier prototype is currently unavailable. Preserve its running firmware/wiring before changes; the disabled repository template is not its recovered firmware. Compilation is not upload or physical validation.

## Publish the connected revision

Run the checks in [VALIDATION.md](VALIDATION.md). From an authorized terminal, use `pnpm exec convex deploy` and verify that its selected target is the existing `canny-mosquito-637` production deployment. Complete the Auth0 settings, then rehearse registration/login, reload/logout, roles and real Ethm evidence. Keep backend, bridge and firmware protocol versions coordinated.

Only after those gates pass, rebuild/publish the frontend with all four public values above. Static variables require a rebuild; runtime edits do not change a bundle. The current public Sites guest build deliberately omits Auth0 values and remains Demo-only while Live/Ethm gates are blocked. `.openai/hosting.json` and SPA redirects support that hosting; the retained Vercel preview requires SSO and is not the judges' public link.
