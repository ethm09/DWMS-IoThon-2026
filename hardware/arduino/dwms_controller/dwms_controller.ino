/*
 * DWMS Arduino Uno controller template.
 *
 * Pin map from the project design:
 *   pH A0, TDS A1, turbidity A2, I2C LCD A4/A5,
 *   status LEDs D2/D3/D4, relay D7.
 *
 * Generic pH/TDS/turbidity modules do not share one valid conversion curve.
 * Keep sensor and relay enables at 0 until the exact module model, calibration,
 * relay polarity, and local hardware behavior have been verified.
 */
#include <LiquidCrystal_I2C.h>
#include <math.h>
#include <string.h>

#ifndef DWMS_SENSOR_CALIBRATION_CONFIGURED
#define DWMS_SENSOR_CALIBRATION_CONFIGURED 0
#endif
#ifndef DWMS_RELAY_CONTROL_ENABLED
#define DWMS_RELAY_CONTROL_ENABLED 0
#endif
#ifndef DWMS_RELAY_ACTIVE_LOW
#define DWMS_RELAY_ACTIVE_LOW 0
#endif

const uint8_t PH_PIN = A0;
const uint8_t TDS_PIN = A1;
const uint8_t TURBIDITY_PIN = A2;
const uint8_t LED_RED_PIN = 2;
const uint8_t LED_YELLOW_PIN = 3;
const uint8_t LED_GREEN_PIN = 4;
const uint8_t RELAY_PIN = 7;

const unsigned long SAMPLE_INTERVAL_MS = 1000;
const unsigned long STATUS_INTERVAL_MS = 5000;
const unsigned long SENSOR_STALE_MS = 5000;
// Renewed only after a successful authenticated backend poll by the bridge.
const unsigned long CONTROL_LEASE_MS = 15000;
const float PH_CRITICAL_LOW = 5.5f;
const float PH_CRITICAL_HIGH = 10.0f;
const float TURBIDITY_CRITICAL = 50.0f;
const float TDS_AUTO_START = 1500.0f;
const float TURBIDITY_AUTO_START = 20.0f;

LiquidCrystal_I2C lcd(0x27, 16, 2);
char serialBuffer[96];
size_t serialLength = 0;
bool discardSerialLine = false;
char lastCommandId[40] = "";
bool lastCommandOk = false;
const char *lastCommandMessage = "";
unsigned long lastSampleAt = 0;
unsigned long lastStatusAt = 0;
unsigned long lastValidReadingAt = 0;
unsigned long lastKeepaliveAt = 0;
bool keepaliveReceived = false;
float phValue = NAN;
float tdsValue = NAN;
float turbidityValue = NAN;
bool readingsValid = false;
bool pumpOn = false;
bool emergencyLock = false;
char controlMode[12] = "auto";

float readVoltage(uint8_t pin) {
  const uint8_t samples = 10;
  unsigned long total = 0;
  for (uint8_t i = 0; i < samples; ++i) {
    total += analogRead(pin);
    delay(5);
  }
  const float adc = total / (float)samples;
  return adc * (5.0f / 1023.0f);
}

bool readCalibratedSensors(float &ph, float &tds, float &turbidity) {
#if DWMS_SENSOR_CALIBRATION_CONFIGURED
  // Implement the exact sensor-module conversion and calibration equations
  // here. These generic modules have model-specific curves; do not substitute
  // guessed coefficients. Return true only after independent calibration.
  const float phVoltage = readVoltage(PH_PIN);
  const float tdsVoltage = readVoltage(TDS_PIN);
  const float turbidityVoltage = readVoltage(TURBIDITY_PIN);
  (void)phVoltage;
  (void)tdsVoltage;
  (void)turbidityVoltage;
  return false;  // Replace after entering verified module-specific equations.
#else
  (void)ph;
  (void)tds;
  (void)turbidity;
  return false;
#endif
}

void writeRelay(bool enabled) {
  if (!DWMS_RELAY_CONTROL_ENABLED) {
    // Leave an unconfigured relay pin high-impedance. Its active polarity is
    // unknown until the exact module is identified.
    pinMode(RELAY_PIN, INPUT);
    pumpOn = false;
    return;
  }
  pinMode(RELAY_PIN, OUTPUT);
  pumpOn = enabled;
  const bool outputHigh = DWMS_RELAY_ACTIVE_LOW ? !enabled : enabled;
  digitalWrite(RELAY_PIN, outputHigh ? HIGH : LOW);
}

bool hasCriticalReading() {
  return !readingsValid || phValue < PH_CRITICAL_LOW ||
         phValue > PH_CRITICAL_HIGH || turbidityValue > TURBIDITY_CRITICAL;
}

bool controlLeaseActive() {
  return keepaliveReceived && millis() - lastKeepaliveAt <= CONTROL_LEASE_MS;
}

