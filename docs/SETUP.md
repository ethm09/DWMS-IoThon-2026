# Setup: Live, Demo, Hardware and Ethm

## Demo

Use Node.js 24 and pnpm 10: `pnpm install --frozen-lockfile`, then `pnpm dev`. Canonical workspaces are **`/demo`** for synthetic browser scenarios and **`/live`** for operational access. The [public Demo](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/demo) needs no account or probes and never controls hardware. Demo does not initialize Auth0; the hardware subscription bridge runs only in Live. Follow [DEMO.md](DEMO.md). Ethm can analyze official simulated scenarios through the isolated guest endpoint; model requests occur only when a question is submitted.

## Existing infrastructure and public configuration

Reuse the existing deployment/SPA. Copy `.env.example` to `.env.local`; no replacement service is needed.

| Frontend public value                                         | Existing backend counterpart                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| `VITE_CONVEX_URL=https://canny-mosquito-637.convex.cloud`     | Existing Convex deployment                                      |
| `VITE_CONVEX_SITE_URL=https://canny-mosquito-637.convex.site` | Its HTTP actions                                                |
| `VITE_AUTH0_DOMAIN=dev-i3qysqy0xf3uqtvv.us.auth0.com`         | Issuer `https://dev-i3qysqy0xf3uqtvv.us.auth0.com/`             |
| `VITE_AUTH0_CLIENT_ID=Z8rnHb9dVeG1YH3nqlfeuZ1ZT2Yfd4Bx`       | Confirmed directly against existing `AUTH0_CLIENT_ID`           |
| `VITE_DWMS_LIVE_ENABLED=false`                                | Keep disabled until the Auth0 callback/login rehearsal succeeds |

Preserve existing server-only `DWMS_INITIAL_ADMIN_EMAIL` and `OPENAI_API_KEY`; never put keys/deployment credentials in frontend variables, chat or recordings. Public URLs/domain/client ID are not private credentials. Static values require a frontend rebuild. The public configuration can be present while Live remains explicitly gated.

New and legacy viewers without an explicit fleet grant cannot read operational data. An administrator grants/revokes viewer fleet-read access or assigns operator/admin roles. A granted viewer cannot actuate. Approved users share the prototype fleet; there is no per-site tenant model. Chat, notification and run histories remain user-owned. Auth0 tokens are cached in memory and legacy operational buffers are volatile per tab, not browser localStorage.

## Auth0 application settings and authorization blocker

These exact entries are required on the **existing SPA**, retaining working origins:

| Setting               | Required values                                                                  |
| --------------------- | -------------------------------------------------------------------------------- |
| Allowed Callback URLs | `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/auth/callback` |
| Allowed Logout URLs   | `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site`               |
| Allowed Web Origins   | `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site`               |

Callbacks include `/auth/callback`; logout/origin entries do not. Local authenticated development requires its own explicitly authorized callback/logout/origin; the current acceptance checks above apply to the published origin only. This integration uses the SPA ID token for Convex, not a client secret or custom API audience.

**Observed on 2026-11-27:** the published callback is now accepted: the real SPA authorization endpoint returned HTTP 200 and displayed the login form. [Check evidence](screenshots/auth0-acceptance-check.json). This clears the previous callback mismatch; it does not verify login, registration, logout, session restoration or the tenant’s saved logout/origin lists. Auth0 CLI 1.40.0 default and additional-scope device attempts failed with “User is not authorized” / `ActivationDenied`. The CLI uses its own first-party/global authorization client; those failures do not establish a defect in the DWMS SPA grant. Tenant/account-policy cause is unknown without authorized logs.

