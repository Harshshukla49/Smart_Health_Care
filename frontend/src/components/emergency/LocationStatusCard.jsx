import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  ExternalLink,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { useEmergency } from '../../context/EmergencyContext';
import { formatLocationLink } from '../../services/geolocation';

export function LocationStatusCard({ onOpenMap }) {
  const {
    location,
    locationStatus,
    locationPermission,
    locationError,
    lastLocationTime,
    requestLocationConsent,
    refreshLocation,
  } = useEmergency();

  const [timeAgo, setTimeAgo] = useState('Just now');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!lastLocationTime) {
      setTimeAgo('Never');
      return undefined;
    }

    const updateRelative = () => {
      const seconds = Math.floor((Date.now() - new Date(lastLocationTime).getTime()) / 1000);
      if (seconds < 10) setTimeAgo('Just now');
      else if (seconds < 60) setTimeAgo(`${seconds} seconds ago`);
      else setTimeAgo(`${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) > 1 ? 's' : ''} ago`);
    };

    updateRelative();
    const timer = setInterval(updateRelative, 5000);
    return () => clearInterval(timer);
  }, [lastLocationTime]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshLocation();
    setRefreshing(false);
  };

  const isLocationActive = locationStatus === 'active' && Boolean(location);
  const mapLink = location ? formatLocationLink(location.latitude, location.longitude) : '';

  return (
    <Card className="p-4 sm:p-5 bg-white border border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-9 w-9 place-items-center rounded-xl border ${
            isLocationActive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : 'bg-amber-50 border-amber-200 text-amber-600'
          }`}>
            <MapPin className="h-5 w-5" />
          </span>
          <div>
            <h4 className="font-sans text-sm font-bold text-slate-900">
              Location Services
            </h4>
            <p className="text-[11px] text-slate-500">
              Emergency GPS Telemetry
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
          isLocationActive
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          <span className={`h-2 w-2 rounded-full ${isLocationActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          {isLocationActive ? 'Location active' : 'Location unavailable'}
        </span>
      </div>

      {isLocationActive ? (
        /* Active State */
        <div className="mt-4 space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">GPS Accuracy</span>
              <p className="font-bold text-slate-800 text-xs mt-0.5">
                ± {location.accuracy || 12} meters
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Updated</span>
              <p className="font-bold text-slate-800 text-xs mt-0.5">
                {timeAgo}
              </p>
            </div>

            <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Coords: <span className="font-mono text-slate-700">{location.latitude}, {location.longitude}</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                Permission: Granted
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="text-xs rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Acquiring...' : 'Update Location'}
            </Button>

            {onOpenMap ? (
              <button
                type="button"
                onClick={onOpenMap}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
              >
                <span>View on Map</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            ) : mapLink ? (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
              >
                <span>Google Maps</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        /* Unavailable Fallback State */
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">GPS Location Unavailable</p>
                <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                  {locationError || 'Browser permissions, hardware GPS disabled, or low satellite visibility.'}
                </p>
              </div>
            </div>
            <ul className="mt-2 pl-6 list-disc space-y-0.5 text-[11px] text-amber-800">
              <li>Check browser location permission</li>
              <li>Ensure device GPS / location toggle is ON</li>
              <li>Verify clear network / cellular connection</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={requestLocationConsent}
              className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs"
            >
              <Compass className="h-3.5 w-3.5 mr-1.5" />
              Enable Location Access
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleManualRefresh}
              className="text-xs rounded-xl"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry GPS
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
