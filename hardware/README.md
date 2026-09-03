# 🔌 Smart Health IoT Hardware & Sensor Setup Guide

This guide explains how to connect your physical sensors to the **ESP32 Microcontroller** and flash the firmware to stream real-time patient vitals securely into the **Smart Healthcare Backend & Dashboards** over encrypted HTTPS.

---

## 📋 Required Components
1. **ESP32 Development Board** (NodeMCU ESP32 / ESP-WROOM-32)
2. **MAX30102 / MAX30105** (Heart Rate & Blood Oxygen SpO2 Sensor via I2C)
3. **AD8232 Heart Rate Monitor Module** (Single Lead ECG with 3 Electrode Pads)
4. **DS18B20 Temperature Sensor** (Waterproof probe or TO-92 with 4.7kΩ pull-up resistor)
5. **Breadboard & Jumper Wires**
6. **Micro-USB / USB-C Data Cable**

---

## ⚡ Circuit Pinout & Wiring Table

| Sensor | Sensor Pin | ESP32 Pin | Note |
|---|---|---|---|
| **MAX30102 / MAX30105** | `VCC` | `3V3` | Power (3.3V) |
| | `GND` | `GND` | Ground |
| | `SDA` | `GPIO 21` | I2C Data |
| | `SCL` | `GPIO 22` | I2C Clock |
| **AD8232 ECG** | `3.3V` | `3V3` | Power (3.3V) |
| | `GND` | `GND` | Ground |
| | `OUTPUT` | `GPIO 34` | Analog Input (ADC1 Channel 6) |
| | `LO+` | `GPIO 18` | Leads-off Detect (+) |
| | `LO-` | `GPIO 19` | Leads-off Detect (-) |
| **DS18B20 Temp** | `VDD` | `3V3` | Power (3.3V) |
| | `GND` | `GND` | Ground |
| | `DATA` | `GPIO 4` | 4.7kΩ pull-up to 3.3V |

---

## 🛠️ Arduino IDE Setup

### 1. Install ESP32 Board Package
1. Open **Arduino IDE** $\to$ **File** $\to$ **Preferences**.
2. Add this URL to **Additional Boards Manager URLs**:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools** $\to$ **Board** $\to$ **Boards Manager**, search for `esp32` by **Espressif Systems**, and click **Install**.

### 2. Install Required Libraries
Open **Tools** $\to$ **Manage Libraries...** and install:
- **`ArduinoJson`** (by Benoit Blanchon, v6 or v7)
- **`SparkFun MAX3010x Pulse and Proximity Sensor Library`** (by SparkFun)
- **`OneWire`** (by Jim Studt)
- **`DallasTemperature`** (by Miles Burton)

---

## 🚀 Flashing & Running the Firmware

1. Open [`hardware/esp32_smart_health_telemetry.ino`](file:///c:/Users/india/Desktop/smart-health-backend/hardware/esp32_smart_health_telemetry.ino) in Arduino IDE.
2. Enter your Wi-Fi and Device Credentials:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

   const char* BACKEND_URL   = "https://smart-health-care-4l63.onrender.com/api/esp32/update";
   const char* DEVICE_ID     = "DEVICE-001"; // Registered in doctor/admin portal
   const char* DEVICE_TOKEN  = "YOUR_SECRET_DEVICE_TOKEN";
   ```
3. Connect the ESP32 via USB.
4. In **Tools**, select **Board: "ESP32 Dev Module"** and choose your **COM Port**.
5. Click **Upload** (<kbd>→</kbd>).
6. Open **Tools** $\to$ **Serial Monitor** at **115200 baud** to monitor device authentication and live telemetry.

---

## 📡 Production HTTPS Telemetry Specification
The firmware sends authenticated HTTPS `POST` requests to `/api/esp32/update` with headers:
```http
POST /api/esp32/update HTTP/1.1
Host: smart-health-care-4l63.onrender.com
Content-Type: application/json
X-Device-ID: DEVICE-001
X-Device-Token: <SECRET_DEVICE_TOKEN>

{
  "heartRate": 75.4,
  "spo2": 98.2,
  "temperature": 36.8,
  "ecg": 512,
  "leadsOff": false,
  "timestamp": 1720000000000
}
```

The cloud backend authenticates the device cryptographically, maps it to its assigned patient record in Firebase, executes ML risk analysis, and broadcasts live telemetry strictly to authorized patient and doctor dashboards.
