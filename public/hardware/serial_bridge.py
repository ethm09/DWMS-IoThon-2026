"""DWMS Arduino USB serial bridge.

Configure DWMS_HTTP_URL, DWMS_DEVICE_ID, DWMS_API_KEY, and optionally
DWMS_SERIAL_PORT before running. Install requests and pyserial in a virtualenv.
Telemetry is sent once, never buffered/replayed as fresh after an outage.
Successful authenticated command polls renew the Arduino's control lease.
"""

import json
import math
import os
import sys
import time

import requests
import serial


HTTP_URL = os.environ.get("DWMS_HTTP_URL", "").rstrip("/")
DEVICE_ID = os.environ.get("DWMS_DEVICE_ID", "")
API_KEY = os.environ.get("DWMS_API_KEY", "")
SERIAL_PORT = os.environ.get("DWMS_SERIAL_PORT", "COM3")
BAUD_RATE = int(os.environ.get("DWMS_BAUD_RATE", "9600"))
POLL_INTERVAL_SECONDS = 1.0
HTTP_TIMEOUT_SECONDS = 3
MAX_RECONNECT_SECONDS = 10
MAX_SERIAL_BUFFER_AGE_SECONDS = 1.0


def require_configuration() -> None:
    missing = [
        name
        for name, value in (
            ("DWMS_HTTP_URL", HTTP_URL),
            ("DWMS_DEVICE_ID", DEVICE_ID),
            ("DWMS_API_KEY", API_KEY),
        )
        if not value
    ]
    if missing:
        print("Missing required environment variables: " + ", ".join(missing))
        sys.exit(2)
    if not HTTP_URL.startswith("https://"):
        print("DWMS_HTTP_URL must be the HTTPS Convex HTTP Actions URL.")
        sys.exit(2)


def run_board(board: serial.Serial, session: requests.Session) -> None:
    """Process one USB session. Opening the port resets many Uno boards."""
    time.sleep(2.0)
    # Discard bytes accumulated while opening/resetting. Never upload old samples.
    board.reset_input_buffer()
    last_poll = 0.0
    last_serial_read = time.monotonic()
    while True:
        now = time.monotonic()
        if now - last_serial_read > MAX_SERIAL_BUFFER_AGE_SECONDS:
            board.reset_input_buffer()
        if now - last_poll >= POLL_INTERVAL_SECONDS:
            poll_command(board, session, HTTP_URL + "/arduino/control/next")
            last_poll = time.monotonic()

        # Drop a backlog rather than re-label old, timestamp-free readings as live.
        # A normal controller frame is <150 bytes at the current one-second cadence.
        if board.in_waiting > 256:
            board.reset_input_buffer()
        line = board.readline(256).decode("utf-8", errors="replace").strip()
        last_serial_read = time.monotonic()
        if line.startswith("ACK,"):
            handle_ack(line, session, HTTP_URL + "/arduino/control/ack")
        elif line.startswith("STATUS,"):
            handle_status(line, session, HTTP_URL + "/arduino/control/status")
        elif line.startswith("{"):
            handle_reading(line, session, HTTP_URL + "/arduino/data")
        elif line and line != "CALIBRATION_REQUIRED":
            print("Controller:", line)


def main() -> None:
    require_configuration()
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Device-ID": DEVICE_ID,
    })
    print("DWMS bridge started for device:", DEVICE_ID)
    print("Serial port:", SERIAL_PORT, "at", BAUD_RATE, "baud")
    print("Press Ctrl+C to stop.")
    reconnect_seconds = 1
    try:
        while True:
            try:
                with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.5) as board:
                    reconnect_seconds = 1
                    run_board(board, session)
            except (serial.SerialException, OSError):
                # Do not print request/exception objects: they can contain credentials.
                print("Serial disconnected; reconnecting in", reconnect_seconds, "seconds.")
                time.sleep(reconnect_seconds)
                reconnect_seconds = min(reconnect_seconds * 2, MAX_RECONNECT_SECONDS)
    except KeyboardInterrupt:
        print("\nDWMS bridge stopped. Controller lease expires without further polls.")
    finally:
        session.close()


