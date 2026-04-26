import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
// Simple logger utility for production hardening
function logEvent(message, meta = {}) {
  if (typeof console !== 'undefined' && console.log) {
    const logMsg = `[MedicineReminder] ${message}`;
    if (meta && Object.keys(meta).length > 0) {
      console.log(logMsg, meta);
    } else {
      console.log(logMsg);
    }
  }
}

function unwrapEnvelope(response, requestId = null) {
  const payload = response?.data;
  if (!payload || !payload.data) {
    const errMsg = "Invalid API response format";
    logEvent(errMsg, { requestId });
    throw new Error(errMsg);
  }
  return payload.data;
}

export async function scheduleMedicineReminder(medicine, patientName, context = {}) {
  // Input validation
  if (!medicine || typeof medicine !== 'object') {
    const errMsg = 'Invalid medicine object';
    logEvent(errMsg, { requestId: context.requestId });
    throw new Error(errMsg);
  }
  if (!medicine.time || typeof medicine.time !== 'string') {
    const errMsg = 'Missing or invalid medicine.time';
    logEvent(errMsg, { requestId: context.requestId });
    throw new Error(errMsg);
  }
  // Parse time (assume HH:mm format)
  const [hour, minute] = (medicine.time || '').split(':').map(Number);
  if (isNaN(hour) || isNaN(minute)) {
    const errMsg = 'Invalid medicine.time format';
    logEvent(errMsg, { requestId: context.requestId });
    throw new Error(errMsg);
  }

  // Schedule for today or tomorrow if time has passed
  const now = new Date();
  let trigger = new Date();
  trigger.setHours(hour, minute, 0, 0);
  if (trigger < now) {
    trigger.setDate(trigger.getDate() + 1);
  }

  try {
    logEvent('Scheduling medicine reminder', {
      medicineName: medicine.name,
      patientName,
      time: medicine.time,
      requestId: context.requestId,
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Medicine Reminder`,
        body: `${patientName || 'Patient'}: Take ${medicine.name} (${medicine.dosage || ''})`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
    });
    logEvent('Medicine reminder scheduled successfully', { requestId: context.requestId });
  } catch (error) {
    logEvent('Failed to schedule medicine reminder', {
      error: error?.message || error,
      medicineName: medicine.name,
      patientName,
      requestId: context.requestId,
    });
    throw new Error('Failed to schedule medicine reminder: ' + (error?.message || error));
  } finally {
    // No loading state here, but cleanup if needed
  }
}

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return status === 'granted';
}
