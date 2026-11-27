# Setup: Live, Demo, Hardware and Ethm

## Demo

Use Node.js 24 and pnpm 10: `pnpm install --frozen-lockfile`, then `pnpm dev`. Canonical workspaces are **`/demo`** for synthetic browser scenarios and **`/live`** for operational access. The [public Demo](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/demo) needs no account or probes and never controls hardware. Demo does not initialize Auth0; the hardware subscription bridge runs only in Live. Follow [DEMO.md](DEMO.md).

## Existing infrastructure and public configuration

Reuse the existing deployment/SPA. Copy `.env.example` to `.env.local`; no replacement service is needed.

| Frontend public value | Existing backend counterpart |
|---|---|
| `VITE_CONVEX_URL=https://canny-mosquito-637.convex.cloud` | Existing Convex deployment |
| `VITE_CONVEX_SITE_URL=https://canny-mosquito-637.convex.site` | Its HTTP actions |
| `VITE_AUTH0_DOMAIN=dev-i3qysqy0xf3uqtvv.us.auth0.com` | Issuer `https://dev-i3qysqy0xf3uqtvv.us.auth0.com/` |
| `VITE_AUTH0_CLIENT_ID=Z8rnHb9dVeG1YH3nqlfeuZ1ZT2Yfd4Bx` | Confirmed directly against existing `AUTH0_CLIENT_ID` |
| `VITE_DWMS_LIVE_ENABLED=false` | Keep disabled until the Auth0 callback/login rehearsal succeeds |

Preserve existing server-only `DWMS_INITIAL_ADMIN_EMAIL` and `OPENAI_API_KEY`; never put keys/deployment credentials in frontend variables, chat or recordings. Public URLs/domain/client ID are not private credentials. Static values require a frontend rebuild. The public configuration can be present while Live remains explicitly gated.

New and legacy viewers without an explicit fleet grant cannot read operational data. An administrator grants/revokes viewer fleet-read access or assigns operator/admin roles. A granted viewer cannot actuate. Approved users share the prototype fleet; there is no per-site tenant model. Chat, notification and run histories remain user-owned. Tokens are cached in memory and legacy operational buffers are volatile per tab, not browser localStorage.

## Auth0 application settings and authorization blocker

These exact entries are required on the **existing SPA**, retaining working origins:

| Setting | Required values |
|---|---|
| Allowed Callback URLs | `http://localhost:5173/auth/callback` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/auth/callback` |
| Allowed Logout URLs | `http://localhost:5173` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site` |
| Allowed Web Origins | `http://localhost:5173` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site` |

Callbacks include `/auth/callback`; logout/origin entries do not. Add the exact origin if the port/host changes. This integration uses the SPA ID token for Convex, not a client secret or custom API audience.

**Observed:** the Site callback still returns **Callback URL mismatch**. Auth0 CLI 1.40.0 default and additional-scope device attempts failed with “User is not authorized” / `ActivationDenied`. The CLI uses its own first-party/global authorization client; those failures do not establish a defect in the DWMS SPA grant. Tenant/account-policy cause is unknown without authorized logs.

**Account configuration fallback:** automated authenticated browser access is unavailable in this execution environment. Open [Auth0 management](https://manage.auth0.com/), select tenant `dev-i3qysqy0xf3uqtvv`, then **Applications → Applications → the existing SPA with client ID `Z8rnHb9dVeG1YH3nqlfeuZ1ZT2Yfd4Bx` → Settings → Application URIs**. Add the published callback, logout URL and web origin from the table above, preserve every existing authorized entry, and choose **Save Changes**. These are public values; no client secret is needed. Do not create another application or repeat the denied CLI device flow.

After correction, a secure authenticated browser session is still required to test registration/login, reload/session restoration, logout and fleet/role boundaries before setting `VITE_DWMS_LIVE_ENABLED=true` and rebuilding. A configured tenant/client ID or a successful authorization-page load does not prove these flows. A securely bound existing Auth0 Management API grant is an alternative for settings/log inspection, not a substitute for end-user acceptance. Do not send private credentials through chat.

## Backend, Hardware and Ethm

Current backend source `b167a1e` was deployed to the existing Convex backend. Seven anonymous probes—five real-data reads, pump command and agent run—were denied `UNAUTHENTICATED`; see [production checks](screenshots/production-release-checks.json). Future deployment must retain the same existing target and checks.

Use [HARDWARE.md](HARDWARE.md), the canonical recovery/calibration/commissioning guide. The owner-reported earlier prototype is unavailable; preserve its firmware/wiring before changes. The disabled repository template is not recovered historical firmware. Keep backend, bridge and firmware protocol versions coordinated.

Ethm is read-only and needs approved authenticated device evidence plus an available model service. The actual backend provider check returned HTTP 429 with `credit_balance_exhausted`; Ethm remains unavailable until the provider account has usable API credit. At [OpenAI organization billing](https://platform.openai.com/settings/organization/billing/overview), select the existing organization used by the backend key. The owner approved a **one-time US$5 API credit purchase, automatic recharge disabled**. No purchase has been made by this release process. Stop if checkout requires more than US$5 or an outstanding-balance payment; that needs separate approval. Do not create a replacement organization or put a key in chat/frontend code. After credit is available, run the real backend provider diagnostic and an authorized contextual conversation; a test double is not a model response. Deterministic monitoring/control remains separate.

## Credential review

The public SPA ID was confirmed against the existing Convex environment and original Vercel bundle. Backend keys were neither copied into the frontend nor committed. A limited OpenAI/private-key pattern scan of 515 historical text versions/archive entries found no matches; this is not proof that every secret type is absent. No specific credential rotation was triggered by that check. Replace any device key known to have been shared before reconnection, using the existing admin device workflow. The provider credit error requires usable account credit, not an invented replacement key.