bool canStartPump() {
  return DWMS_RELAY_CONTROL_ENABLED && readingsValid && controlLeaseActive() &&
         millis() - lastValidReadingAt <= SENSOR_STALE_MS && !emergencyLock &&
         phValue >= PH_CRITICAL_LOW && phValue <= PH_CRITICAL_HIGH &&
         turbidityValue <= TURBIDITY_CRITICAL;
}

void printAck(const char *commandId, bool ok, const char *message) {
  Serial.print(F("ACK,"));
  Serial.print(commandId);
  Serial.print(ok ? F(",OK,") : F(",ERR,"));
  Serial.print(pumpOn ? '1' : '0');
  if (message && message[0] != '\0') {
    Serial.print(',');
    Serial.print(message);
  }
  Serial.println();
}

void rememberAck(const char *commandId, bool ok, const char *message) {
  lastCommandOk = ok;
  lastCommandMessage = message;
  printAck(commandId, ok, message);
}

void reportStatus();

void enforceLocalSafety() {
  if (pumpOn && (!controlLeaseActive() ||
      millis() - lastValidReadingAt > SENSOR_STALE_MS)) {
    emergencyLock = true;
    strncpy(controlMode, "emergency", sizeof(controlMode) - 1);
    writeRelay(false);
    Serial.println(F("LOCAL_WATCHDOG_STOP"));
    reportStatus();
  }
}

void handleCommand(char *line) {
  // A late heartbeat cannot erase a lease expiry while the pump was running.
  enforceLocalSafety();
  if (strcmp(line, "KEEPALIVE") == 0) {
    keepaliveReceived = true;
    lastKeepaliveAt = millis();
    return;
  }
  char *kind = strtok(line, ",");
  char *commandId = strtok(NULL, ",");
  char *mode = strtok(NULL, ",");
  char *requested = strtok(NULL, ",");
  // Legacy four-field commands never clear a local emergency latch.
  char *clearEmergency = strtok(NULL, ",");
  char *extra = strtok(NULL, ",");
  if (!kind || !commandId || !mode || !requested || extra || strcmp(kind, "SET_PUMP") != 0) {
    Serial.println(F("SERIAL_COMMAND_INVALID"));
    return;
  }
  if (strlen(commandId) >= sizeof(lastCommandId) ||
      (strcmp(mode, "auto") != 0 && strcmp(mode, "manual") != 0 &&
       strcmp(mode, "emergency") != 0) ||
      (strcmp(requested, "0") != 0 && strcmp(requested, "1") != 0) ||
      (clearEmergency && strcmp(clearEmergency, "0") != 0 && strcmp(clearEmergency, "1") != 0) ||
      (clearEmergency && strcmp(clearEmergency, "1") == 0 && strcmp(mode, "auto") != 0)) {
    printAck(commandId, false, "INVALID_COMMAND");
    return;
  }

  if (strcmp(commandId, lastCommandId) == 0) {
    printAck(commandId, lastCommandOk, lastCommandMessage);
    return;
  }
  strncpy(lastCommandId, commandId, sizeof(lastCommandId) - 1);
  lastCommandId[sizeof(lastCommandId) - 1] = '\0';

  if (strcmp(mode, "emergency") == 0) {
    emergencyLock = true;
    strncpy(controlMode, "emergency", sizeof(controlMode) - 1);
    writeRelay(false);
    rememberAck(commandId, true, "EMERGENCY_STOPPED");
    return;
  }

  if (hasCriticalReading()) {
    emergencyLock = true;
    strncpy(controlMode, "emergency", sizeof(controlMode) - 1);
    writeRelay(false);
    rememberAck(commandId, false, "SAFETY_INTERLOCK");
    return;
  }

  const bool clearRequested = clearEmergency && strcmp(clearEmergency, "1") == 0;
  // Recovery is an explicit operator action. A queued pre-outage Auto command
  // must never release the local watchdog latch after reconnecting.
  if (emergencyLock && !clearRequested) {
    writeRelay(false);
    rememberAck(commandId, false, "EMERGENCY_ACK_REQUIRED");
    return;
  }
  // Even an OFF recovery command requires fresh calibrated readings and a live
  // control lease; a mode change alone cannot acknowledge an emergency.
  if (clearRequested && (!controlLeaseActive() ||
      millis() - lastValidReadingAt > SENSOR_STALE_MS)) {
    emergencyLock = true;
    writeRelay(false);
    rememberAck(commandId, false, "SAFETY_INTERLOCK");
    return;
  }
  if (clearRequested) emergencyLock = false;
  strncpy(controlMode, mode, sizeof(controlMode) - 1);
  controlMode[sizeof(controlMode) - 1] = '\0';

  const bool desiredOn = strcmp(requested, "1") == 0;
  if (desiredOn && !DWMS_RELAY_CONTROL_ENABLED) {
    writeRelay(false);
    rememberAck(commandId, false, "RELAY_CONTROL_DISABLED");
    return;
  }
  if (desiredOn && !canStartPump()) {
    writeRelay(false);
    rememberAck(commandId, false, "SAFETY_INTERLOCK");
    return;
  }
  writeRelay(desiredOn);
  rememberAck(commandId, true, "APPLIED");
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    const char ch = (char)Serial.read();
    if (ch == '\r') continue;
    if (discardSerialLine) {
      if (ch == '\n') discardSerialLine = false;
      continue;
    }
    if (ch == '\n') {
      serialBuffer[serialLength] = '\0';
      if (serialLength > 0) handleCommand(serialBuffer);
      serialLength = 0;
    } else if (serialLength < sizeof(serialBuffer) - 1) {
      serialBuffer[serialLength++] = ch;
    } else {
      serialLength = 0;
      discardSerialLine = true;  // Ignore the entire oversized frame, including its tail.
      Serial.println(F("SERIAL_COMMAND_TOO_LONG"));
    }
  }
}

