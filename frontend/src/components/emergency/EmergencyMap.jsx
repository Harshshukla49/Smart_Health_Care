import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  Compass,
  Copy,
  ExternalLink,
  Hospital,
  MapPin,
  Maximize2,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Stethoscope,
  TestTube,
  Activity,
  AlertTriangle,
  LocateFixed,
  Filter,
  ArrowUpDown,
  Building2,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../Button';
import {
  formatLocationLink,
  getCurrentCoordinates,
  isGeolocationSupported
} from '../../services/geolocation';
import { getNearbyFacilitiesApi } from '../../services/api';

// Create high-contrast, crisp DivIcons for Leaflet
const createPatientIcon = () => {
  return L.divIcon({
    className: 'leaflet-patient-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
        <span style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: rgba(2, 132, 199, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <span style="position: absolute; width: 26px; height: 26px; border-radius: 50%; background-color: rgba(2, 132, 199, 0.5);"></span>
        <span style="position: relative; width: 16px; height: 16px; border-radius: 50%; background-color: #0284c7; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35);"></span>
      </div>
      <style>
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      </style>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

const createFacilityIcon = (category, isEmergency) => {
  let bgColor = '#0284c7'; // default hospital (sky blue)
  let iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/><path d="M3 21h18"/></svg>`;

  if (isEmergency || category === 'emergency') {
    bgColor = '#ef4444'; // emergency red
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>`;
  } else if (category === 'clinic') {
    bgColor = '#10b981'; // emerald
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>`;
  } else if (category === 'diagnostic') {
    bgColor = '#8b5cf6'; // purple
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></svg>`;
  }

  return L.divIcon({
    className: 'leaflet-custom-facility-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background-color: ${bgColor}; color: #ffffff; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; transition: transform 0.2s;">
        ${iconSvg}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

export function EmergencyMap({
  latitude: initialLat,
  longitude: initialLng,
  accuracy: initialAccuracy = 15,
  patientName = 'Patient Location',
  status = 'ACTIVE',
  lastUpdated: initialLastUpdated = 'Just now',
  nearbyFacilities: staticFacilities = []
}) {
  const [currentCoords, setCurrentCoords] = useState({
    lat: initialLat || 28.6139,
    lng: initialLng || 77.2090,
    accuracy: initialAccuracy
  });

  const [facilities, setFacilities] = useState([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);
  const [dataProvider, setDataProvider] = useState('OpenStreetMap Healthcare POI Database');
  const [lastFetchTime, setLastFetchTime] = useState(initialLastUpdated);
  
  // Filters & Controls
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchRadiusKm, setSearchRadiusKm] = useState(10);
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'name'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationPermissionError, setLocationPermissionError] = useState(null);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const facilityMarkersMapRef = useRef(new Map());

  // Keep internal coordinates in sync when parent props change
  useEffect(() => {
    if (initialLat && initialLng) {
      setCurrentCoords({
        lat: Number(initialLat),
        lng: Number(initialLng),
        accuracy: Number(initialAccuracy || 15)
      });
    }
  }, [initialLat, initialLng, initialAccuracy]);

  // Discover real nearby facilities from API
  const fetchNearbyFacilities = async (lat, lng, radius, type) => {
    setIsLoadingFacilities(true);
    setLocationPermissionError(null);
    try {
      const res = await getNearbyFacilitiesApi({
        lat,
        lng,
        radius,
        type,
        limit: 40
      });

      if (res.status === 'success' && Array.isArray(res.facilities) && res.facilities.length > 0) {
        setFacilities(res.facilities);
        setDataProvider(res.provider || 'OpenStreetMap Healthcare POI Database');
        setLastFetchTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else if (staticFacilities && staticFacilities.length > 0) {
        setFacilities(staticFacilities);
      } else {
        setFacilities([]);
      }
    } catch (err) {
      console.warn('Facility discovery error:', err);
      if (staticFacilities && staticFacilities.length > 0) {
        setFacilities(staticFacilities);
      } else {
        setFacilities([]);
      }
    } finally {
      setIsLoadingFacilities(false);
    }
  };

  // Trigger real places fetch whenever coordinates, radius, or category change
  useEffect(() => {
    if (currentCoords.lat && currentCoords.lng) {
      fetchNearbyFacilities(currentCoords.lat, currentCoords.lng, searchRadiusKm, selectedCategory);
    }
  }, [currentCoords.lat, currentCoords.lng, searchRadiusKm, selectedCategory]);

  // Acquire real GPS position from browser
  const handleAcquireGps = async () => {
    if (!isGeolocationSupported()) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    const toastId = toast.loading('Acquiring precise GPS coordinates...');
    try {
      const pos = await getCurrentCoordinates({ enableHighAccuracy: true, timeout: 15000 });
      setCurrentCoords({
        lat: pos.latitude,
        lng: pos.longitude,
        accuracy: pos.accuracy
      });
      toast.success(`GPS Location verified (±${pos.accuracy}m)`, { id: toastId });
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([pos.latitude, pos.longitude], 14, { duration: 1 });
      }
    } catch (err) {
      console.error('GPS error:', err);
      setLocationPermissionError(err.message || 'Location permission denied');
      toast.error(err.message || 'Failed to acquire GPS location', { id: toastId });
    } finally {
      setIsLocating(false);
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [currentCoords.lat, currentCoords.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      // Standard high-definition OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      // Attribution control in bottom right
      L.control.attribution({ position: 'bottomright', prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>')
        .addTo(map);

      // Marker Group
      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers & Layers when facilities or user position change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    facilityMarkersMapRef.current.clear();

    const userLat = currentCoords.lat;
    const userLng = currentCoords.lng;

    // 1. Accuracy Circle & User Pinpoint Marker
    const accuracyRadius = Math.max(15, currentCoords.accuracy || 15);
    const circle = L.circle([userLat, userLng], {
      radius: accuracyRadius,
      color: '#0284c7',
      fillColor: '#38bdf8',
      fillOpacity: 0.15,
      weight: 1.5
    });
    markersGroup.addLayer(circle);
    accuracyCircleRef.current = circle;

    const userMarker = L.marker([userLat, userLng], {
      icon: createPatientIcon(),
      zIndexOffset: 1000
    });

    userMarker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #0284c7;"></span>
          <strong style="font-size: 13px; color: #0f172a;">${patientName}</strong>
        </div>
        <p style="font-size: 11px; color: #64748b; margin: 0 0 6px 0;">
          GPS Fix: ${userLat.toFixed(5)}°, ${userLng.toFixed(5)}° (±${currentCoords.accuracy || 15}m)
        </p>
        <span style="display: inline-block; font-size: 10px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 999px;">
          ${status}
        </span>
      </div>
    `);
    markersGroup.addLayer(userMarker);

    // 2. Real Facilities Markers
    facilities.forEach((facility) => {
      if (!facility.latitude || !facility.longitude) return;

      const marker = L.marker([facility.latitude, facility.longitude], {
        icon: createFacilityIcon(facility.category, facility.isEmergency),
        title: facility.name
      });

      const phoneHtml = facility.phone
        ? `<div style="margin-top: 6px;"><a href="tel:${facility.phone}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #0284c7; text-decoration: none; font-weight: bold;">📞 ${facility.phone}</a></div>`
        : '';

      const websiteHtml = facility.website
        ? `<div style="margin-top: 4px;"><a href="${facility.website}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #0284c7; text-decoration: none;">🌐 Website</a></div>`
        : '';

      const directionsUrl = facility.directionsUrl || `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${facility.latitude},${facility.longitude}`;

      const categoryBadgeColor = facility.isEmergency
        ? 'background: #fee2e2; color: #b91c1c;'
        : facility.category === 'clinic'
        ? 'background: #d1fae5; color: #047857;'
        : facility.category === 'diagnostic'
        ? 'background: #ede9fe; color: #6d28d9;'
        : 'background: #e0f2fe; color: #0369a1;';

      const categoryLabel = facility.isEmergency
        ? '24/7 EMERGENCY & TRAUMA'
        : facility.category === 'clinic'
        ? 'CLINIC / DISPENSARY'
        : facility.category === 'diagnostic'
        ? 'DIAGNOSTIC & LAB'
        : 'HOSPITAL';

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; min-width: 200px; max-width: 260px;">
          <span style="display: inline-block; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 6px; margin-bottom: 4px; ${categoryBadgeColor}">
            ${categoryLabel}
          </span>
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; line-height: 1.3;">
            ${facility.name}
          </h4>
          <p style="font-size: 11px; font-weight: 600; color: #0d9488; margin: 0 0 4px 0;">
            📍 ${facility.distanceKm} km away
          </p>
          ${facility.address ? `<p style="font-size: 11px; color: #475569; margin: 0 0 6px 0; line-height: 1.3;">${facility.address}</p>` : ''}
          ${phoneHtml}
          ${websiteHtml}
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: #0284c7; color: #ffffff; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;">
              Get Directions ↗
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        setSelectedFacilityId(facility.id);
      });

      markersGroup.addLayer(marker);
      facilityMarkersMapRef.current.set(facility.id, marker);
    });

  }, [facilities, currentCoords, patientName, status]);

  // Pan to selected facility marker
  const handleSelectFacility = (facility) => {
    setSelectedFacilityId(facility.id);
    const map = mapInstanceRef.current;
    if (map && facility.latitude && facility.longitude) {
      map.flyTo([facility.latitude, facility.longitude], 16, { duration: 0.8 });
      const marker = facilityMarkersMapRef.current.get(facility.id);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  // Re-center map on user
  const handleRecenter = () => {
    if (mapInstanceRef.current && currentCoords.lat && currentCoords.lng) {
      mapInstanceRef.current.flyTo([currentCoords.lat, currentCoords.lng], 14, { duration: 0.8 });
    }
  };

  // Zoom helpers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(`${currentCoords.lat}, ${currentCoords.lng}`);
      toast.success('Coordinates copied to clipboard');
    } catch {
      toast.error('Unable to copy coordinates');
    }
  };

  const copyLocationLink = async () => {
    const link = formatLocationLink(currentCoords.lat, currentCoords.lng);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Location map link copied');
    } catch {
      toast.error('Unable to copy location link');
    }
  };

  // Filtered and Sorted Facilities for the cards list
  const displayFacilities = useMemo(() => {
    let list = [...facilities];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.address && f.address.toLowerCase().includes(q)) ||
          (f.category && f.category.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return list;
  }, [facilities, searchQuery, sortBy]);

  const googleMapsUrl = formatLocationLink(currentCoords.lat, currentCoords.lng);

  return (
    <div className="space-y-3">
      {/* Header Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-100 text-sky-700 shadow-xs">
            <MapPin className="h-5 w-5" />
          </span>
          <div>
            <p className="font-sans text-xs sm:text-sm font-bold text-slate-900 leading-tight">
              {patientName} · <span className="text-sky-600 font-bold">{status}</span>
            </p>
            <p className="font-mono text-[11px] text-slate-500 mt-0.5">
              {currentCoords.lat.toFixed(5)}° N, {currentCoords.lng.toFixed(5)}° E · ±{currentCoords.accuracy || 15}m
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAcquireGps}
            disabled={isLocating}
            className="text-xs rounded-xl h-8 px-2.5"
            title="Refresh GPS Location from browser"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLocating ? 'animate-spin text-sky-600' : ''}`} />
            {isLocating ? 'Locating...' : 'My GPS'}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={copyCoordinates}
            className="text-xs rounded-xl h-8 px-2.5"
            title="Copy coordinates"
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Coords
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={copyLocationLink}
            className="text-xs rounded-xl h-8 px-2.5"
            title="Copy Google Maps link"
          >
            <Share2 className="h-3.5 w-3.5 mr-1" />
            Share
          </Button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition h-8"
          >
            <span>Open Maps</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Permission Warning if denied */}
      {locationPermissionError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>GPS access issue: {locationPermissionError}. Showing estimated center coordinates.</span>
        </div>
      )}

      {/* Category Filter Pills & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Places', icon: Building2 },
            { id: 'emergency', label: '24/7 Emergency', icon: ShieldAlert },
            { id: 'hospital', label: 'Hospitals', icon: Hospital },
            { id: 'clinic', label: 'Clinics', icon: Stethoscope },
            { id: 'diagnostic', label: 'Diagnostics & Labs', icon: TestTube }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Radius Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">Radius:</span>
          {[5, 10, 25].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSearchRadiusKm(r)}
              className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                searchRadiusKm === r
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r}km
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Leaflet Map Container */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
        <div ref={mapContainerRef} className="h-full w-full z-0" />

        {/* Map Floating Overlays & Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white/95 text-xs font-bold text-slate-700 shadow-md backdrop-blur-xs hover:bg-white transition"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white/95 text-xs font-bold text-slate-700 shadow-md backdrop-blur-xs hover:bg-white transition"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            title="Re-center on My Location"
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur-xs hover:bg-white transition"
          >
            <LocateFixed className="h-4 w-4 text-sky-600" />
          </button>
        </div>

        {/* Live Status Badge on Map */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-slate-200/90 bg-white/95 p-2 shadow-md backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-600 animate-ping" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                LIVE GPS TELEMETRY
              </p>
              <p className="font-mono text-[11px] font-bold text-slate-800">
                {currentCoords.lat.toFixed(4)}° N, {currentCoords.lng.toFixed(4)}° E
              </p>
            </div>
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoadingFacilities && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-lg border border-slate-200">
              <RefreshCw className="h-4 w-4 animate-spin text-sky-600" />
              <span>Discovering real verified hospitals near you...</span>
            </div>
          </div>
        )}
      </div>

      {/* Facilities Cards Section Header & Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Hospital className="h-4 w-4 text-teal-600" />
            <h4 className="font-sans text-xs sm:text-sm font-bold text-slate-900">
              Real Verified Hospitals & Diagnostic Centers ({displayFacilities.length})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {/* Search within results */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-32 sm:w-44 rounded-lg border border-slate-200 pl-8 pr-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-hidden"
              />
            </div>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortBy((prev) => (prev === 'distance' ? 'name' : 'distance'))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
              title="Change sorting order"
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>{sortBy === 'distance' ? 'Nearest' : 'A-Z'}</span>
            </button>
          </div>
        </div>

        {/* Facilities Grid / Cards List */}
        {displayFacilities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <Hospital className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-xs font-bold text-slate-700">No facilities found within {searchRadiusKm} km</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Try expanding the search radius or choosing All Places.</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSearchRadiusKm(25)}
              className="mt-3 text-xs rounded-xl"
            >
              Expand Radius to 25 km
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {displayFacilities.map((fac) => {
              const isSelected = selectedFacilityId === fac.id;
              const categoryBadge = fac.isEmergency ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                  <ShieldAlert className="h-3 w-3" />
                  24/7 Emergency
                </span>
              ) : fac.category === 'clinic' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                  <Stethoscope className="h-3 w-3" />
                  Clinic
                </span>
              ) : fac.category === 'diagnostic' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-md">
                  <TestTube className="h-3 w-3" />
                  Diagnostic / Lab
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md">
                  <Hospital className="h-3 w-3" />
                  Hospital
                </span>
              );

              return (
                <div
                  key={fac.id}
                  onClick={() => handleSelectFacility(fac)}
                  className={`cursor-pointer rounded-xl border p-3 transition flex flex-col justify-between ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/50 shadow-xs ring-1 ring-sky-400'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-bold text-slate-900 text-xs line-clamp-1 leading-snug">
                        {fac.name}
                      </h5>
                      <span className="shrink-0 text-[11px] font-extrabold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md">
                        {fac.distanceKm} km
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {categoryBadge}
                      {fac.openingHours && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {fac.openingHours}
                        </span>
                      )}
                    </div>

                    {fac.address && (
                      <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-2 leading-tight">
                        {fac.address}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    {fac.phone ? (
                      <a
                        href={`tel:${fac.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700"
                      >
                        <Phone className="h-3 w-3" />
                        <span className="truncate max-w-[110px]">{fac.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No phone listed</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectFacility(fac);
                        }}
                        className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 transition"
                      >
                        Focus
                      </button>

                      <a
                        href={fac.directionsUrl || `https://www.google.com/maps/dir/?api=1&origin=${currentCoords.lat},${currentCoords.lng}&destination=${fac.latitude},${fac.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-sky-700 transition"
                      >
                        <span>Directions</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Attribution & Timestamp */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Data source: {dataProvider}</span>
          </div>
          <div>Last queried: {lastFetchTime}</div>
        </div>
      </div>
    </div>
  );
}
