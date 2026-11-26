"""Protocol tests use fakes; no installed USB/HTTP packages or physical board required."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch


class RequestException(Exception):
    pass


# Load against explicit protocol fakes, even if the local machine has dependencies.
requests_stub = types.SimpleNamespace(Session=object, RequestException=RequestException)
serial_stub = types.SimpleNamespace(Serial=object, SerialException=OSError)
spec = importlib.util.spec_from_file_location(
    "bridge", Path(__file__).resolve().parents[1] / "public/hardware/serial_bridge.py"
)
bridge = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"requests": requests_stub, "serial": serial_stub}):
    spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.session = Mock()
        self.board = Mock()
        self.response = self.session.post.return_value
        self.response.status_code = 200
        self.output = contextlib.redirect_stdout(io.StringIO())
        self.output.__enter__()

    def tearDown(self):
        self.output.__exit__(None, None, None)

    def test_accepts_calibrated_abnormal_reading_for_server_safety_evaluation(self):
        bridge.handle_reading('{"calibrated":true,"ph":4,"tds":1800,"turbidity":60}', self.session, "data")
        self.session.post.assert_called_once_with("data", json={"ph": 4., "tds": 1800., "turbidity": 60.}, timeout=3)

    def test_rejects_malformed_uncalibrated_nonfinite_and_wrong_types(self):
        valid = {"calibrated": True, "ph": 7, "tds": 100, "turbidity": 1}
        invalid = ["{", "null", "[]", "1", json.dumps({**valid, "calibrated": False})]
        for key, value in [("ph", True), ("tds", "100"), ("tds", float("nan")), ("turbidity", float("inf")), ("ph", -1), ("ph", 15), ("tds", -1), ("turbidity", -1), ("tds", 10 ** 1000)]:
            invalid.append(json.dumps({**valid, key: value}))
        invalid.append(json.dumps({"calibrated": True, "ph": 7, "tds": 1}))
        for value in invalid:
            with self.subTest(value=value[:80]):
                bridge.handle_reading(value, self.session, "data")
        self.session.post.assert_not_called()

    def test_communication_failure_does_not_replay_telemetry(self):
        self.session.post.side_effect = RequestException()
        bridge.handle_reading('{"calibrated":true,"ph":7,"tds":100,"turbidity":1}', self.session, "data")
        self.assertEqual(self.session.post.call_count, 1)

    def test_empty_success_renews_lease(self):
        self.response.status_code = 204
        self.assertTrue(bridge.poll_command(self.board, self.session, "next"))
        self.board.write.assert_called_once_with(b"KEEPALIVE\n")

    def test_success_renews_lease_before_command(self):
        self.response.json.return_value = {"commandId": "abc_12", "mode": "manual", "pumpOn": False}
        self.assertTrue(bridge.poll_command(self.board, self.session, "next"))
        self.assertEqual([c.args[0] for c in self.board.write.call_args_list], [b"KEEPALIVE\n", b"SET_PUMP,abc_12,manual,0,0\n"])

    def test_slow_successful_poll_discards_delayed_frames_before_new_command(self):
        self.response.status_code = 204
        with patch.object(bridge.time, "monotonic", side_effect=[0., 2.]):
            bridge.poll_command(self.board, self.session, "next")
        self.board.reset_input_buffer.assert_called_once()
        self.board.write.assert_called_once_with(b"KEEPALIVE\n")

    def test_slow_failed_poll_discards_delayed_frames_without_renewal(self):
        self.session.post.side_effect = RequestException()
        with patch.object(bridge.time, "monotonic", side_effect=[0., 2.]):
            bridge.poll_command(self.board, self.session, "next")
        self.board.reset_input_buffer.assert_called_once()
        self.board.write.assert_not_called()

    def test_explicit_recovery_flag_reaches_firmware(self):
        self.response.json.return_value = {"commandId": "ack", "mode": "auto", "pumpOn": False, "clearEmergency": True}
        self.assertTrue(bridge.poll_command(self.board, self.session, "next"))
        self.assertEqual(self.board.write.call_args.args[0], b"SET_PUMP,ack,auto,0,1\n")

    def test_invalid_recovery_flag_cannot_control_or_renew(self):
        for flag, mode in [("true", "auto"), (1, "auto"), (True, "manual"), (True, "emergency")]:
            self.response.json.return_value = {"commandId": "ack", "mode": mode, "pumpOn": False, "clearEmergency": flag}
            self.assertFalse(bridge.poll_command(self.board, self.session, "next"))
        self.board.write.assert_not_called()

    def test_failed_poll_does_not_renew_lease(self):
        self.session.post.side_effect = RequestException()
        self.assertFalse(bridge.poll_command(self.board, self.session, "next"))
        self.board.write.assert_not_called()

    def test_invalid_command_never_renews_or_controls(self):
        valid = {"commandId": "abc", "mode": "auto", "pumpOn": True}
        for command in [None, [], {}, {**valid, "pumpOn": "false"}, {**valid, "pumpOn": 1}, {**valid, "mode": "auto\nSET_PUMP"}, {**valid, "commandId": "a,b"}, {**valid, "commandId": "é"}, {**valid, "commandId": ""}, {**valid, "commandId": "a" * 40}]:
            with self.subTest(command=command):
                self.response.json.return_value = command
                self.assertFalse(bridge.poll_command(self.board, self.session, "next"))
        self.board.write.assert_not_called()

    def test_ack_without_message_omits_field_instead_of_null(self):
        bridge.handle_ack("ACK,abc,ERR,0", self.session, "ack")
        self.session.post.assert_called_once_with("ack", json={"commandId": "abc", "ok": False, "pumpOn": False}, timeout=3)

    def test_status_forwards_emergency_latch(self):
        bridge.handle_status("STATUS,0,1", self.session, "status")
        self.session.post.assert_called_once_with("status", json={"pumpOn": False, "emergencyLock": True}, timeout=3)

    def test_bad_ack_or_status_never_uploads(self):
        for line in ["ACK,,OK,1", "ACK,a,BAD,1", "ACK,a,OK,x", "ACK"]:
            bridge.handle_ack(line, self.session, "ack")
        for line in ["STATUS,1,x", "STATUS,0,0,extra", "STATUS"]:
            bridge.handle_status(line, self.session, "status")
        self.session.post.assert_not_called()

    def test_serial_write_failure_propagates_to_reconnect_loop(self):
        self.response.status_code = 204
        self.board.write.side_effect = OSError("disconnected")
        with self.assertRaises(OSError):
            bridge.poll_command(self.board, self.session, "next")

    def test_usb_open_failures_retry_with_bounded_backoff(self):
        bridge.serial.Serial = Mock(side_effect=OSError("not connected"))
        session = Mock()
        with patch.object(bridge, "require_configuration"), patch.object(bridge.requests, "Session", return_value=session), patch.object(bridge.time, "sleep", side_effect=[None] * 6 + [KeyboardInterrupt()]) as sleep:
            bridge.main()
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [1, 2, 4, 8, 10, 10, 10])
        session.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
