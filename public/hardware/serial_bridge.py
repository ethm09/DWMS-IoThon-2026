"""DWMS Arduino USB serial bridge.

Configure DWMS_HTTP_URL, DWMS_DEVICE_ID, DWMS_API_KEY, and optionally
DWMS_SERIAL_PORT in the environment before running this file. The device API
key is a secret: do not commit it or share the configured terminal command.
"""

import json
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


def main() -> None:
    require_configuration()
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Device-ID": DEVICE_ID,
    }
    session = requests.Session()
    session.headers.update(headers)
    data_url = HTTP_URL + "/arduino/data"
    next_url = HTTP_URL + "/arduino/control/next"
    ack_url = HTTP_URL + "/arduino/control/ack"
    last_poll = 0.0

    print("DWMS bridge started for device:", DEVICE_ID)
    print("Serial port:", SERIAL_PORT, "at", BAUD_RATE, "baud")
    print("Press Ctrl+C to stop.")

    try:
        with serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.5) as board:
            time.sleep(2.0)  # Arduino Uno resets when the serial port opens.
            while True:
                line = board.readline().decode("utf-8", errors="replace").strip()
                if line:
                    if line.startswith("ACK,"):
                        handle_ack(line, session, ack_url)
                    elif line.startswith("STATUS,"):
                        handle_status(line, session, HTTP_URL + "/arduino/control/status")
                    elif line.startswith("{"):
                        handle_reading(line, session, data_url)
                    elif line != "CALIBRATION_REQUIRED":
                        print("Controller:", line)

                now = time.monotonic()
                if now - last_poll >= POLL_INTERVAL_SECONDS:
                    poll_command(board, session, next_url)
                    last_poll = now
    except KeyboardInterrupt:
        print("\nDWMS bridge stopped.")
    except serial.SerialException as error:
        print("Serial connection failed:", error)
        sys.exit(1)


def handle_reading(line: str, session: requests.Session, data_url: str) -> None:
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        print("Ignored malformed controller JSON.")
        return

    required = ("ph", "tds", "turbidity")
    if payload.get("calibrated") is not True or not all(
        isinstance(payload.get(key), (int, float)) for key in required
    ):
        print("Reading not sent: sensor calibration is not marked valid.")
        return

    data = {key: float(payload[key]) for key in required}
    try:
        response = session.post(data_url, json=data, timeout=5)
        response.raise_for_status()
        print("Reading sent:", data)
    except requests.RequestException as error:
        print("Reading upload failed:", error)


def poll_command(
    board: serial.Serial, session: requests.Session, next_url: str
) -> None:
    try:
        response = session.post(next_url, timeout=5)
        if response.status_code == 204:
            return
        response.raise_for_status()
        command = response.json()
        command_id = str(command["commandId"])
        mode = str(command["mode"])
        pump_on = bool(command["pumpOn"])
        if any(char in command_id for char in ",\r\n"):
            print("Ignored command with invalid identifier.")
            return
        serial_command = f"SET_PUMP,{command_id},{mode},{int(pump_on)}\n"
        board.write(serial_command.encode("ascii"))
    except requests.RequestException as error:
        print("Control poll failed:", error)
    except (KeyError, ValueError, TypeError) as error:
        print("Invalid control command response:", error)
    except serial.SerialException as error:
        print("Could not send control command to the board:", error)


def handle_ack(line: str, session: requests.Session, ack_url: str) -> None:
    parts = line.split(",", 4)
    if len(parts) < 4:
        print("Ignored malformed command acknowledgement.")
        return
    _, command_id, result, actual_state, *message = parts
    if result not in ("OK", "ERR") or actual_state not in ("0", "1"):
        print("Ignored malformed command acknowledgement.")
        return
    payload = {
        "commandId": command_id,
        "ok": result == "OK",
        "pumpOn": actual_state == "1",
        "message": message[0] if message else None,
    }
    try:
        response = session.post(ack_url, json=payload, timeout=5)
        response.raise_for_status()
        print("Control acknowledgement:", payload)
    except requests.RequestException as error:
        print("Control acknowledgement upload failed:", error)


def handle_status(line: str, session: requests.Session, status_url: str) -> None:
    parts = line.split(",", 3)
    if len(parts) != 3 or parts[1] not in ("0", "1"):
        print("Ignored malformed pump status.")
        return
    try:
        response = session.post(
            status_url,
            json={"pumpOn": parts[1] == "1"},
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        print("Pump status upload failed:", error)


if __name__ == "__main__":
    main()
