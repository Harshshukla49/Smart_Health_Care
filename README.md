# 🏥 Smart Health Care Monitoring System

![React](https://img.shields.io/badge/Frontend-React-blue?logo=react)
![Flask](https://img.shields.io/badge/Backend-Flask-black?logo=flask)
![ML](https://img.shields.io/badge/ML-Scikit--Learn-orange?logo=scikit-learn)
![WebSockets](https://img.shields.io/badge/Realtime-WebSockets-green)
![Status](https://img.shields.io/badge/Project-Active-success)

A **full-stack AI-powered healthcare monitoring system** that enables real-time patient tracking, ML-based health prediction, and future-ready IoT integration.

---

## 🚀 Live Demo (Add When Deployed)

* 🌐 Frontend: *Coming Soon (Vercel)*
* ⚙️ Backend: *Running on Render*

---

## 📸 Screenshots

> Add screenshots here after uploading images to GitHub

* Patient Dashboard
* Doctor Dashboard
* Alerts Panel
* Insights Panel

---

## 🧠 Key Highlights (Resume Ready)

✔ Built a **real-time healthcare monitoring system** using React & Flask
✔ Integrated **Machine Learning model** for patient risk prediction
✔ Designed **WebSocket-based architecture** for live data updates
✔ Developed **role-based dashboards** (Doctor & Patient)
✔ Implemented **dynamic alert system** for critical health conditions
✔ Created **hybrid data pipeline** (Dataset → Live IoT-ready system)

---

## 🧠 Core Workflow

```text
Dataset / Sensor Data → Flask Backend → ML Model → Prediction → React Dashboard
```

---

## ✨ Features

### 👨‍⚕️ Doctor Dashboard

* Create & manage patients
* View vitals & health trends
* Monitor alerts and insights
* Connect/Disconnect device (IoT-ready)

### 🧑‍⚕️ Patient Dashboard

* View real-time vitals
* Track health insights
* Receive alerts

### 📊 Vitals Monitoring

* ❤️ Heart Rate
* 🫁 SpO2
* 🌡️ Temperature

### 🚨 Smart Alerts

* High heart rate detection
* Low oxygen alerts
* Fever alerts

### 🧠 ML-Based Insights

* Predicts:

  * Low Risk
  * Medium Risk
  * High Risk
* Based on trained dataset

---

## 🔄 System Modes

### 🟡 Dataset Mode

* Static vitals
* ML prediction once

### 🟢 Live Mode (Future IoT)

* Real-time vitals
* Continuous ML predictions
* WebSocket updates

---

## ⚙️ Tech Stack

### Frontend

* React.js
* CSS (Modern UI)

### Backend

* Flask
* Flask-SocketIO

### Machine Learning

* Scikit-learn
* Pandas, NumPy

---

## 📁 Project Structure

```bash
Smart_Health_Care/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│
├── backend/
│   ├── app.py
│   ├── model.pkl
│   ├── dataset/
```

---

## ⚙️ Installation

### Clone Repo

```bash
git clone https://github.com/Harshshukla49/Smart_Health_Care.git
cd Smart_Health_Care
```

### Backend

```bash
pip install -r requirements.txt
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔗 API Endpoints

| Method | Endpoint           | Description    |
| ------ | ------------------ | -------------- |
| GET    | /api/vitals        | Fetch vitals   |
| POST   | /predict           | ML prediction  |
| POST   | /toggle-device/:id | Device control |
| POST   | /sensor-data       | IoT data input |

---

## 📡 Real-Time System

* Built using **WebSockets (Socket.IO)**
* Enables:

  * Live vitals streaming
  * Instant alerts
  * Real-time insights

---

## 🔮 Future Enhancements

* 🔌 IoT sensor integration (ESP32, MAX30102)
* 🔐 JWT Authentication
* 📊 Advanced analytics dashboard
* 📱 Mobile app

---

## 🎯 Use Cases

* Remote patient monitoring
* Telemedicine systems
* Smart hospitals
* Emergency health tracking

---

## 👨‍💻 Author

**Harsh Shukla**
🔗 GitHub: https://github.com/Harshshukla49

---

## ⭐ Support

If you like this project:

* ⭐ Star the repo
* 🍴 Fork it
* 📢 Share it

---

> 🚀 “Building the future of healthcare with AI, real-time systems, and smart monitoring.”
