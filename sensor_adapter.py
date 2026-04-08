import random
from abc import ABC, abstractmethod


class SensorAdapter(ABC):
    """Abstract adapter used by the streaming loop to obtain next vitals."""

    @abstractmethod
    def get_next_vitals(self, patient_id, current_vitals):
        raise NotImplementedError


class SimulatedSensorAdapter(SensorAdapter):
    """Generates smooth pseudo-real-time vitals around current values."""

    @staticmethod
    def _clamp(value, minimum, maximum):
        return max(minimum, min(maximum, value))

    def get_next_vitals(self, patient_id, current_vitals):
        heart_rate = float(current_vitals.get('heartRate') or current_vitals.get('heart_rate') or 80)
        spo2 = float(current_vitals.get('spo2') or 97)
        temperature = float(current_vitals.get('temperature') or 36.8)

        return {
            'heart_rate': round(float(self._clamp(heart_rate + random.uniform(-4, 4), 55, 150)), 1),
            'spo2': round(float(self._clamp(spo2 + random.uniform(-1.2, 1.2), 85, 100)), 1),
            'temperature': round(float(self._clamp(temperature + random.uniform(-0.2, 0.2), 35.5, 40.0)), 1),
            'source': 'sensor-stream',
        }


class DatasetReplaySensorAdapter(SensorAdapter):
    """Replays rows from vitals dataset to emulate device feed deterministically."""

    def __init__(self, rows):
        self.rows = list(rows or [])
        self.index_by_patient = {}

    def get_next_vitals(self, patient_id, current_vitals):
        if not self.rows:
            return SimulatedSensorAdapter().get_next_vitals(patient_id, current_vitals)

        index = self.index_by_patient.get(patient_id, random.randrange(0, len(self.rows)))
        row = self.rows[index % len(self.rows)]
        self.index_by_patient[patient_id] = (index + 1) % len(self.rows)

        return {
            'heart_rate': float(row.get('heart_rate', 80.0)),
            'spo2': float(row.get('spo2', 97.0)),
            'temperature': float(row.get('temperature', 36.8)),
            'source': 'sensor-stream-dataset',
        }


def create_sensor_adapter(mode, dataset_rows):
    normalized_mode = str(mode or '').strip().lower()
    if normalized_mode == 'dataset':
        return DatasetReplaySensorAdapter(dataset_rows)
    return SimulatedSensorAdapter()
