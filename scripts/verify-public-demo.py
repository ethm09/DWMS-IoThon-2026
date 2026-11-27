#!/usr/bin/env python3
"""Verify the published guest demo with an isolated, signed-out browser.

Requires the optional Python Playwright tool and Chromium; this is browser QA,
not a production dependency. Never authenticates, imports fixtures, opens serial
ports, or sends synthetic readings to the live backend.

Example:
  python scripts/verify-public-demo.py --url https://your-preview.example \
    --output-dir docs/screenshots
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

WIDTHS = (390, 430, 768, 1024, 1440)
SCENARIOS = {
    "normal": "1 · Normal",
    "warning": "2 · Warning",
    "response": "3 · Response",
    "critical": "4 · Critical",
    "recovery": "5 · Recovery",
}


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Published site or local Vite origin")
    parser.add_argument("--output-dir", default="docs/screenshots")
    parser.add_argument("--browser-path", help="Optional Chromium executable; otherwise use system Chromium or Playwright's browser")
    parser.add_argument("--timeout-ms", type=int, default=20000)
    options = parser.parse_args()
    parsed = urlparse(options.url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username or parsed.password:
        parser.error("--url must be an HTTP(S) origin without credentials")
    options.url = options.url.rstrip("/")
    options.output_dir = Path(options.output_dir).resolve()
    options.output_dir.mkdir(parents=True, exist_ok=True)
    return options


def verify_viewport(browser, options, width):
    context = browser.new_context(
        viewport={"width": width, "height": 950 if width < 1000 else 1050},
        device_scale_factor=1,
        locale="en-US",
        timezone_id="UTC",
        color_scheme="light",
        reduced_motion="reduce",
    )
    page = context.new_page()
    page.set_default_timeout(options.timeout_ms)
    errors = []
    backend_writes = []
    checks = []
    screenshots = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def record_request(request):
        path = urlparse(request.url).path
        if request.method not in ("GET", "HEAD", "OPTIONS") and (
            "/arduino/" in path or "/api/mutation" in path
        ):
            backend_writes.append({"transport": "http", "method": request.method, "path": path})

    def inspect_frame(payload):
        try:
            message = json.loads(payload)
        except (ValueError, TypeError):
            return
        if isinstance(message, dict) and message.get("type") in ("Mutation", "mutation"):
            backend_writes.append({"transport": "websocket", "type": message["type"]})

    page.on("request", record_request)
    page.on("websocket", lambda socket: socket.on("framesent", inspect_frame))

    def scenario(key):
        return page.get_by_role("button", name=SCENARIOS[key], exact=True)

    def no_overflow(label):
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Horizontal overflow: {width}px {label}"
        checks.append(f"{label}: no horizontal overflow")

    def navigate(path):
        link = page.locator(f'a[href="{path}"]:visible').first
        expect(link).to_be_visible()
        link.click()
        expect(page).to_have_url(re.compile(re.escape(path) + r"(?:[?#].*)?$"))
        expect(page.locator("main")).not_to_be_empty()
        no_overflow(path)

    def capture(name, full_page=False):
        filename = f"{name}-{width}.png"
        page.screenshot(path=str(options.output_dir / filename), full_page=full_page)
        screenshots.append(filename)

    result = {"width": width, "status": "running", "checks": checks, "screenshots": screenshots}
    try:
        # DOM-ready plus specific visible controls avoids waiting on external fonts.
        page.goto(options.url + "/demo", wait_until="domcontentloaded")
        expect(scenario("normal")).to_be_visible()
        expect(page.get_by_text("Simulation mode", exact=True)).to_have_count(1)
        expect(scenario("normal")).to_have_attribute("aria-pressed", "true")
        scenario("normal").click()
        expect(page.get_by_text("Parameters within prototype limits", exact=True)).to_be_visible()
        no_overflow("normal overview")
        checks.append("normal scenario and simulation label")

        scenario("warning").click()
        expect(page.get_by_text("Warning · investigate readings", exact=True)).to_be_visible()
        navigate("/demo/alerts")
        expect(page.get_by_text("2 active alerts", exact=True)).to_be_visible()
        expect(page.get_by_text("Warning TDS", exact=True)).to_be_visible()
        expect(page.get_by_text("Warning Turbidity", exact=True)).to_be_visible()
        checks.append("warning alerts share overview state")
        if width in (390, 1440):
            capture("alerts-warning", full_page=True)

        navigate("/demo/trends")
        expect(page.get_by_text("3 scenario samples", exact=False)).to_be_visible()
        expect(page.get_by_role("row").filter(has_text=re.compile("warning", re.I))).to_have_count(1)
        checks.append("trends preserve the three scenario samples")

        navigate("/demo/devices")
        expect(page.locator("main")).to_contain_text("650")
        expect(page.locator("main")).to_contain_text("8.0")
        checks.append("device readings match the warning scenario")

        navigate("/demo/assistant")
        expect(page.locator("main")).to_contain_text("650")
        expect(page.locator("main")).to_contain_text("No AI model or production records")
        checks.append("Ethm demo context uses scenario values without a model or live records")

        navigate("/demo/sites")
        expect(page.locator("main")).to_contain_text("Warning")
        expect(page.locator("main")).to_contain_text("Auto · pump OFF")
        checks.append("site status matches the warning scenario")

        navigate("/demo")
        expect(scenario("warning")).to_have_attribute("aria-pressed", "true")
        scenario("response").click()
        expect(page.get_by_role("button", name="Pump response. PUMP ON", exact=True)).to_be_visible()
        checks.append("response scenario requests simulated pump ON")
        page.get_by_role("button", name="Arduino controller. Select for component details", exact=True).press("Enter")
        expect(page.get_by_role("button", name="Arduino controller · details", exact=True)).to_have_attribute("aria-expanded", "true")
        checks.append("interactive engineering schematic responds to keyboard input")

        scenario("critical").click()
        expect(page.get_by_text("Emergency stop latched · pump OFF", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Acknowledge recovery", exact=True)).to_be_disabled()
        checks.append("critical scenario latches OFF and blocks early acknowledgement")
        if width in (390, 1440):
            capture("critical-stop", full_page=True)

        scenario("recovery").click()
        expect(page.get_by_text("Emergency stop latched · pump OFF", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Acknowledge recovery", exact=True)).to_be_enabled()
        navigate("/demo/alerts")
        expect(page.get_by_text("1 active alert", exact=True)).to_be_visible()
        checks.append("recovered sensor values preserve the controller latch")
        navigate("/demo")
        page.get_by_role("button", name="Acknowledge recovery", exact=True).click()
        expect(page.get_by_text("Recovery acknowledged", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Pump response. PUMP OFF", exact=True)).to_be_visible()
        checks.append("explicit recovery acknowledgement clears the simulated latch")
        no_overflow("recovered overview")
        page.evaluate("window.scrollTo(0, 0)")
        capture("dashboard", full_page=width >= 1000)
        if width in (390, 1440):
            alias = "dashboard-mobile.png" if width == 390 else "dashboard-desktop.png"
            shutil.copyfile(options.output_dir / f"dashboard-{width}.png", options.output_dir / alias)
            screenshots.append(alias)

        if width == 1440:
            page.get_by_role("button", name="Manual", exact=True).click()
            page.get_by_role("button", name="Start example pump", exact=True).click()
            expect(page.get_by_role("button", name="Pump response. PUMP ON", exact=True)).to_be_visible()
            scenario("critical").click()
            expect(page.get_by_text("Emergency stop latched · pump OFF", exact=True)).to_be_visible()
            checks.append("critical interlock overrides a manually started demo pump")

        # A separate Live tab cannot change an active Demo workspace or restore
        # the legacy unencrypted operational event cache.
        live_tab = context.new_page()
        live_tab.goto(options.url + "/live", wait_until="domcontentloaded")
        expect(live_tab.locator("main")).to_contain_text("No live data available")
        expect(page.get_by_text("Simulation mode", exact=True)).to_have_count(1)
        expect(scenario("warning")).to_have_count(1)
        assert page.evaluate("localStorage.getItem('ldwms.eventLog')") is None
        live_tab.close()
        checks.append("Live and Demo tabs remain isolated without cached operational events")

        # Visiting Live must retain an honest signed-out/unconfigured view.
        # It must never mount the demo scenarios as a fallback for missing data.
        page.goto(options.url + "/live", wait_until="domcontentloaded")
        expect(page.locator("main")).not_to_be_empty()
        expect(scenario("warning")).to_have_count(0)
        expect(page.locator("main")).to_contain_text(re.compile(r"sign in|not configured|configure|connect|unknown|unavailable|no (?:sensor |device )?(?:data|readings)|real device|device data", re.I))
        assert "SIMULATION-NODE-01" not in page.locator("main").inner_text(), "Live view must not expose the demo fixture as real data"
        no_overflow("signed-out live view")
        checks.append("Live shows sign-in/configuration/unknown state without simulated fallback")
        if width in (390, 1440):
            capture("live-signed-out", full_page=True)

        page.goto(options.url + "/", wait_until="domcontentloaded")
        expect(page.get_by_role("heading", name="Intelligent Water Monitoring. Proactive Response.", exact=True)).to_be_visible()
        no_overflow("landing page")
        if width in (390, 1440):
            capture("landing", full_page=True)
        for route in ("/demo/rules", "/demo/about"):
            page.goto(options.url + route, wait_until="domcontentloaded")
            expect(page.locator("main h1")).to_be_visible()
            no_overflow(route)
        assert not errors, f"Browser runtime errors: {errors}"
        assert not backend_writes, f"Demo emitted backend mutation/ingestion traffic: {backend_writes}"
        checks.append("no browser runtime errors or observed device/mutation writes")
        result.update(status="passed", page_errors=[], observed_backend_writes=[])
    except Exception as error:
        result.update(status="failed", error=str(error), page_errors=errors, observed_backend_writes=backend_writes)
        capture("failure", full_page=True)
    finally:
        context.close()
    return result


def main():
    options = arguments()
    expect.set_options(timeout=options.timeout_ms)
    report = {
        "url": options.url,
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "scope": "Signed-out browser UI and local simulation only; no Auth0 login, physical sensor validation, relay actuation, treatment result or load test.",
        "results": [],
    }
    executable = options.browser_path or shutil.which("chromium") or shutil.which("chromium-browser")
    with sync_playwright() as playwright:
        launch_options = {"headless": True, "args": ["--no-sandbox"]}
        if executable:
            launch_options["executable_path"] = executable
        browser = playwright.chromium.launch(**launch_options)
        try:
            for width in WIDTHS:
                result = verify_viewport(browser, options, width)
                report["results"].append(result)
                print(f"{result['status'].upper()} {width}px: {len(result['checks'])} checks", flush=True)
                if result["status"] == "failed":
                    print(result["error"], flush=True)
        finally:
            browser.close()
    destination = options.output_dir / "qa-results.json"
    destination.write_text(json.dumps(report, indent=2) + "\n")
    print(f"Browser QA report: {destination}")
    raise SystemExit(0 if all(result["status"] == "passed" for result in report["results"]) else 1)


if __name__ == "__main__":
    main()
