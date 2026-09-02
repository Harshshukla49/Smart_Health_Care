# 🔌 Smart Health IoT Hardware & Sensor Setup Guide

This guide explains how to connect your physical sensors to the **ESP32 Microcontroller** and flash the firmware to stream real-time patient vitals into the **Smart Healthcare Backend & Dashboards**.

---

## 📋 Required Components
1. **ESP32 Development Board** (NodeMCU ESP32 / ESP-WROOM-32)
2. **MAX30102 / MAX30100** (Heart Rate & Blood Oxygen SpO2 Sensor via I2C)
3. **AD8232 Heart Rate Monitor Module** (Single Lead ECG with 3 Electrode Pads)
4. **DS18B20 Temperature Sensor** (Waterproof probe or TO-92 with 4.7kΩ pull-up resistor)
5. **Breadboard & Jumper Wires**
6. **Micro-USB / USB-C Data Cable**

---

## ⚡ Circuit Pinout & Wiring Table

| Sensor | Sensor Pin | ESP32 Pin | Note |
|---|---|---|---|
| **MAX30102** | `VCC` | `3V3` (or `VIN` 3.3V) | Power |
| | `GND` | `GND` | Ground |
| | `SDA` | `GPIO 21` | I2C Data |
| | `SCL` | `GPIO 22` | I2C Clock |
| **AD8232 ECG** | `3.3V` | `3V3` | Power |
| | `GND` | `GND` | Ground |
| | `OUTPUT` | `GPIO 34` | Analog Input (ADC1) |
| | `LO+` | `GPIO 18` | Leads-off Detect (+) |
| | `LO-` | `GPIO 19` | Leads-off Detect (-) |
| **DS18B20 Temp** | `VDD` | `3V3` / `5V` | Power |
| | `GND` | `GND` | Ground |
| | `DATA` | `GPIO 4` | 4.7kΩ pullup to 3.3V |

---

## 🛠️ Arduino IDE Setup

### 1. Install ESP32 Board Package
1. Open **Arduino IDE** $\to$ **File** $\to$ **Preferences**.
2. Add this URL to **Additional Boards Manager URLs**:
   ```
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
2. Edit your WiFi settings at lines 28-29:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```
3. Select your target Backend URL:
   - **Production (Render)**:
     ```cpp
     const char* BACKEND_URL = "https://smart-health-backend-2idf.onrender.com/api/esp32/update";
     ```
   - **Local Testing**:
     ```cpp
     const char* BACKEND_URL = "http://192.168.1.X:5000/api/esp32/update";
     ```
4. Connect the ESP32 via USB.
5. In **Tools**, select **Board: "ESP32 Dev Module"** and choose your **COM Port**.
6. Click **Upload** (<kbd>→</kbd>).
7. Open **Tools** $\to$ **Serial Monitor** at **115200 baud** to see the live telemetry stream.

---

## 📡 Expected Backend Telemetry Format
The firmware sends HTTP `POST` requests to `/api/esp32/update`:
```json
{
  "heartRate": 75.4,
  "spo2": 98.2,
  "temperature": 36.8,
  "ecg": 512,
  "leadsOff": false
}
```
The Flask backend immediately stores this in memory and broadcasts live telemetry to all connected Doctor and Patient dashboards via WebSocket.
