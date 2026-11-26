# Setup

## Browser simulation

Use Node.js 24 and pnpm 10. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. The public browser simulation needs no account or probes. Follow [DEMO.md](DEMO.md); simulation is not authenticated hardware operation.

## Connected deployment

Reuse the existing Convex/Auth0 infrastructure; do not create replacement services. Copy `.env.example` to `.env.local`, set the confirmed public values below and restart Vite. Use an authorized terminal for this existing deployment when publishing source:

| Frontend environment | Matching Convex deployment environment |
|---|---|
| `VITE_CONVEX_URL=https://canny-mosquito-637.convex.cloud` | Existing Convex deployment |
| `VITE_CONVEX_SITE_URL=https://canny-mosquito-637.convex.site` | Same deployment's HTTP actions |
| `VITE_AUTH0_DOMAIN=dev-i3qysqy0xf3uqtvv.us.auth0.com` | Existing tenant; canonical issuer `https://dev-i3qysqy0xf3uqtvv.us.auth0.com/` |
| `VITE_AUTH0_CLIENT_ID=Z8rnHb9dVeG1YH3nqlfeuZ1ZT2Yfd4Bx` | Recovered public SPA ID; must match existing `AUTH0_CLIENT_ID`; owner confirmation pending |
| — | Existing `AUTH0_DOMAIN`, `DWMS_INITIAL_ADMIN_EMAIL` and optional `OPENAI_API_KEY` stay server-side |

The URLs/domain are owner-confirmed public configuration, not credentials. Both host and HTTPS issuer forms are normalized. Auth0's SPA ID token is used for Convex; no custom API audience is required by this implementation. Never copy server API keys or deployment credentials into frontend variables or documentation.

## Auth0 application settings

Use the existing Auth0 **Single Page Application** and add/verify these exact allowed URLs for the current public demo origin and local development:

| Auth0 setting | Values |
|---|---|
| Allowed Callback URLs | `http://localhost:5173/auth/callback` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/auth/callback` |
| Allowed Logout URLs | `http://localhost:5173` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site` |
| Allowed Web Origins | `http://localhost:5173` and `https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site` |

If the deployment origin changes, replace/add that exact origin in all three settings. Callback paths include `/auth/callback`; logout/origin entries do not. The app redirects to the origin after logout. Tokens stay in memory; reloading may require sign-in again depending on the Auth0/browser SSO session.

Preserve the existing configured owner's verified email; other new users start as viewers. An administrator registers devices; operators control existing devices. Never commit real keys.

**Deployment gates:** the existing SPA client ID still needs owner confirmation, the Auth0 allowed-URL settings need verification, and an authorized Convex deployment session is needed to publish current backend changes. New read guards are source/test verified but are not established on the existing cloud deployment until that publish succeeds. Existing server environment values alone do not deploy source or prove real callback/login/logout.

## Arduino and bridge

Complete the [hardware intake and calibration procedure](VALIDATION.md#hardware-information-required). The default sketch emits calibration-required status, not measurements. Compile without upload using Arduino CLI 1.6.0 and `bash scripts/compile-arduino.sh <evidence-dir>`; both source safety enables remain `0`.

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install requests pyserial
export DWMS_HTTP_URL='https://canny-mosquito-637.convex.site'
export DWMS_DEVICE_ID='<registered-device-id>'
export DWMS_SERIAL_PORT='/dev/ttyACM0'
read -r -s -p 'Device API key: ' DWMS_API_KEY
export DWMS_API_KEY
python public/hardware/serial_bridge.py
```

Use the actual port (`COM3` is a Windows example); baud defaults to 9600. Devices also offers a download and PowerShell setup. Keep keys out of recordings.

## Publish

Run the [verification commands](VALIDATION.md#reproduce-checks-and-remaining-limits), deploy current source to the existing Convex deployment with `pnpm exec convex deploy` from an authorized session, then build/publish the frontend with its intended environment. The public Sites simulation uses `.openai/hosting.json` and SPA deep-link redirects. The repository retains Vercel configuration, but its SSO-protected preview is not the judges' public link.

Update backend, bridge and firmware together with outputs inactive: `clearEmergency` is an optional command field/fifth serial field; old commands default to no recovery permission. Optional AI needs `OPENAI_API_KEY` only in Convex and is explanation-only. A frontend publication does not validate Auth0, probes or physical output.

### Verified external authentication blocker

A request to the existing Auth0 authorization endpoint with public client ID `Z8rnHb9dVeG1YH3nqlfeuZ1ZT2Yfd4Bx` and the new Site callback returned **Callback URL mismatch** on 2026-11-26. This confirms the current Site origin is not yet allowed. The Client ID was recovered from the existing Vercel frontend, not generated. No credentials or test accounts were created.

In Auth0 → Applications → existing SPA → Settings, add the exact callback/logout/web-origin URLs above and retain existing working URLs. Save changes. Verify database signup is enabled if registration is intended. The React SDK uses the SPA ID token for Convex, its HTTPS issuer and the same client ID; do not substitute a client secret or arbitrary API audience. Memory token caching plus silent refresh must be tested after these origin settings are saved. Keep refresh-token rotation consistent with your SPA policy.

Publish the hardened backend from an authenticated terminal for the **existing** `canny-mosquito-637` production deployment using `pnpm exec convex deploy`; verify the CLI's selected project/deployment before accepting its target. This workspace has no Convex deployment credential. A read-only live check showed the older production registry query still accepts an anonymous request (zero device records returned); source/test guards are not a deployed protection claim.

The public guest build intentionally omits Auth0 SPA values while this callback/deployment gate is blocked. After the backend and allowed URLs are verified, rebuild with `VITE_CONVEX_URL=https://canny-mosquito-637.convex.cloud`, `VITE_CONVEX_SITE_URL=https://canny-mosquito-637.convex.site`, `VITE_AUTH0_DOMAIN=dev-i3qysqy0xf3uqtvv.us.auth0.com` and the confirmed public client ID. Static build variables require a rebuild; runtime environment edits alone do not modify an existing bundle.
