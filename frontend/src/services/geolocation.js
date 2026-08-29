/**
 * Safe browser Geolocation service with explicit consent, error classification,
 * distance calculation, and map link generators.
 */

export const isGeolocationSupported = () => {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
};

export const queryGeolocationPermission = async () => {
  if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state; // 'granted', 'prompt', 'denied'
  } catch {
    return 'unknown';
  }
};

/**
 * Request single current position via Geolocation API
 * @param {PositionOptions} [options]
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number, altitude: number|null, speed: number|null}>}
 */
export const getCurrentCoordinates = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Geolocation is not supported by your browser or device.'));
      return;
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 10000,
      ...options,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude, speed } = position.coords;
        resolve({
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          accuracy: Math.round(accuracy || 0),
          timestamp: position.timestamp || Date.now(),
          altitude: altitude ? Number(altitude.toFixed(1)) : null,
          speed: speed ? Number(speed.toFixed(1)) : null,
        });
      },
      (err) => {
        let message = 'Unable to determine GPS location.';
        let reason = 'unknown';

        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission was denied by user or browser.';
            reason = 'permission_denied';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'GPS position is currently unavailable. Check device location services.';
            reason = 'position_unavailable';
            break;
          case err.TIMEOUT:
            message = 'GPS location request timed out. Please retry in an area with clear signal.';
            reason = 'timeout';
            break;
          default:
            message = err.message || 'Failed to acquire location.';
            break;
        }

        const error = new Error(message);
        error.code = err.code;
        error.reason = reason;
        reject(error);
      },
      defaultOptions
    );
  });
};

/**
 * Watch coordinates continuously
 */
export const watchCoordinates = (onSuccess, onError, options = {}) => {
  if (!isGeolocationSupported()) {
    onError(new Error('Geolocation not supported.'));
    return () => {};
  }

  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
    ...options,
  };

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy, altitude, speed } = position.coords;
      onSuccess({
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        accuracy: Math.round(accuracy || 0),
        timestamp: position.timestamp || Date.now(),
        altitude: altitude ? Number(altitude.toFixed(1)) : null,
        speed: speed ? Number(speed.toFixed(1)) : null,
      });
    },
    (err) => {
      onError(err);
    },
    defaultOptions
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
};

/**
 * Generate Google Maps navigation link
 */
export const formatLocationLink = (latitude, longitude) => {
  if (!latitude || !longitude) return '';
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
};

/**
 * Generate OpenStreetMap embed URL
 */
export const formatOsmEmbedUrl = (latitude, longitude, delta = 0.008) => {
  if (!latitude || !longitude) return '';
  const minLon = (longitude - delta).toFixed(6);
  const minLat = (latitude - delta).toFixed(6);
  const maxLon = (longitude + delta).toFixed(6);
  const maxLat = (latitude + delta).toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${latitude}%2C${longitude}`;
};

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};
