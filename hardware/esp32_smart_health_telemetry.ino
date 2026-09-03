/*
================================================================================

 SMART HEALTHCARE ESP32 REMOTE MONITORING SYSTEM
 FINAL ESP32 TELEMETRY FIRMWARE

 Hardware:
 ------------------------------------------------
 ESP32 Dev Module

 MAX30102:
 SDA -> GPIO 21
 SCL -> GPIO 22
 VCC -> 3.3V
 GND -> GND

 AD8232 ECG:
 OUTPUT -> GPIO 34
 LO+    -> GPIO 18
 LO-    -> GPIO 19
 3.3V   -> 3.3V
 GND    -> GND

 DS18B20:
 DATA -> GPIO 4
 VCC  -> 3.3V
 GND  -> GND
 4.7K resistor between DATA and 3.3V

 LED:
 GPIO 2

 Backend:
 https://smart-health-backend-2idf.onrender.com/api/esp32/update

================================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

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
// WIFI CONFIGURATION
// ============================================================================

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";


// ============================================================================
// BACKEND CONFIGURATION
// ============================================================================

const char* BACKEND_URL =
"https://smart-health-backend-2idf.onrender.com/api/esp32/update";


// ============================================================================
// DEVICE AUTHENTICATION
// ============================================================================

// IMPORTANT:
// Put the exact Device ID from your Firebase/backend.

const char* DEVICE_ID = "DEVICE-001";


// IMPORTANT:
// Put the COMPLETE token in ONE LINE.
// DO NOT press Enter inside the token.

const char* DEVICE_TOKEN =
"sh_dev_token_5f240279f855cc0d94fa4915de12f802";


// ============================================================================
// PIN CONFIGURATION
// ============================================================================

#define MAX30102_SDA 21
#define MAX30102_SCL 22

#define ECG_PIN 34
#define ECG_LO_PLUS 18
#define ECG_LO_MINUS 19

#define DS18B20_PIN 4

#define STATUS_LED 2


// ============================================================================
// TIMING CONFIGURATION
// ============================================================================

const unsigned long SENSOR_INTERVAL_MS = 20;
const unsigned long TELEMETRY_INTERVAL_MS = 2000;
const unsigned long TEMPERATURE_INTERVAL_MS = 1000;
const unsigned long WIFI_CHECK_INTERVAL_MS = 10000;
const unsigned long NTP_RETRY_INTERVAL_MS = 30000;


// ============================================================================
// SENSOR OBJECTS
// ============================================================================

MAX30105 particleSensor;

OneWire oneWire(DS18B20_PIN);

DallasTemperature temperatureSensor(&oneWire);


// ============================================================================
// SENSOR STATUS
// ============================================================================

bool max30102Ready = false;
bool ds18b20Ready = false;


// ============================================================================
// VITALS STRUCTURE
// ============================================================================

struct VitalsTelemetry
{
    float heartRate;
    float spo2;
    float temperature;

    int ecg;

    bool leadsOff;
    bool fingerDetected;

    unsigned long long timestamp;
};


// ============================================================================
// GLOBAL VITALS
// ============================================================================

VitalsTelemetry currentVitals =
{
    0.0,
    0.0,
    0.0,
    0,
    true,
    false,
    0
};


// ============================================================================
// FREERTOS MUTEX
// ============================================================================

SemaphoreHandle_t vitalsMutex;


// ============================================================================
// HEART RATE VARIABLES
// ============================================================================

const byte RATE_SIZE = 4;

byte rates[RATE_SIZE];

byte rateSpot = 0;

byte validRateCount = 0;

long lastBeat = 0;

float beatsPerMinute = 0.0;


// ============================================================================
// CLOUD VARIABLES
// ============================================================================

unsigned long nextAllowedUploadTime = 0;

unsigned long lastWiFiCheck = 0;

unsigned long lastNtpRetry = 0;

unsigned int authFailureCount = 0;

bool ntpSynchronized = false;


// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================

void connectWiFi();

void synchronizeTime();

void initializeSensors();

void sensorTask(void* parameter);

void cloudTask(void* parameter);

void readECG();

void readPulse();

void readTemperature();

bool sendTelemetryPacket(const VitalsTelemetry& data);

void updateLED();

unsigned long long getTimestampMs();


// ============================================================================
// SETUP
// ============================================================================

void setup()
{
    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println("==========================================");
    Serial.println("SMART HEALTHCARE ESP32 STARTING");
    Serial.println("==========================================");


    // LED

    pinMode(STATUS_LED, OUTPUT);

    digitalWrite(STATUS_LED, LOW);


    // ECG

    pinMode(ECG_LO_PLUS, INPUT);

    pinMode(ECG_LO_MINUS, INPUT);


    // ADC Configuration

    analogReadResolution(12);


    // I2C

    Wire.begin(MAX30102_SDA, MAX30102_SCL);

    Wire.setClock(400000);


    // Mutex

    vitalsMutex = xSemaphoreCreateMutex();

    if (vitalsMutex == NULL)
    {
        Serial.println("ERROR: Failed to create mutex!");

        while (true)
        {
            delay(1000);
        }
    }


    // Initialize Sensors

    initializeSensors();


    // WiFi

    connectWiFi();


    // NTP Time

    synchronizeTime();


    // Sensor Task
    // Core 1

    xTaskCreatePinnedToCore(
        sensorTask,
        "SensorTask",
        4096,
        NULL,
        2,
        NULL,
        1
    );


    // Cloud Task
    // Core 0

    xTaskCreatePinnedToCore(
        cloudTask,
        "CloudTask",
        10240,
        NULL,
        1,
        NULL,
        0
    );


    Serial.println("==========================================");
    Serial.println("SYSTEM READY");
    Serial.println("==========================================");
}


// ============================================================================
// MAIN LOOP
// ============================================================================

void loop()
{
    updateLED();

    delay(100);
}


// ============================================================================
// WIFI CONNECTION
// ============================================================================

void connectWiFi()
{
    Serial.println();
    Serial.print("Connecting WiFi: ");
    Serial.println(WIFI_SSID);


    WiFi.mode(WIFI_STA);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);


    int attempts = 0;


    while (WiFi.status() != WL_CONNECTED && attempts < 30)
    {
        delay(500);

        Serial.print(".");

        attempts++;
    }


    Serial.println();


    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("WiFi Connected!");

        Serial.print("IP Address: ");

        Serial.println(WiFi.localIP());
    }
    else
    {
        Serial.println("WiFi connection failed.");
    }
}


// ============================================================================
// NTP TIME SYNCHRONIZATION
// ============================================================================

void synchronizeTime()
{
    if (WiFi.status() != WL_CONNECTED)
    {
        return;
    }


    Serial.println("Synchronizing NTP time...");


    configTime(
        0,
        0,
        "pool.ntp.org",
        "time.nist.gov"
    );


    struct tm timeinfo;


    if (getLocalTime(&timeinfo, 5000))
    {
        ntpSynchronized = true;

        Serial.println("NTP Time synchronized.");
    }
    else
    {
        ntpSynchronized = false;

        Serial.println("NTP synchronization failed.");
    }
}


// ============================================================================
// SENSOR INITIALIZATION
// ============================================================================

void initializeSensors()
{
    // --------------------------------------------------------
    // MAX30102
    // --------------------------------------------------------

    Serial.println("Initializing MAX30102...");


    if (particleSensor.begin(Wire, I2C_SPEED_FAST))
    {
        Serial.println("MAX30102 detected.");

        byte ledBrightness = 60;

        byte sampleAverage = 4;

        byte ledMode = 2;

        int sampleRate = 100;

        int pulseWidth = 411;

        int adcRange = 4096;


        particleSensor.setup(
            ledBrightness,
            sampleAverage,
            ledMode,
            sampleRate,
            pulseWidth,
            adcRange
        );


        particleSensor.setPulseAmplitudeRed(0x1F);

        particleSensor.setPulseAmplitudeIR(0x1F);

        particleSensor.setPulseAmplitudeGreen(0);


        max30102Ready = true;
    }
    else
    {
        Serial.println("MAX30102 NOT FOUND.");

        max30102Ready = false;
    }


    // --------------------------------------------------------
    // DS18B20
    // --------------------------------------------------------

    Serial.println("Initializing DS18B20...");


    temperatureSensor.begin();


    int devices = temperatureSensor.getDeviceCount();


    if (devices > 0)
    {
        Serial.println("DS18B20 detected.");

        temperatureSensor.setResolution(10);

        temperatureSensor.setWaitForConversion(false);

        temperatureSensor.requestTemperatures();


        ds18b20Ready = true;
    }
    else
    {
        Serial.println("DS18B20 NOT FOUND.");

        ds18b20Ready = false;
    }


    // --------------------------------------------------------
    // ECG
    // --------------------------------------------------------

    Serial.println("AD8232 ECG initialized.");
}


// ============================================================================
// SENSOR TASK
// ============================================================================

void sensorTask(void* parameter)
{
    TickType_t lastWakeTime = xTaskGetTickCount();

    unsigned long lastTemperatureRead = 0;


    while (true)
    {
        // ECG

        readECG();


        // Pulse

        readPulse();


        // Temperature every second

        unsigned long now = millis();


        if (now - lastTemperatureRead >= TEMPERATURE_INTERVAL_MS)
        {
            lastTemperatureRead = now;

            readTemperature();
        }


        // Maintain 50Hz

        vTaskDelayUntil(
            &lastWakeTime,
            pdMS_TO_TICKS(SENSOR_INTERVAL_MS)
        );
    }
}


// ============================================================================
// CLOUD TASK
// ============================================================================

void cloudTask(void* parameter)
{
    while (true)
    {
        unsigned long now = millis();


        // ----------------------------------------------------
        // WIFI CHECK
        // ----------------------------------------------------

        if (WiFi.status() != WL_CONNECTED)
        {
            if (now - lastWiFiCheck >= WIFI_CHECK_INTERVAL_MS)
            {
                lastWiFiCheck = now;

                Serial.println("WiFi disconnected. Reconnecting...");

                WiFi.disconnect();

                WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            }
        }


        // ----------------------------------------------------
        // NTP RETRY
        // ----------------------------------------------------

        if (
            WiFi.status() == WL_CONNECTED &&
            !ntpSynchronized
        )
        {
            if (now - lastNtpRetry >= NTP_RETRY_INTERVAL_MS)
            {
                lastNtpRetry = now;

                synchronizeTime();
            }
        }


        // ----------------------------------------------------
        // TELEMETRY UPLOAD
        // ----------------------------------------------------

        if (
            WiFi.status() == WL_CONNECTED &&
            now >= nextAllowedUploadTime
        )
        {
            VitalsTelemetry snapshot;


            if (
                xSemaphoreTake(
                    vitalsMutex,
                    pdMS_TO_TICKS(50)
                ) == pdTRUE
            )
            {
                snapshot = currentVitals;

                snapshot.timestamp = getTimestampMs();


                xSemaphoreGive(vitalsMutex);


                sendTelemetryPacket(snapshot);
            }
        }


        vTaskDelay(
            pdMS_TO_TICKS(
                TELEMETRY_INTERVAL_MS
            )
        );
    }
}


// ============================================================================
// ECG SENSOR
// ============================================================================

void readECG()
{
    bool leadsOff = false;

    int ecgValue = 0;


    if (
        digitalRead(ECG_LO_PLUS) == HIGH ||
        digitalRead(ECG_LO_MINUS) == HIGH
    )
    {
        leadsOff = true;

        ecgValue = 0;
    }
    else
    {
        leadsOff = false;


        int rawValue = analogRead(ECG_PIN);


        ecgValue = map(
            rawValue,
            0,
            4095,
            0,
            1023
        );
    }


    if (
        xSemaphoreTake(
            vitalsMutex,
            pdMS_TO_TICKS(5)
        ) == pdTRUE
    )
    {
        currentVitals.ecg = ecgValue;

        currentVitals.leadsOff = leadsOff;


        xSemaphoreGive(vitalsMutex);
    }
}


// ============================================================================
// MAX30102 HEART RATE + SPO2
// ============================================================================

void readPulse()
{
    if (!max30102Ready)
    {
        return;
    }


    long irValue = particleSensor.getIR();


    // Finger detection threshold

    if (irValue > 50000)
    {
        float localHeartRate = 0.0;


        // ----------------------------------------------------
        // HEART RATE
        // ----------------------------------------------------

        if (checkForBeat(irValue))
        {
            long currentTime = millis();


            long delta = currentTime - lastBeat;


            lastBeat = currentTime;


            if (delta > 0)
            {
                beatsPerMinute =
                    60.0 /
                    (delta / 1000.0);


                if (
                    beatsPerMinute >= 40 &&
                    beatsPerMinute <= 220
                )
                {
                    rates[rateSpot] =
                        (byte)beatsPerMinute;


                    rateSpot++;


                    if (rateSpot >= RATE_SIZE)
                    {
                        rateSpot = 0;
                    }


                    if (
                        validRateCount < RATE_SIZE
                    )
                    {
                        validRateCount++;
                    }


                    int sum = 0;


                    for (
                        byte i = 0;
                        i < validRateCount;
                        i++
                    )
                    {
                        sum += rates[i];
                    }


                    localHeartRate =
                        (float)sum /
                        validRateCount;
                }
            }
        }


        // ----------------------------------------------------
        // SPO2 APPROXIMATION
        // ----------------------------------------------------

        float localSpo2 = 0.0;


        long redValue =
            particleSensor.getRed();


        if (
            redValue > 0 &&
            irValue > 0
        )
        {
            float ratio =
                (float)redValue /
                (float)irValue;


            float spo2Value =
                110.0 -
                (25.0 * ratio);


            if (
                spo2Value >= 70 &&
                spo2Value <= 100
            )
            {
                localSpo2 = spo2Value;
            }
        }


        // ----------------------------------------------------
        // UPDATE GLOBAL DATA
        // ----------------------------------------------------

        if (
            xSemaphoreTake(
                vitalsMutex,
                pdMS_TO_TICKS(5)
            ) == pdTRUE
        )
        {
            currentVitals.fingerDetected = true;


            if (localHeartRate > 0)
            {
                currentVitals.heartRate =
                    localHeartRate;
            }


            if (localSpo2 > 0)
            {
                currentVitals.spo2 =
                    localSpo2;
            }


            xSemaphoreGive(vitalsMutex);
        }
    }
    else
    {
        // ----------------------------------------------------
        // NO FINGER DETECTED
        // ----------------------------------------------------

        rateSpot = 0;

        validRateCount = 0;

        lastBeat = 0;


        if (
            xSemaphoreTake(
                vitalsMutex,
                pdMS_TO_TICKS(5)
            ) == pdTRUE
        )
        {
            currentVitals.fingerDetected = false;

            currentVitals.heartRate = 0.0;

            currentVitals.spo2 = 0.0;


            xSemaphoreGive(vitalsMutex);
        }
    }
}


// ============================================================================
// DS18B20 TEMPERATURE
// ============================================================================

void readTemperature()
{
    if (!ds18b20Ready)
    {
        return;
    }


    float tempC =
        temperatureSensor.getTempCByIndex(0);


    // Start next asynchronous conversion

    temperatureSensor.requestTemperatures();


    // Invalid values

    if (
        tempC == DEVICE_DISCONNECTED_C ||
        tempC == 85.0
    )
    {
        return;
    }


    if (
        tempC < 15.0 ||
        tempC > 50.0
    )
    {
        return;
    }


    if (
        xSemaphoreTake(
            vitalsMutex,
            pdMS_TO_TICKS(5)
        ) == pdTRUE
    )
    {
        currentVitals.temperature = tempC;


        xSemaphoreGive(vitalsMutex);
    }
}


// ============================================================================
// GET UTC TIMESTAMP
// ============================================================================

unsigned long long getTimestampMs()
{
    if (!ntpSynchronized)
    {
        return 0;
    }


    struct timeval tv;


    gettimeofday(
        &tv,
        NULL
    );


    if (tv.tv_sec < 100000000)
    {
        return 0;
    }


    unsigned long long timestamp =
        ((unsigned long long)tv.tv_sec * 1000ULL) +
        ((unsigned long long)tv.tv_usec / 1000ULL);


    return timestamp;
}


// ============================================================================
// SEND TELEMETRY TO BACKEND
// ============================================================================

bool sendTelemetryPacket(
    const VitalsTelemetry& data
)
{
    WiFiClientSecure client;


    /*
    ================================================================

    IMPORTANT:

    setInsecure() is used because your ESP32 Core version:

    ESP32 Arduino Core 4.0.0-alpha1

    has incompatible setCACertBundle API.

    This allows HTTPS connection without compilation errors.

    ================================================================
    */

    client.setInsecure();

    client.setTimeout(10);


    HTTPClient http;


    http.setTimeout(10000);


    if (!http.begin(client, BACKEND_URL))
    {
        Serial.println("[HTTP] Failed to initialize HTTPS connection.");

        return false;
    }


    // ------------------------------------------------------------
    // HEADERS
    // ------------------------------------------------------------

    http.addHeader(
        "Content-Type",
        "application/json"
    );


    http.addHeader(
        "X-Device-ID",
        DEVICE_ID
    );


    http.addHeader(
        "X-Device-Token",
        DEVICE_TOKEN
    );


    // ------------------------------------------------------------
    // SANITIZE DATA
    // ------------------------------------------------------------

    float heartRate = data.heartRate;

    float spo2 = data.spo2;

    float temperature = data.temperature;


    if (
        isnan(heartRate) ||
        isinf(heartRate)
    )
    {
        heartRate = 0.0;
    }


    if (
        isnan(spo2) ||
        isinf(spo2)
    )
    {
        spo2 = 0.0;
    }


    if (
        isnan(temperature) ||
        isinf(temperature)
    )
    {
        temperature = 0.0;
    }


    // Round values

    heartRate =
        round(heartRate * 10.0) / 10.0;

    spo2 =
        round(spo2 * 10.0) / 10.0;

    temperature =
        round(temperature * 10.0) / 10.0;


    // ------------------------------------------------------------
    // CREATE JSON
    // ------------------------------------------------------------

    JsonDocument doc;


    doc["heartRate"] =
        heartRate;

    doc["spo2"] =
        spo2;

    doc["temperature"] =
        temperature;

    doc["ecg"] =
        data.ecg;

    doc["leadsOff"] =
        data.leadsOff;

    doc["fingerDetected"] =
        data.fingerDetected;

    doc["timestamp"] =
        data.timestamp;


    String jsonPayload;


    serializeJson(
        doc,
        jsonPayload
    );


    // ------------------------------------------------------------
    // SEND POST REQUEST
    // ------------------------------------------------------------

    Serial.println();
    Serial.println("[CLOUD] Sending telemetry...");

    Serial.println(jsonPayload);


    int httpCode =
        http.POST(jsonPayload);


    String response =
        http.getString();


    Serial.print("[HTTP] Response Code: ");

    Serial.println(httpCode);


    Serial.print("[HTTP] Response: ");

    Serial.println(response);


    http.end();


    // ------------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------------

    if (
        httpCode == 200 ||
        httpCode == 201
    )
    {
        authFailureCount = 0;


        Serial.println(
            "[CLOUD] TELEMETRY SENT SUCCESSFULLY"
        );


        Serial.print("HR: ");

        Serial.println(heartRate);


        Serial.print("SpO2: ");

        Serial.println(spo2);


        Serial.print("Temperature: ");

        Serial.println(temperature);


        return true;
    }


    // ------------------------------------------------------------
    // ERROR HANDLING
    // ------------------------------------------------------------

    if (
        httpCode == 401 ||
        httpCode == 403
    )
    {
        authFailureCount++;


        Serial.println(
            "[AUTH] Device authentication failed."
        );


        if (authFailureCount >= 5)
        {
            Serial.println(
                "[AUTH] Too many failures. Backing off for 60 seconds."
            );


            nextAllowedUploadTime =
                millis() + 60000;


            authFailureCount = 0;
        }
    }
    else if (httpCode == 429)
    {
        Serial.println(
            "[HTTP] Rate limited. Waiting 5 seconds."
        );


            nextAllowedUploadTime =
                millis() + 5000;
    }
    else
    {
        nextAllowedUploadTime =
            millis() + 2000;
    }


    return false;
}


// ============================================================================
// STATUS LED
// ============================================================================

void updateLED()
{
    static unsigned long lastBlinkTime = 0;

    static bool ledState = false;


    unsigned long now = millis();


    // WiFi connected and cloud active

    if (
        WiFi.status() == WL_CONNECTED &&
        now >= nextAllowedUploadTime
    )
    {
        digitalWrite(
            STATUS_LED,
            HIGH
        );

        return;
    }


    // Blink when disconnected

    if (
        now - lastBlinkTime >= 500
    )
    {
        lastBlinkTime = now;


        ledState = !ledState;


        digitalWrite(
            STATUS_LED,
            ledState ? HIGH : LOW
        );
    }
}
