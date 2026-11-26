# Installation and connection

## Local UI demo

Use Node.js 24 and pnpm 10. `pnpm test` also needs Python 3; the controller host check needs `g++`. These checks use mocks and do not need a connected Arduino or Python bridge packages.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The dashboard simulation requires no environment variables or authentication. It does not test the cloud or hardware path. Follow [DEMO.md](DEMO.md).

## Connected backend

1. Copy `.env.example` to `.env.local`; never commit real values.
2. Run `pnpm exec convex dev` to select/create a development deployment and generate bindings. Keep it running during connected development.
3. Set `VITE_CONVEX_URL` to that deployment's client URL and `VITE_CONVEX_SITE_URL` to its HTTP Actions URL (typically `https://<deployment>.convex.site`). Restart Vite after environment changes.
4. Configure Auth0 before using authenticated device/history/control pages.

Convex-generated files are committed so the frontend can build without starting a backend. Development code generation and `pnpm exec convex deploy` require an authenticated Convex setup. The backend and frontend are separate deployments.

## Auth0 and initial administrator

Create an Auth0 Single Page Application. Allow the local callback `http://localhost:5173/auth/callback`, the matching logout origin and web origin. Add deployed equivalents when deploying.

| Location | Variables |
|---|---|
| Frontend `.env.local` / hosting settings | `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL` |
| Convex deployment environment | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `DWMS_INITIAL_ADMIN_EMAIL` |

Use the same Auth0 tenant and client on both sides. Set `DWMS_INITIAL_ADMIN_EMAIL` to the owner's verified Auth0 email **before sign-in**. New accounts otherwise start as viewers; existing roles can be linked by verified email. Publish backend configuration with `pnpm exec convex dev` or `pnpm exec convex deploy`. Missing Auth0 configuration does not grant guest hardware access.

Optional: set `OPENAI_API_KEY` only in the Convex deployment to use AI assistance. Never prefix it with `VITE_`. Monitoring and rules do not require it.

Device registry and sensor-history API queries currently allow public reads; controls require authorization and device keys are redacted. Auth0 UI sign-in does not provide tenant isolation for this telemetry. Use nonsensitive prototype locations/data until backend read access is restricted for a real deployment.

## Hardware bench setup — incomplete until calibrated

The sketch is `hardware/arduino/dwms_controller/dwms_controller.ino`. Pin map: pH A0, TDS A1, turbidity A2, I2C LCD A4/A5, LEDs D2–D4, relay D7. Install a compatible `LiquidCrystal_I2C` library for the actual LCD/module and compile for Arduino Uno using your Arduino toolchain.

Before connecting a load:

1. Record probe/module models, supply/ADC reference, conversion equations and calibration against independent references. Implement `readCalibratedSensors`; it currently always returns `false`.
2. Verify relay module active polarity and inactive startup behavior. Sensor and relay enable flags must remain disabled until the matching checks in [VALIDATION.md](VALIDATION.md) are complete.
3. Use an isolated LED or other bench load first. A software acknowledgement does not establish pump movement or contact position.

Register a device with an administrator account through Devices; operators can operate registered devices but cannot register them. Save its returned key privately. Configure the Python bridge with the selected device ID and **HTTPS HTTP Actions URL**:

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

Use the actual serial port (`COM3` is an example on Windows); default baud is 9600. The Devices page also offers a bridge download and PowerShell setup. A default uncalibrated sketch should report calibration required and upload no measurements.

## Deployment

Run `pnpm test`, `pnpm lint` and `pnpm build` before deployment. Deploy Convex separately with `pnpm exec convex deploy`. For Vercel, the repository's `vercel.json` builds `dist` and supplies SPA route fallback. Set the four frontend variables in hosting settings and allow the deployed origin in Auth0. Deploying the dashboard does not deploy or validate the Arduino, bridge or backend.

Update backend, bridge and firmware together while the bench output is inactive: emergency recovery now carries an optional `clearEmergency` command field and a fifth serial field. Old stored commands default to no recovery permission. Ordinary Auto commands cannot clear the controller's local emergency/watchdog latch; only explicit operator acknowledgement can request that, with fresh safe readings and a live lease still required.
