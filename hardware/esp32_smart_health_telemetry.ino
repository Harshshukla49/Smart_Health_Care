/*
================================================================================
 SMART HEALTHCARE ESP32 REMOTE PATIENT MONITORING SYSTEM
 STAGE 1 TELEMETRY FIRMWARE WITH WI-FI PROVISIONING & FAULT TOLERANCE
================================================================================

 Hardware Pinout:
 ------------------------------------------------
 ESP32 Dev Module (Dual-Core 240MHz)

 MAX30102 Pulse Oximeter & Heart-Rate:
   SDA -> GPIO 21
   SCL -> GPIO 22
   VCC -> 3.3V
   GND -> GND

 AD8232 Single-Lead ECG:
   OUTPUT -> GPIO 34 (Analog In)
   LO+    -> GPIO 18 (Digital In)
   LO-    -> GPIO 19 (Digital In)
   3.3V   -> 3.3V
   GND    -> GND

 DS18B20 Body Temperature Sensor:
   DATA -> GPIO 4 (OneWire)
   VCC  -> 3.3V
   GND  -> GND
   4.7K Pull-up Resistor between DATA and 3.3V

 Status Indicator LED:
   LED  -> GPIO 2 (Built-in Blue LED)

 Target Cloud Ingestion Backend:
   https://smart-health-backend-2idf.onrender.com/api/esp32/update

 Security & Mapping Architecture:
 ------------------------------------------------
 1. DEVICE_ID is permanent and hardcoded to "DEVICE-001".
 2. Patient ID, Doctor ID, and passwords are NEVER hardcoded in firmware.
 3. Wi-Fi credentials are stored in ESP32 Flash (Preferences/NVS).
 4. If no Wi-Fi credentials exist or connection fails, the ESP32 starts an
    Access Point named "ESP32-DEVICE-001-SETUP" (Password: "12345678").
    Connect your phone/PC and open http://192.168.4.1 to configure Wi-Fi.
 5. When sensors are missing or disconnected, the ESP32 handles it gracefully
    without crashing or faking clinical measurements.
================================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>
#include <time.h>
#include <sys/time.h>
#include <math.h>

// ============================================================================
// PERMANENT HARDWARE IDENTIFICATION (Zero Patient Data)
// ============================================================================

const char* DEVICE_ID = "DEVICE-001";
const char* FIRMWARE_VERSION = "1.1.0";

// Device Token provided during initial device registration / pairing
// (Can be updated via portal or set to matching backend token hash)
const char* DEVICE_TOKEN = "sh_dev_token_5f240279f855cc0d94fa4915de12f802";

// Backend Ingestion Endpoint
const char* BACKEND_URL = "https://smart-health-backend-2idf.onrender.com/api/esp32/update";

// SoftAP Provisioning Defaults
const char* AP_SSID = "ESP32-DEVICE-001-SETUP";
const char* AP_PASS = "12345678";

// ============================================================================
// HARDWARE PIN CONFIGURATION
// ============================================================================

#define MAX30102_SDA    21
#define MAX30102_SCL    22
#define ECG_PIN         34
#define ECG_LO_PLUS     18
#define ECG_LO_MINUS    19
#define DS18B20_PIN     4
#define STATUS_LED      2

// ============================================================================
// TIMING INTERVALS
// ============================================================================

const unsigned long SENSOR_INTERVAL_MS      = 20;     // 50Hz sampling
const unsigned long TELEMETRY_INTERVAL_MS   = 2000;   // 2s cloud upload
const unsigned long TEMPERATURE_INTERVAL_MS = 1000;   // 1s temp sampling
const unsigned long WIFI_CHECK_INTERVAL_MS  = 10000;  // 10s Wi-Fi watchdog
const unsigned long NTP_RETRY_INTERVAL_MS   = 30000;  // 30s NTP sync retry

// ============================================================================
// SENSOR & SYSTEM OBJECTS
// ============================================================================

Preferences preferences;
WebServer server(80);

MAX30105 particleSensor;
OneWire oneWire(DS18B20_PIN);
DallasTemperature temperatureSensor(&oneWire);

bool max30102Ready  = false;
bool ds18b20Ready   = false;
bool inConfigPortal = false;
bool ntpSynchronized = false;

// ============================================================================
// TELEMETRY DATA STRUCTURE & THREAD SAFETY
// ============================================================================

struct VitalsTelemetry {
    float heartRate;
    float spo2;
    float temperature;
    int ecg;
    bool leadsOff;
    bool fingerDetected;
    char timestamp[32];
};

VitalsTelemetry currentVitals = { 0.0, 0.0, 0.0, 0, true, false, "" };
SemaphoreHandle_t vitalsMutex = NULL;

// Heart rate averaging buffer
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
byte validRateCount = 0;
long lastBeat = 0;
float beatsPerMinute = 0.0;

unsigned long lastTempRead = 0;
unsigned long lastTelemetryUpload = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastNtpRetry = 0;
unsigned int authFailureCount = 0;

// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================

void loadOrStartProvisioning();
void startConfigPortal();
void handlePortalRoot();
void handlePortalSave();
void handlePortalReset();
void connectToWiFi(String ssid, String pass);
void synchronizeTime();
void getFormattedTimestamp(char* buffer, size_t maxLen);
void initializeSensors();
void readPulseAndSpO2();
void readTemperature();
void readECG();
bool sendTelemetryPacket(const VitalsTelemetry& data);
void updateLED();
void sensorTask(void* parameter);
void cloudTask(void* parameter);

// ============================================================================
// SETUP
// ============================================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("==================================================");
    Serial.println(" SMART HEALTHCARE ESP32 RPM FIRMWARE (STAGE 1)");
    Serial.printf(" Device ID: %s | Firmware: %s\n", DEVICE_ID, FIRMWARE_VERSION);
    Serial.println("==================================================");

    // Initialize GPIO Pins
    pinMode(STATUS_LED, OUTPUT);
    digitalWrite(STATUS_LED, LOW);

    pinMode(ECG_LO_PLUS, INPUT);
    pinMode(ECG_LO_MINUS, INPUT);
    analogReadResolution(12);

    // Initialize I2C Bus for MAX30102
    Wire.begin(MAX30102_SDA, MAX30102_SCL);
    Wire.setClock(400000);

    // Create Mutex for thread-safe vitals buffer access
    vitalsMutex = xSemaphoreCreateMutex();
    if (vitalsMutex == NULL) {
        Serial.println("[CRITICAL] Failed to create FreeRTOS mutex! Halting.");
        while (true) { delay(1000); }
    }

    // Initialize Attached Sensors (Fault-tolerant)
    initializeSensors();

    // Check saved Wi-Fi credentials or launch Captive Provisioning Portal
    loadOrStartProvisioning();

    if (!inConfigPortal) {
        // Synchronize NTP Real-World Time
        synchronizeTime();

        // Launch Core 1: Sensor Acquisition Task (High Priority)
        xTaskCreatePinnedToCore(
            sensorTask,
            "SensorTask",
            4096,
            NULL,
            2,
            NULL,
            1
        );

        // Launch Core 0: Cloud HTTPS Telemetry Task (Medium Priority)
        xTaskCreatePinnedToCore(
            cloudTask,
            "CloudTask",
            10240,
            NULL,
            1,
            NULL,
            0
        );

        Serial.println("[SYSTEM] Multi-threaded telemetry engine ACTIVE.");
    }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
    if (inConfigPortal) {
        server.handleClient();
        // Fast blink LED in Provisioning Mode
        digitalWrite(STATUS_LED, (millis() / 200) % 2);
    } else {
        updateLED();
        delay(100);
    }
}

// ============================================================================
// WI-FI PROVISIONING & PREFERENCES
// ============================================================================

void loadOrStartProvisioning() {
    preferences.begin("smart_health", false);
    String savedSSID = preferences.getString("wifi_ssid", "");
    String savedPass = preferences.getString("wifi_pass", "");

    if (savedSSID.length() == 0) {
        Serial.println("[WIFI] No saved Wi-Fi credentials found in Flash NVS.");
        startConfigPortal();
    } else {
        Serial.printf("[WIFI] Connecting to saved network: '%s'...\n", savedSSID.c_str());
        connectToWiFi(savedSSID, savedPass);

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[WIFI] Failed to connect to saved network. Starting Setup AP Portal...");
            startConfigPortal();
        }
    }
}

void startConfigPortal() {
    inConfigPortal = true;
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASS);

    IPAddress ip = WiFi.softAPIP();
    Serial.println("==================================================");
    Serial.println(" WI-FI PROVISIONING AP ACTIVE");
    Serial.printf(" Connect to Wi-Fi SSID: %s\n", AP_SSID);
    Serial.printf(" Password:              %s\n", AP_PASS);
    Serial.printf(" Web Portal URL:        http://%s\n", ip.toString().c_str());
    Serial.println("==================================================");

    server.on("/", HTTP_GET, handlePortalRoot);
    server.on("/save", HTTP_POST, handlePortalSave);
    server.on("/reset", HTTP_POST, handlePortalReset);
    server.begin();
}

void handlePortalRoot() {
    String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>Smart Health Device Setup</title>";
    html += "<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px;}";
    html += ".card{background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;max-width:400px;width:100%;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);}";
    html += "h2{margin-top:0;color:#0284c7;font-size:22px;display:flex;align-items:center;gap:8px;}";
    html += ".badge{display:inline-block;background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;margin-bottom:20px;}";
    html += "label{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px;text-transform:uppercase;}";
    html += "input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #cbd5e1;border-radius:12px;font-size:14px;margin-bottom:18px;}";
    html += "input:focus{outline:none;border-color:#0284c7;box-shadow:0 0 0 3px rgba(2,132,199,0.15);}";
    html += "button{width:100%;background:#0284c7;color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;transition:background 0.2s;}";
    html += "button:hover{background:#0369a1;}";
    html += ".hint{font-size:12px;color:#64748b;margin-top:16px;text-align:center;line-height:1.4;}</style></head>";
    html += "<body><div class='card'>";
    html += "<h2>Smart Health RPM</h2>";
    html += "<div class='badge'>Device ID: " + String(DEVICE_ID) + "</div>";
    html += "<form method='POST' action='/save'>";
    html += "<label>Wi-Fi Network Name (SSID)</label><input type='text' name='ssid' placeholder='e.g. Hospital_Guest' required>";
    html += "<label>Wi-Fi Password</label><input type='password' name='pass' placeholder='Wi-Fi Password'>";
    html += "<button type='submit'>Save & Connect</button>";
    html += "</form>";
    html += "<p class='hint'>Once saved, the device will connect to your Wi-Fi and stream patient telemetry automatically.</p>";
    html += "</div></body></html>";
    server.send(200, "text/html", html);
}

void handlePortalSave() {
    String ssid = server.arg("ssid");
    String pass = server.arg("pass");

    if (ssid.length() > 0) {
        preferences.putString("wifi_ssid", ssid);
        preferences.putString("wifi_pass", pass);

        String resp = "<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;padding:50px;'>";
        resp += "<h2 style='color:#16a34a;'>Settings Saved!</h2>";
        resp += "<p>Connecting to <strong>" + ssid + "</strong>. The device is now rebooting...</p></body></html>";
        server.send(200, "text/html", resp);

        delay(2000);
        ESP.restart();
    } else {
        server.send(400, "text/plain", "Error: SSID cannot be empty.");
    }
}

void handlePortalReset() {
    preferences.remove("wifi_ssid");
    preferences.remove("wifi_pass");
    server.send(200, "text/plain", "Wi-Fi credentials erased. Rebooting into AP mode...");
    delay(1000);
    ESP.restart();
}

void connectToWiFi(String ssid, String pass) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[WIFI] Connected Successfully!");
        Serial.printf("[WIFI] IP Assigned: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println("[WIFI] Failed to connect within timeout.");
    }
}

// ============================================================================
// NTP TIME SYNCHRONIZATION
// ============================================================================

void synchronizeTime() {
    if (WiFi.status() != WL_CONNECTED) return;

    Serial.println("[NTP] Synchronizing UTC time via pool.ntp.org...");
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");

    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5000)) {
        ntpSynchronized = true;
        char timeBuf[32];
        strftime(timeBuf, sizeof(timeBuf), "%Y-%m-%d %H:%M:%S", &timeinfo);
        Serial.printf("[NTP] Time Synchronized: %s UTC\n", timeBuf);
    } else {
        ntpSynchronized = false;
        Serial.println("[NTP] Time sync failed. Will retry in background.");
    }
}

void getFormattedTimestamp(char* buffer, size_t maxLen) {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 100)) {
        strftime(buffer, maxLen, "%Y-%m-%d %H:%M:%S", &timeinfo);
    } else {
        snprintf(buffer, maxLen, "BOOT+%lu_SEC", (unsigned long)(millis() / 1000));
    }
}

// ============================================================================
// SENSOR INITIALIZATION & FAULT TOLERANCE
// ============================================================================

void initializeSensors() {
    Serial.println("[SENSORS] Initializing attached medical sensors...");

    // 1. MAX30102
    if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        particleSensor.setup();
        particleSensor.setPulseAmplitudeRed(0x1F);
        particleSensor.setPulseAmplitudeGreen(0);
        max30102Ready = true;
        Serial.println("[SENSORS] MAX30102 Pulse Oximeter OK.");
    } else {
        max30102Ready = false;
        Serial.println("[SENSORS] MAX30102 NOT DETECTED! Proceeding with fault-tolerant degraded mode.");
    }

    // 2. DS18B20
    temperatureSensor.begin();
    if (temperatureSensor.getDeviceCount() > 0) {
        ds18b20Ready = true;
        temperatureSensor.setWaitForConversion(false);
        Serial.printf("[SENSORS] DS18B20 Temp Sensor OK (%d devices found).\n", temperatureSensor.getDeviceCount());
    } else {
        ds18b20Ready = false;
        Serial.println("[SENSORS] DS18B20 NOT DETECTED! Will retry dynamically.");
    }

    // 3. AD8232 ECG Leads check
    int loPlus = digitalRead(ECG_LO_PLUS);
    int loMinus = digitalRead(ECG_LO_MINUS);
    Serial.printf("[SENSORS] AD8232 ECG Initial State: LO+ = %d, LO- = %d\n", loPlus, loMinus);
}

// ============================================================================
// SENSOR READING IMPLEMENTATION (Core 1)
// ============================================================================

void readPulseAndSpO2() {
    if (!max30102Ready) {
        // Try reconnecting MAX30102 periodically without blocking
        static unsigned long lastInitAttempt = 0;
        if (millis() - lastInitAttempt > 5000) {
            lastInitAttempt = millis();
            if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
                particleSensor.setup();
                max30102Ready = true;
                Serial.println("[SENSORS] MAX30102 successfully hot-plugged!");
            }
        }
        return;
    }

    long irValue = particleSensor.getIR();
    long redValue = particleSensor.getRed();

    if (irValue < 50000) {
        // No finger on sensor
        beatsPerMinute = 0.0;
        validRateCount = 0;

        if (xSemaphoreTake(vitalsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            currentVitals.heartRate = 0.0;
            currentVitals.spo2 = 0.0;
            currentVitals.fingerDetected = false;
            xSemaphoreGive(vitalsMutex);
        }
        return;
    }

    // Finger detected
    if (checkForBeat(irValue)) {
        long delta = millis() - lastBeat;
        lastBeat = millis();

        float bpm = 60.0 / (delta / 1000.0);
        if (bpm >= 40.0 && bpm <= 220.0) {
            rates[rateSpot++] = (byte)bpm;
            rateSpot %= RATE_SIZE;
            if (validRateCount < RATE_SIZE) validRateCount++;

            int total = 0;
            for (byte i = 0; i < validRateCount; i++) {
                total += rates[i];
            }
            beatsPerMinute = (float)total / (float)validRateCount;
        }
    }

    // Calculate approximate SpO2 ratio
    float calculatedSpo2 = 0.0;
    if (irValue > 0 && redValue > 0) {
        float ratio = ((float)redValue / (float)irValue);
        calculatedSpo2 = 110.0 - (25.0 * ratio);
        if (calculatedSpo2 > 100.0) calculatedSpo2 = 99.0;
        if (calculatedSpo2 < 70.0) calculatedSpo2 = 70.0;
    }

    if (xSemaphoreTake(vitalsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        currentVitals.heartRate = beatsPerMinute;
        currentVitals.spo2 = (beatsPerMinute > 0) ? calculatedSpo2 : 0.0;
        currentVitals.fingerDetected = true;
        xSemaphoreGive(vitalsMutex);
    }
}

void readTemperature() {
    if (millis() - lastTempRead < TEMPERATURE_INTERVAL_MS) return;
    lastTempRead = millis();

    temperatureSensor.requestTemperatures();
    float tempC = temperatureSensor.getTempCByIndex(0);

    if (tempC == DEVICE_DISCONNECTED_C || tempC < -50.0 || tempC > 85.0) {
        ds18b20Ready = false;
        tempC = 0.0; // Report 0.0 if sensor is disconnected
    } else {
        ds18b20Ready = true;
    }

    if (xSemaphoreTake(vitalsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        currentVitals.temperature = tempC;
        xSemaphoreGive(vitalsMutex);
    }
}

void readECG() {
    bool leadsOff = (digitalRead(ECG_LO_PLUS) == 1 || digitalRead(ECG_LO_MINUS) == 1);
    int ecgValue = 0;

    if (!leadsOff) {
        ecgValue = analogRead(ECG_PIN);
    }

    if (xSemaphoreTake(vitalsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        currentVitals.leadsOff = leadsOff;
        currentVitals.ecg = ecgValue;
        xSemaphoreGive(vitalsMutex);
    }
}

// ============================================================================
// CLOUD TELEMETRY TRANSMISSION (Core 0)
// ============================================================================

bool sendTelemetryPacket(const VitalsTelemetry& data) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[TELEMETRY] Cannot send: Wi-Fi disconnected.");
        return false;
    }

    WiFiClientSecure client;
    client.setInsecure(); // Prototype SSL verification; for production, pass root CA cert.

    HTTPClient http;
    http.begin(client, BACKEND_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-ID", DEVICE_ID);
    http.addHeader("X-Device-Token", DEVICE_TOKEN);
    http.setTimeout(4000);

    StaticJsonDocument<384> doc;
    doc["heartRate"]      = round(data.heartRate * 10.0) / 10.0;
    doc["spo2"]           = round(data.spo2 * 10.0) / 10.0;
    doc["temperature"]    = round(data.temperature * 10.0) / 10.0;
    doc["ecg"]            = data.ecg;
    doc["leadsOff"]       = data.leadsOff;
    doc["fingerDetected"] = data.fingerDetected;
    doc["timestamp"]      = data.timestamp;
    doc["firmwareVersion"]= FIRMWARE_VERSION;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = http.POST(requestBody);

    if (httpCode == 200 || httpCode == 201) {
        Serial.printf("[TELEMETRY] Sent OK: HR=%.1f SpO2=%.1f Temp=%.1f ECG=%d | LeadsOff=%d\n",
                      data.heartRate, data.spo2, data.temperature, data.ecg, data.leadsOff);
        authFailureCount = 0;
        http.end();
        return true;
    } else {
        String response = http.getString();
        Serial.printf("[TELEMETRY] HTTP %d: %s\n", httpCode, response.c_str());
        if (httpCode == 401 || httpCode == 403) {
            authFailureCount++;
            if (authFailureCount >= 5) {
                Serial.println("[AUTH WARNING] Consecutive auth failures. Verify device token in backend!");
            }
        }
        http.end();
        return false;
    }
}

void updateLED() {
    if (WiFi.status() == WL_CONNECTED) {
        // Slow heartbeat pulse when connected and transmitting
        bool pulse = ((millis() / 1000) % 2 == 0);
        digitalWrite(STATUS_LED, pulse ? HIGH : LOW);
    } else {
        // Double blink when Wi-Fi is lost
        int cycle = (millis() / 150) % 8;
        digitalWrite(STATUS_LED, (cycle == 0 || cycle == 2) ? HIGH : LOW);
    }
}

// ============================================================================
// FREERTOS TASKS
// ============================================================================

void sensorTask(void* parameter) {
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(SENSOR_INTERVAL_MS);

    for (;;) {
        readPulseAndSpO2();
        readTemperature();
        readECG();

        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

void cloudTask(void* parameter) {
    for (;;) {
        // Wi-Fi Connection Watchdog
        if (millis() - lastWiFiCheck > WIFI_CHECK_INTERVAL_MS) {
            lastWiFiCheck = millis();
            if (WiFi.status() != WL_CONNECTED) {
                Serial.println("[WATCHDOG] Wi-Fi lost. Attempting reconnect...");
                WiFi.reconnect();
            }
        }

        // NTP Sync Retry
        if (!ntpSynchronized && (millis() - lastNtpRetry > NTP_RETRY_INTERVAL_MS)) {
            lastNtpRetry = millis();
            synchronizeTime();
        }

        // Send telemetry packet at defined interval
        if (millis() - lastTelemetryUpload >= TELEMETRY_INTERVAL_MS) {
            lastTelemetryUpload = millis();

            VitalsTelemetry snapshot;
            if (xSemaphoreTake(vitalsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                snapshot = currentVitals;
                getFormattedTimestamp(snapshot.timestamp, sizeof(snapshot.timestamp));
                xSemaphoreGive(vitalsMutex);

                sendTelemetryPacket(snapshot);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