def is_measurement(value: object) -> bool:
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def handle_reading(line: str, session: requests.Session, data_url: str) -> None:
    try:
        payload = json.loads(line)
    except (json.JSONDecodeError, ValueError):
        print("Ignored malformed controller JSON.")
        return
    required = ("ph", "tds", "turbidity")
    if not isinstance(payload, dict) or payload.get("calibrated") is not True:
        print("Reading not sent: sensor calibration is not marked valid.")
        return
    if not all(
        is_measurement(payload.get(key)) for key in required
    ):
        print("Ignored invalid sensor values.")
        return
    if not (0 <= payload["ph"] <= 14 and payload["tds"] >= 0 and payload["turbidity"] >= 0):
        print("Ignored sensor values outside measurement ranges.")
        return
    data = {key: float(payload[key]) for key in required}
    try:
        response = session.post(data_url, json=data, timeout=HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        print("Reading sent:", data)
    except requests.RequestException:
        print("Reading upload failed; sample discarded.")


def discard_slow_poll_buffer(board: serial.Serial, started: float) -> None:
    # Frames have no board clock synchronization. Prefer losing a delayed frame
    # (including an ACK that will be redelivered) to displaying an old sample as live.
    if time.monotonic() - started > MAX_SERIAL_BUFFER_AGE_SECONDS:
        board.reset_input_buffer()


def poll_command(board: serial.Serial, session: requests.Session, next_url: str) -> bool:
    started = time.monotonic()
    try:
        response = session.post(next_url, timeout=HTTP_TIMEOUT_SECONDS)
        if response.status_code == 204:
            discard_slow_poll_buffer(board, started)
            board.write(b"KEEPALIVE\n")
            return True
        response.raise_for_status()
        command = response.json()
        if not isinstance(command, dict):
            raise ValueError("Expected a command object")
        command_id = command["commandId"]
        mode = command["mode"]
        pump_on = command["pumpOn"]
        clear_emergency = command.get("clearEmergency", False)
        if (
            not isinstance(command_id, str)
            or not 1 <= len(command_id) < 40
            or not command_id.isascii()
            or not all(char.isalnum() or char in "_-" for char in command_id)
            or mode not in ("auto", "manual", "emergency")
            or type(pump_on) is not bool
            or type(clear_emergency) is not bool
            or (clear_emergency and mode != "auto")
        ):
            raise ValueError("Invalid command fields")
        discard_slow_poll_buffer(board, started)
        board.write(b"KEEPALIVE\n")
        board.write(f"SET_PUMP,{command_id},{mode},{int(pump_on)},{int(clear_emergency)}\n".encode("ascii"))
        return True
    except requests.RequestException:
        print("Control poll failed; controller lease not renewed.")
    except (KeyError, ValueError, TypeError):
        print("Invalid control command response; controller lease not renewed.")
    discard_slow_poll_buffer(board, started)
    # Serial errors propagate to the reconnect loop.
    return False


def handle_ack(line: str, session: requests.Session, ack_url: str) -> None:
    parts = line.split(",", 4)
    if len(parts) < 4:
        print("Ignored malformed command acknowledgement.")
        return
    _, command_id, result, actual_state, *message = parts
    if not command_id or result not in ("OK", "ERR") or actual_state not in ("0", "1"):
        print("Ignored malformed command acknowledgement.")
        return
    payload = {"commandId": command_id, "ok": result == "OK", "pumpOn": actual_state == "1"}
    if message:
        payload["message"] = message[0][:240]
    try:
        response = session.post(ack_url, json=payload, timeout=HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        print("Control acknowledgement:", payload)
    except requests.RequestException:
        # The pending command will be polled again; Arduino repeats its original result.
        print("Control acknowledgement upload failed; awaiting command redelivery.")


def handle_status(line: str, session: requests.Session, status_url: str) -> None:
    parts = line.split(",", 3)
    if len(parts) != 3 or parts[1] not in ("0", "1") or parts[2] not in ("0", "1"):
        print("Ignored malformed pump status.")
        return
    try:
        response = session.post(
            status_url,
            json={"pumpOn": parts[1] == "1", "emergencyLock": parts[2] == "1"},
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except requests.RequestException:
        print("Pump status upload failed.")


if __name__ == "__main__":
    main()
