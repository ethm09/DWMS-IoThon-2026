// Compile the actual sketch against host I/O fakes. This does not validate electronics.
#include <cassert>
#include <cstdint>
#include <deque>
#include <iostream>
#include <sstream>
#include <string>
#define DWMS_RELAY_CONTROL_ENABLED 1
#define DWMS_RELAY_ACTIVE_LOW 1
#define A0 14
#define A1 15
#define A2 16
#define INPUT 0
#define OUTPUT 1
#define HIGH 1
#define LOW 0
#define F(value) value
unsigned long clockMs = 100;
unsigned long millis() { return clockMs; }
void delay(unsigned long) {}
int analogRead(uint8_t) { return 0; }
std::string pins;
void pinMode(uint8_t, int mode) { pins += mode == OUTPUT ? "OUTPUT;" : "INPUT;"; }
void digitalWrite(uint8_t, int value) { pins += value == HIGH ? "HIGH;" : "LOW;"; }
class SerialFake {
 public:
  std::string output;
  std::deque<char> input;
  void begin(int) {}
  int available() { return input.size(); }
  char read() { char value = input.front(); input.pop_front(); return value; }
  template <typename T> void print(T value) { std::ostringstream stream; stream << value; output += stream.str(); }
  template <typename T> void print(T value, int) { print(value); }
  template <typename T> void println(T value) { print(value); output += '\n'; }
  void println() { output += '\n'; }
} Serial;
#include "../../hardware/arduino/dwms_controller/dwms_controller.ino"

void command(const std::string &value) {
  char buffer[256];
  assert(value.size() < sizeof(buffer));
  strcpy(buffer, value.c_str());
  handleCommand(buffer);
}
void reset() {
  clockMs = 100;
  readingsValid = true;
  phValue = 7; tdsValue = 200; turbidityValue = 1;
  lastValidReadingAt = clockMs;
  keepaliveReceived = false;
  lastKeepaliveAt = 0;
  emergencyLock = false;
  pumpOn = false;
  lastCommandId[0] = '\0';
  Serial.output.clear();
  serialLength = 0;
  discardSerialLine = false;
}
int main() {
  reset();
  command("SET_PUMP,start,manual,1");
  assert(!pumpOn); // No successful backend poll, no control lease.
  assert(Serial.output.find("ERR,0,SAFETY_INTERLOCK") != std::string::npos);

  reset();
  command("KEEPALIVE");
  command("SET_PUMP,start,manual,1");
  assert(pumpOn);
  // Healthy local sensors cannot keep output running when connectivity is lost.
  clockMs += CONTROL_LEASE_MS + 1;
  lastValidReadingAt = clockMs;
  command("KEEPALIVE"); // Late renewal first enforces the expired lease.
  assert(!pumpOn && emergencyLock);
  command("SET_PUMP,retry,manual,1");
  assert(!pumpOn && emergencyLock);
  command("SET_PUMP,pending_before_outage,auto,1,0");
  assert(!pumpOn && emergencyLock);
  command("SET_PUMP,recover,auto,1,1");
  assert(pumpOn && !emergencyLock);

  reset(); command("KEEPALIVE");
  command("SET_PUMP,start,manual,1");
  clockMs += SENSOR_STALE_MS + 1;
  command("KEEPALIVE");
  assert(!pumpOn && emergencyLock);
  command("SET_PUMP,stale_recovery_off,auto,0,1");
  assert(!pumpOn && emergencyLock); // Even an OFF reset needs fresh sensors.
  lastValidReadingAt = clockMs;
  command("SET_PUMP,fresh_recovery_off,auto,0,1");
  assert(!pumpOn && !emergencyLock);

  reset(); command("KEEPALIVE");
  phValue = 4;
  command("SET_PUMP,unsafe,manual,1");
  assert(!pumpOn && emergencyLock);
  phValue = 7;
  Serial.output.clear();
  command("SET_PUMP,unsafe,manual,1");
  assert(Serial.output.find("ACK,unsafe,ERR,0,SAFETY_INTERLOCK") != std::string::npos);

  reset(); command("KEEPALIVE");
  std::string frame(100, 'x');
  frame += "SET_PUMP,overflow,manual,1\n";
  for (char value : frame) Serial.input.push_back(value);
  readSerialCommands();
  assert(!pumpOn);
  command("SET_PUMP,good,manual,1");
  assert(pumpOn);
  command("SET_PUMP,stop,emergency,0");
  assert(!pumpOn && emergencyLock);

  pins.clear();
  setup();
  // LED mode writes precede the relay startup; relay latch HIGH must precede OUTPUT.
  assert(pins.find("HIGH;OUTPUT;") != std::string::npos);
  std::cout << "Firmware host safety/protocol checks passed (I/O fakes).\n";
}
