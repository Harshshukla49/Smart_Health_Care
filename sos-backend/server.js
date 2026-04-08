const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const twilio = require('twilio');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    status: 'SOS Backend running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      trigger: '/api/sos/trigger (POST)',
      reset: '/api/sos/reset (POST)'
    },
    docs: 'See TODO.md for Gmail/Twilio setup'
  });
});

const firebaseKeyPath = path.resolve(__dirname, '..', 'firebase_key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseKeyPath),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://smart-health-care-cd723-default-rtdb.asia-southeast1.firebasedatabase.app/',
  });
}

const db = admin.database();

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const normalizePhone = (value) => {
  const cleaned = String(value || '').replace(/[^0-9+]/g, '').trim();
  if (!cleaned) {
    return '';
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

const buildAlertMessage = ({ patientId, heartRate, spo2, temperature, patientPhone, locationLink }) => {
  const details = [
    'Emergency! Patient condition is critical or high risk.',
    `Patient ID: ${patientId || '--'}`,
    `Heart Rate: ${heartRate ?? '--'}`,
    `SpO2: ${spo2 ?? '--'}`,
    `Temperature: ${temperature ?? '--'}`,
    `Patient Phone: ${patientPhone || '--'}`,
  ];

  if (locationLink) {
    details.push(`Live Location: ${locationLink}`);
  }

  return details.join('\n');
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sos-backend' });
});

app.post('/api/sos/trigger', async (req, res) => {
  try {
    const patientId = String(req.body?.patientId || '').trim().toLowerCase();
    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const patientRef = db.ref(`patients/${patientId}`);
    const snapshot = await patientRef.get();

    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    const patient = snapshot.val() || {};

    if (Boolean(patient.sosEventActive)) {
      return res.status(200).json({ sent: false, reason: 'already-sent-for-event' });
    }

    const heartRate = Number(req.body?.heartRate ?? patient.heart_rate ?? patient.heartRate ?? 0);
    const spo2 = Number(req.body?.spo2 ?? patient.spo2 ?? 0);
    const temperature = Number(req.body?.temperature ?? patient.temperature ?? 0);
    const patientPhone = normalizePhone(req.body?.patientPhone ?? patient.phone);
    const doctorPhone = normalizePhone(req.body?.doctorPhone ?? patient.doctorContact);
    const locationLink = String(req.body?.locationLink || '').trim();
    const emergencyContacts = Array.isArray(req.body?.emergencyContacts)
      ? req.body.emergencyContacts.map(normalizePhone).filter(Boolean)
      : (Array.isArray(patient.emergencyContacts)
        ? patient.emergencyContacts.map(normalizePhone).filter(Boolean)
        : []);

    const recipients = Array.from(new Set([
      ...emergencyContacts,
      ...(doctorPhone ? [doctorPhone] : []),
    ])).filter(Boolean);

    if (!recipients.length) {
      return res.status(400).json({ message: 'No emergency contacts or doctor phone configured.' });
    }

    if (!twilioClient || !process.env.TWILIO_PHONE_FROM) {
      return res.status(500).json({
        message: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_FROM.',
      });
    }

    const alertMessage = buildAlertMessage({
      patientId,
      heartRate,
      spo2,
      temperature,
      patientPhone,
      locationLink,
    });

    await patientRef.update({
      sosEventActive: true,
      sosLastTriggeredAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Send SMS alerts
    const smsResults = await Promise.all(
      recipients.map(async (to) => {
        try {
          const msg = await twilioClient.messages.create({
            body: alertMessage,
            from: process.env.TWILIO_PHONE_FROM,
            to,
          });
          return { to, type: 'sms', ok: true, sid: msg.sid };
        } catch (error) {
          return { to, type: 'sms', ok: false, error: error.message };
        }
      })
    );

    return res.json({
      sent: true,
      recipients: smsResults,
      message: alertMessage,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to trigger SOS alert.' });
  }
});

app.post('/api/sos/reset', async (req, res) => {
  try {
    const patientId = String(req.body?.patientId || '').trim().toLowerCase();
    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const patientRef = db.ref(`patients/${patientId}`);
    await patientRef.update({
      sosEventActive: false,
      updatedAt: Date.now(),
    });

    return res.json({ reset: true });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to reset SOS event.' });
  }
});

const port = Number(process.env.SOS_BACKEND_PORT || 5001);
app.listen(port, () => {
  console.log(`SOS backend listening on http://127.0.0.1:${port}`);
});