**Account configuration fallback:** automated authenticated browser access is unavailable in this execution environment. Open [Auth0 management](https://manage.auth0.com/), select tenant `dev-i3qysqy0xf3uqtvv`, then **Applications → Applications → the existing SPA with client ID `Z8rnHb9dVeG1YH3nqlfeuZ1ZT2Yfd4Bx` → Settings → Application URIs**. Inspect the published callback, logout URL and web origin against the table above. Add only missing entries, preserve every existing authorized entry, and choose **Save Changes** if changes were necessary. The published callback is already accepted; do not add duplicates. These are public values; no client secret is needed. Do not create another application or repeat the denied CLI device flow.

After correction, a secure authenticated browser session is still required to test registration/login, reload/session restoration, logout and fleet/role boundaries before setting `VITE_DWMS_LIVE_ENABLED=true` and rebuilding. A configured tenant/client ID or a successful authorization-page load does not prove these flows. A securely bound existing Auth0 Management API grant is an alternative for settings/log inspection, not a substitute for end-user acceptance. Do not send private credentials through chat.

## Backend, Hardware and Ethm

Backend source `44afc0b` was deployed to the existing Convex backend. Seven anonymous probes—five real-data reads, pump command and agent run—were denied `UNAUTHENTICATED`; see [production checks](screenshots/production-release-checks.json). Future deployment must retain the same existing target and checks.

Use [HARDWARE.md](HARDWARE.md), the canonical recovery/calibration/commissioning guide. The owner-reported earlier prototype is unavailable; preserve its firmware/wiring before changes. The disabled repository template is not recovered historical firmware. Keep backend, bridge and firmware protocol versions coordinated.

Ethm is read-only. The guest path has verified genuine English critical-condition and Arabic recovery responses, including an actual 390px Arabic question submitted from the published UI. See [genuine conversations](screenshots/genuine-ethm-results.json) and [mobile evidence](screenshots/genuine-ethm-mobile-results.json). All guest evidence is simulated; no production device data or commands are exposed. Live requests separately require an approved Auth0/Convex user and authorized device records; that real authenticated browser acceptance remains blocked by secure-browser tooling. A working guest conversation does not establish Live account acceptance.

No purchase was made by this agent and account balance/automatic recharge were not inspected. Do not purchase additional credit merely because the older diagnostic failed. The prior authorization remains capped at a one-time US$5 with auto-recharge OFF, should billing action actually be required later. Use the [existing organization billing page](https://platform.openai.com/settings/organization/billing/overview); never create a duplicate organization or expose the backend key. Do not substitute a fake model reply. Deterministic monitoring/control is separate.

## Credential review

The public SPA ID was confirmed against the existing Convex environment and original Vercel bundle. Backend keys were neither copied into the frontend nor committed. A limited OpenAI/private-key pattern scan of 515 historical text versions/archive entries found no matches; this is not proof that every secret type is absent. No specific credential rotation was triggered by that check. Replace any device key known to have been shared before reconnection, using the existing admin device workflow. The earlier provider credit error did not justify replacing the key; the latest diagnostic succeeds with the existing integration.

## Guest Ethm isolation and finite allowance

The existing Convex HTTP deployment serves `/demo/ethm/session` and `/demo/ethm/chat`. The same existing backend-only OpenAI key is reused; no new service or key is needed. Only canonical server-owned scenario fixtures and dedicated `demoEthmSessions` / `demoEthmBudgets` tables are available to this path. Guest requests cannot read operational data or call control tools.

Backend flags are `DWMS_DEMO_AI_ENABLED=true` and `DWMS_DEMO_AI_TOKEN_BUDGET=250000`. Omission/invalid configuration fails closed. The code clamps any configured budget to 250,000 total reserved tokens. This is a non-recurring lifetime allowance using a stable database counter, not a daily refill; toggling enablement, starting a session, clearing chat and failed/ambiguous provider calls cannot reset/refund it. The release was enabled through the existing authorized deployment session.

Limits: 30-minute capability sessions; up to 6 questions and 60,000 reserved tokens per session; 40 total sessions and 60 total model attempts; 6 new sessions/minute; 10 model attempts/minute globally; 5 seconds between model requests within a session; 8 KiB streamed request-body limit; 28,000 prompt-byte ceiling; fixed `gpt-5-mini`, no automatic retries, maximum 1,200 completion tokens. Session capabilities are random 256-bit values stored only as hashes server-side. Origin is restricted to the published Site, but CORS is not bot authentication. Shared availability can be exhausted by abuse.

Reservations conservatively count UTF-8 prompt bytes, generous framing and maximum completion. At the [published GPT-5-mini standard tariff](https://developers.openai.com/api/docs/models/gpt-5-mini) reviewed 2026-11-27 (input US$0.25/output US$2 per million tokens), pricing every reserved token at the more expensive output rate puts 250,000 tokens at US$0.50. This is a tariff-based inference ceiling, not an invoice guarantee or a cap on Convex/hosting costs. No purchase, subscription or automatic recharge was enabled by this release. Do not refill/reset the lifetime allowance without owner approval and a fresh tariff review.

Demo history is scoped to possession of its session capability; it is separate from authenticated personal Live history. No private operational information should be entered in the public demonstration. The engine cites a small reviewed reference whitelist (`convex/knowledge.ts`); numeric Saudi end-use standards and unidentified probe manuals remain unavailable. Report exports use loaded records and explicitly mark incomplete daily/weekly coverage. Statistical estimates are experimental, not validated predictive accuracy.