void updateIndicators() {
  const bool critical = hasCriticalReading();
  const bool filtrationRequested =
      readingsValid && (tdsValue > TDS_AUTO_START || turbidityValue > TURBIDITY_AUTO_START);
  digitalWrite(LED_RED_PIN, critical || emergencyLock ? HIGH : LOW);
  digitalWrite(LED_YELLOW_PIN, !critical && filtrationRequested ? HIGH : LOW);
  digitalWrite(LED_GREEN_PIN, readingsValid && !critical && !filtrationRequested ? HIGH : LOW);

  lcd.setCursor(0, 0);
  if (readingsValid) {
    lcd.print(F("pH:")); lcd.print(phValue, 2);
    lcd.print(F(" TDS:")); lcd.print(tdsValue, 0); lcd.print(F("  "));
    lcd.setCursor(0, 1);
    lcd.print(F("Turb:")); lcd.print(turbidityValue, 1);
    lcd.print(F(" P:")); lcd.print(pumpOn ? F("ON ") : F("OFF"));
  } else {
    lcd.print(F("DWMS calibration"));
    lcd.setCursor(0, 1);
    lcd.print(F("required       "));
  }
}

void reportStatus() {
  Serial.print(F("STATUS,"));
  Serial.print(pumpOn ? '1' : '0');
  Serial.print(',');
  Serial.println(emergencyLock ? '1' : '0');
}

unsigned long telemetrySequence = 0;

void sampleAndSend() {
  float ph = NAN;
  float tds = NAN;
  float turbidity = NAN;
  readingsValid = readCalibratedSensors(ph, tds, turbidity) &&
                  isfinite(ph) && isfinite(tds) && isfinite(turbidity) &&
                  ph >= 0.0f && ph <= 14.0f && tds >= 0.0f && turbidity >= 0.0f;
  if (readingsValid) {
    phValue = ph;
    tdsValue = tds;
    turbidityValue = turbidity;
    lastValidReadingAt = millis();
    if (phValue < PH_CRITICAL_LOW || phValue > PH_CRITICAL_HIGH ||
        turbidityValue > TURBIDITY_CRITICAL) {
      emergencyLock = true;
      strncpy(controlMode, "emergency", sizeof(controlMode) - 1);
      writeRelay(false);
      Serial.println(F("LOCAL_EMERGENCY_STOP"));
    }
    Serial.print(F("{\"ph\":")); Serial.print(phValue, 2);
    Serial.print(F(",\"tds\":")); Serial.print(tdsValue, 2);
    Serial.print(F(",\"turbidity\":")); Serial.print(turbidityValue, 2);
    Serial.print(F(",\"sourceSequence\":")); Serial.print(++telemetrySequence);
    Serial.print(F(",\"sourceUptimeMs\":")); Serial.print(lastValidReadingAt);
    Serial.println(F(",\"calibrated\":true}"));
  } else {
    enforceLocalSafety();
    Serial.println(F("CALIBRATION_REQUIRED"));
  }
  updateIndicators();
}

void setup() {
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_YELLOW_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  if (DWMS_RELAY_CONTROL_ENABLED) {
    // Set the output latch before enabling output to avoid an active-low pulse.
    digitalWrite(RELAY_PIN, DWMS_RELAY_ACTIVE_LOW ? HIGH : LOW);
    pinMode(RELAY_PIN, OUTPUT);
  } else {
    // Unknown active polarity: keep the relay pin undriven until configured.
    pinMode(RELAY_PIN, INPUT);
  }
  pumpOn = false;
  Serial.begin(9600);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(F("DWMS Controller"));
  lcd.setCursor(0, 1);
  lcd.print(F("Safe startup"));
}

void loop() {
  enforceLocalSafety();
  readSerialCommands();
  const unsigned long now = millis();
  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = now;
    sampleAndSend();
  }
  if (now - lastStatusAt >= STATUS_INTERVAL_MS) {
    lastStatusAt = now;
    reportStatus();
  }
}
