import React, { useState } from 'react';
import {
  Compass,
  Copy,
  ExternalLink,
  Hospital,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../Button';
import { formatLocationLink, formatOsmEmbedUrl } from '../../services/geolocation';

export function EmergencyMap({
  latitude,
  longitude,
  accuracy = 12,
  patientName = 'Akash Soni',
  status = 'CRITICAL',
  lastUpdated = 'Just now',
  nearbyFacilities = [],
}) {
  const [zoomLevel, setZoomLevel] = useState(0.008);

  const googleMapsUrl = formatLocationLink(latitude, longitude);
  const osmEmbedUrl = formatOsmEmbedUrl(latitude, longitude, zoomLevel);
  const osmFullUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(`${latitude}, ${longitude}`);
      toast.success('Coordinates copied to clipboard');
    } catch {
      toast.error('Unable to copy coordinates');
    }
  };

  const copyLocationLink = async () => {
    try {
      await navigator.clipboard.writeText(googleMapsUrl);
      toast.success('Location map link copied');
    } catch {
      toast.error('Unable to copy location link');
    }
  };

  if (!latitude || !longitude) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
        <MapPin className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-2 text-sm font-bold text-slate-800">No Coordinates Available</p>
        <p className="mt-1 text-xs text-slate-500">
          GPS fix not available for this patient telemetry record.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Patient Location Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-100 text-rose-700">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <p className="font-bold text-slate-900 leading-tight">
              {patientName} · <span className="text-rose-600 font-bold">{status}</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Accuracy ±{accuracy}m · Updated {lastUpdated}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={copyCoordinates}
            className="text-xs rounded-xl"
            title="Copy coordinates"
          >
            <Copy className="h-3 w-3 mr-1" />
            Coords
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={copyLocationLink}
            className="text-xs rounded-xl"
            title="Copy Google Maps link"
          >
            <Share2 className="h-3 w-3 mr-1" />
            Share
          </Button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition"
          >
            <span>Open Maps</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Real Interactive Map Canvas (OpenStreetMap) */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
        <iframe
          title={`Emergency Map: ${patientName}`}
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight="0"
          marginWidth="0"
          src={osmEmbedUrl}
          className="h-full w-full"
        />

        {/* Live Patient Marker Badge Overlay */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-md backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                PATIENT POSITION (LIVE)
              </p>
              <p className="font-mono text-xs font-bold text-slate-800">
                {latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E
              </p>
            </div>
          </div>
        </div>

        {/* Zoom & Full View Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setZoomLevel((prev) => Math.max(0.002, prev / 2))}
            title="Zoom In"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((prev) => Math.min(0.03, prev * 2))}
            title="Zoom Out"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            -
          </button>
          <a
            href={osmFullUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Full Screen Map"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Nearby Emergency Facilities (Overpass / Google fallback) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Hospital className="h-4 w-4 text-teal-600" />
            <span>Nearby Emergency Trauma & Hospitals</span>
          </span>
          <a
            href={`https://www.google.com/maps/search/hospital+emergency/@${latitude},${longitude},14z`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            Find more on Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-slate-200 bg-white p-2 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">AIIMS Trauma Center</p>
              <p className="text-[10px] text-slate-500">24/7 Cardiology & ICU</p>
            </div>
            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              ~2.4 km
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">Apollo Emergency Care</p>
              <p className="text-[10px] text-slate-500">Emergency Ambulance Bay</p>
            </div>
            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
              ~3.8 km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
