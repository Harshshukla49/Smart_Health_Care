import { useEffect, useState } from 'react';
import { getPatientById } from '../services/api';

export function usePatient(patientId) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadPatient = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await getPatientById(patientId);
        if (active) {
          setPatient(result);
        }
      } catch (requestError) {
        if (active) {
          setPatient(null);
          setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load patient.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPatient();

    return () => {
      active = false;
    };
  }, [patientId]);

  return { patient, loading, error, setPatient };
}