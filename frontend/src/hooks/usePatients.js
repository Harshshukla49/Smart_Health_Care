import { useCallback, useEffect, useState } from 'react';
import { getPatients } from '../services/api';

export function usePatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getPatients();
      setPatients(result);
      return result;
    } catch (requestError) {
      const message = requestError?.response?.data?.message || requestError?.message || 'Unable to load patients.';
      setError(message);
      setPatients([]);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  return {
    patients,
    loading,
    error,
    reload: loadPatients,
    setPatients,
  };
}