# Setup

## Browser demo

Use Node.js 24 and pnpm 10. Run `pnpm install --frozen-lockfile`, then `pnpm dev`; open the printed URL and choose Local demo. No accounts or hardware are needed. Follow [DEMO.md](DEMO.md).

## Convex and Auth0

1. Copy `.env.example` to `.env.local`; never commit real values.
2. Run `pnpm exec convex dev` to select/create a development deployment and regenerate bindings; keep it running for connected development.
3. Configure the values below and restart Vite. Client and HTTP Actions URLs are different; the latter is typically `https://<deployment>.convex.site`.

| Location | Variables |
|---|---|
| Frontend environment | `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` |
| Convex deployment environment | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `DWMS_INITIAL_ADMIN_EMAIL` |

Create an Auth0 Single Page Application with callback `http://localhost:5173/auth/callback`, matching logout/web origins and deployed equivalents. Use the same tenant/client on both sides. Set the owner's verified `DWMS_INITIAL_ADMIN_EMAIL` before sign-in; other new users start as viewers. Publish configuration with `pnpm exec convex dev` or `pnpm exec convex deploy`.

An administrator registers devices through Devices; operators control existing devices. Preserve the returned key privately. Optional AI needs `OPENAI_API_KEY` only in the Convex environment, never a `VITE_` variable.

## Arduino and bridge

Complete the [calibration and safety procedure](VALIDATION.md#calibration-and-physical-validation-procedure) before enabling calibrated telemetry or relay control. The default sketch emits calibration-required status rather than measurements. See the target-build gate in that same checklist for verified tooling.

Compile without uploading: install Arduino CLI 1.6.0, then run `bash scripts/compile-arduino.sh <evidence-dir>`. Both safety enables must remain `0`; compilation does not complete calibration or electrical checks.

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install requests pyserial
export DWMS_HTTP_URL='https://<deployment>.convex.site'
export DWMS_DEVICE_ID='<registered-device-id>'
export DWMS_SERIAL_PORT='/dev/ttyACM0'
read -r -s -p 'Device API key: ' DWMS_API_KEY
export DWMS_API_KEY
python public/hardware/serial_bridge.py
```

Use the actual serial port (`COM3` is a Windows example); baud defaults to 9600. Devices also offers a bridge download and PowerShell setup.

## Deploy

Run the checks in [VALIDATION.md](VALIDATION.md), then deploy Convex separately with `pnpm exec convex deploy`. Vercel uses `vercel.json` to build `dist` and serve SPA routes; set frontend variables in hosting settings and allow the deployed origin in Auth0. Committed bindings permit a frontend build without starting Convex.

Update backend, bridge and firmware together while outputs are inactive. `clearEmergency` is an optional stored command field and fifth serial field; old commands default to no recovery permission. Only explicit acknowledgement may request local latch recovery, with fresh acceptable readings and a live lease still required.

Registry/history APIs currently allow public reads without tenant isolation. Use nonsensitive prototype data. A frontend deployment does not validate Auth0, physical sensors or output behavior.
