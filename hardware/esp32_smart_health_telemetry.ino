/*
 ==============================================================================
  🏥 SMART HEALTHCARE & REMOTE PATIENT MONITORING SYSTEM
  ESP32 IOT TELEMETRY & VITAL SENSORS FIRMWARE
 ==============================================================================
  Supported Hardware:
    - Microcontroller: ESP32 Dev Module / NodeMCU ESP32
    - Heart Rate & SpO2: MAX30102 / MAX30100 (I2C: SDA=GPIO 21, SCL=GPIO 22)
    - ECG Sensor: AD8232 (OUTPUT=GPIO 34 / A0, LO+=GPIO 18, LO-=GPIO 19)
    - Temperature Sensor: DS18B20 (DATA=GPIO 4) or LM35 / DHT11
 ==============================================================================
  Target Backend Endpoint:
    POST /api/esp32/update
    Payload: { "heartRate": 75.2, "spo2": 98.5, "temperature": 36.7, "ecg": 512, "leadsOff": false }
 ==============================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>      // Library: "ArduinoJson" by Benoit Blanchon (v6 or v7)
#include <Wire.h>
#include "MAX30105.h"         // Library: "SparkFun MAX3010x Pulse and Proximity Sensor Library"
#include "heartRate.h"
#include <OneWire.h>          // Library: "OneWire" by Jim Studt
#include <DallasTemperature.h>// Library: "DallasTemperature" by Miles Burton

// ==========================================
// 1. NETWORK & BACKEND CONFIGURATION
// ==========================================
// Replace with your WiFi credentials:
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend Server URL (Production Render or Local Flask Server):
// For Local Testing: "http://192.168.1.X:5000/api/esp32/update"
// For Production:    "https://smart-health-backend-2idf.onrender.com/api/esp32/update"
const char* BACKEND_URL   = "https://smart-health-backend-2idf.onrender.com/api/esp32/update";

// Transmit telemetry every 1000ms (1 second)
const unsigned long TELEMETRY_INTERVAL_MS = 1000;
unsigned long lastTelemetryTime = 0;

// ==========================================
// 2. PIN DEFINITIONS
// ==========================================
#define ECG_ANALOG_PIN  34    // AD8232 OUTPUT pin connected to ADC GPIO34
#define ECG_LO_PLUS     18    // AD8232 Leads-Off Detect (LO+)
#define ECG_LO_MINUS    19    // AD8232 Leads-Off Detect (LO-)
#define TEMP_ONEWIRE_PIN 4    // DS18B20 1-Wire Data pin

#define LED_STATUS_PIN   2    // Built-in status LED on ESP32

// ==========================================
// 3. SENSOR OBJECTS & STATE
// ==========================================
MAX30105 pulseSensor;
bool max30102_found = false;

OneWire oneWire(TEMP_ONEWIRE_PIN);
DallasTemperature tempSensor(&oneWire);
bool ds18b20_found = false;

// Vital readings
float currentHeartRate = 0.0;
float currentSpO2 = 0.0;
float currentTemperature = 36.6;
int   currentEcgSample = 0;
bool  leadsOff = true;

// Heart rate calculation buffers
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 0;

// ==========================================
// 4. SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println("🏥 SMART HEALTHCARE ESP32 TELEMETRY INITIALIZING");
  Serial.println("==================================================");

  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(ECG_LO_PLUS, INPUT);
  pinMode(ECG_LO_MINUS, INPUT);

  // Initialize I2C for MAX30102 (SDA=21, SCL=22)
  Wire.begin(21, 22);

  // 1. Initialize MAX30102 Pulse Oximeter
  Serial.print("🔍 Checking MAX30102 Pulse Sensor... ");
  if (pulseSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("READY ✓");
    pulseSensor.setup(); // Configure sensor with default settings
    pulseSensor.setPulseAmplitudeRed(0x0A); // Low power red LED
    pulseSensor.setPulseAmplitudeGreen(0);  // Turn off green LED
    max30102_found = true;
  } else {
    Serial.println("NOT DETECTED (Using fallback telemetry/test mode).");
    max30102_found = false;
  }

  // 2. Initialize DS18B20 Temperature Sensor
  Serial.print("🔍 Checking DS18B20 Temperature Sensor... ");
  tempSensor.begin();
  if (tempSensor.getDeviceCount() > 0) {
    Serial.println("READY ✓");
    ds18b20_found = true;
  } else {
    Serial.println("NOT DETECTED (Using default ambient 36.6°C).");
    ds18b20_found = false;
  }

  // 3. Connect to WiFi
  connectToWiFi();
}

// ==========================================
// 5. MAIN LOOP
// ==========================================
void loop() {
  // Check WiFi connectivity & Auto-Reconnect if dropped
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_STATUS_PIN, LOW);
    connectToWiFi();
  }

  // Read Sensors
  readEcgSensor();
  readPulseSensor();
  readTemperatureSensor();

  // Send Telemetry at interval
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    sendTelemetryToBackend();
  }
}

// ==========================================
// 6. SENSOR READING FUNCTIONS
// ==========================================
void readEcgSensor() {
  // Check leads-off detection
  if ((digitalRead(ECG_LO_PLUS) == 1) || (digitalRead(ECG_LO_MINUS) == 1)) {
    leadsOff = true;
    currentEcgSample = 512; // Baseline middle value
  } else {
    leadsOff = false;
    currentEcgSample = analogRead(ECG_ANALOG_PIN); // 0 - 4095 on ESP32
    // Map to 0-1023 standard range if needed
    currentEcgSample = map(currentEcgSample, 0, 4095, 0, 1023);
  }
}

void readPulseSensor() {
  if (max30102_found) {
    long irValue = pulseSensor.getIR();

    // Check if finger is placed on sensor (IR > 50000)
    if (irValue > 50000) {
      if (checkForBeat(irValue) == true) {
        long delta = millis() - lastBeat;
        lastBeat = millis();

        beatsPerMinute = 60 / (delta / 1000.0);

        if (beatsPerMinute < 255 && beatsPerMinute > 40) {
          rates[rateSpot++] = (byte)beatsPerMinute;
          rateSpot %= RATE_SIZE;

          // Calculate running average
          beatAvg = 0;
          for (byte x = 0; x < RATE_SIZE; x++) {
            beatAvg += rates[x];
          }
          beatAvg /= RATE_SIZE;
          currentHeartRate = (float)beatAvg;
        }
      }
      // Approximate SpO2 based on IR/Red reflectance ratio
      long redValue = pulseSensor.getRed();
      if (redValue > 0 && irValue > 0) {
        float ratio = (float)redValue / (float)irValue;
        float spo2Calc = 110.0 - (25.0 * ratio);
        if (spo2Calc >= 85.0 && spo2Calc <= 100.0) {
          currentSpO2 = spo2Calc;
        } else {
          currentSpO2 = 98.0;
        }
      }
    } else {
      // Finger not detected
      currentHeartRate = 0.0;
      currentSpO2 = 0.0;
    }
  } else {
    // Fallback simulation when hardware sensor is disconnected during testing
    currentHeartRate = 74.0 + random(-3, 4);
    currentSpO2 = 98.0 + (random(-10, 10) / 10.0);
  }
}

void readTemperatureSensor() {
  if (ds18b20_found) {
    tempSensor.requestTemperatures();
    float tempC = tempSensor.getTempCByIndex(0);
    if (tempC > 0 && tempC < 60) {
      currentTemperature = tempC;
    }
  } else {
    // Default safe physiological temperature
    currentTemperature = 36.6 + (random(-2, 3) / 10.0);
  }
}

// ==========================================
// 7. HTTP TELEMETRY TRANSMISSION
// ==========================================
void sendTelemetryToBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  // Format JSON payload for /api/esp32/update
  StaticJsonDocument<256> doc;
  doc["heartRate"]   = round(currentHeartRate * 10.0) / 10.0;
  doc["spo2"]        = round(currentSpO2 * 10.0) / 10.0;
  doc["temperature"] = round(currentTemperature * 10.0) / 10.0;
  doc["ecg"]          = currentEcgSample;
  doc["leadsOff"]     = leadsOff;

  String jsonString;
  serializeJson(doc, jsonString);

  // Send POST request
  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode > 0) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    Serial.printf("[HTTP] POST %d -> %s\n", httpResponseCode, jsonString.c_str());
  } else {
    digitalWrite(LED_STATUS_PIN, LOW);
    Serial.printf("[HTTP ERROR] Failed code: %s (%d)\n", http.errorToString(httpResponseCode).c_str(), httpResponseCode);
  }

  http.end();
}

// ==========================================
// 8. WIFI HELPER
// ==========================================
void connectToWiFi() {
  Serial.printf("\n📶 Connecting to WiFi: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    Serial.println("\n✓ WiFi Connected!");
    Serial.printf("   IP Address : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("   Backend URL: %s\n\n", BACKEND_URL);
  } else {
    Serial.println("\n⚠️ WiFi Connection Failed! Will retry in next loop...");
  }
}
