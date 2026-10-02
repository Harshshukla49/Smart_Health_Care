"""
Real Places & Hospital Discovery Service
Retrieves authentic hospital, emergency, clinic, and diagnostic centre POI data
from OpenStreetMap (Nominatim / Overpass) and Google Places API (if configured).
Never generates fictional hospital names or mock data.
"""

import math
import os
import time
import requests

# In-memory TTL cache for places queries
_PLACES_CACHE = {}
_CACHE_TTL_SECONDS = 600  # 10 minutes cache per location bucket


def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """
    Computes precise distance between two GPS coordinates in kilometers.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 0.0
    r = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 2)


def fetch_real_nearby_facilities(
    lat,
    lng,
    radius_km=10.0,
    facility_type="all",
    limit=30,
    google_api_key=None,
):
    """
    Discovers authentic hospitals, clinics, emergency trauma, and diagnostic centers
    near the provided GPS coordinates.
    """
    try:
        lat = float(lat)
        lng = float(lng)
        radius_km = max(1.0, min(50.0, float(radius_km)))
        limit = max(1, min(60, int(limit)))
    except (ValueError, TypeError):
        lat = 28.6139
        lng = 77.2090
        radius_km = 10.0
        limit = 30

    cache_key = f"{round(lat, 2)}_{round(lng, 2)}_{radius_km}_{facility_type}"
    now = time.time()
    if cache_key in _PLACES_CACHE:
        entry = _PLACES_CACHE[cache_key]
        if now - entry["timestamp"] < _CACHE_TTL_SECONDS:
            return entry["data"]

    facilities_map = {}
    provider = "OpenStreetMap Healthcare POI Database"

    # 1. Google Places API query (if key supplied or configured in environment)
    resolved_google_key = (
        google_api_key
        or os.environ.get("GOOGLE_MAPS_API_KEY")
        or os.environ.get("GOOGLE_PLACES_API_KEY")
    )

    if resolved_google_key:
        try:
            g_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            g_params = {
                "location": f"{lat},{lng}",
                "radius": int(radius_km * 1000),
                "type": "hospital",
                "key": resolved_google_key,
            }
            g_res = requests.get(g_url, params=g_params, timeout=6)
            if g_res.status_code == 200:
                g_data = g_res.json()
                results = g_data.get("results", [])
                if results:
                    provider = "Google Places API Nearby Search"
                for place in results:
                    p_id = place.get("place_id")
                    name = place.get("name")
                    loc = place.get("geometry", {}).get("location", {})
                    p_lat = loc.get("lat")
                    p_lng = loc.get("lng")
                    if not p_lat or not p_lng or not name:
                        continue
                    dist = calculate_haversine_distance(lat, lng, p_lat, p_lng)
                    if dist > radius_km * 1.2:
                        continue

                    name_lower = name.lower()
                    types = place.get("types", [])
                    is_emergency = "emergency" in name_lower or "trauma" in name_lower

                    cat = "hospital"
                    if "diagnostic" in name_lower or "laboratory" in name_lower or "pathology" in name_lower:
                        cat = "diagnostic"
                    elif "clinic" in name_lower or "dispensary" in name_lower or "doctor" in types:
                        cat = "clinic"
                    elif is_emergency:
                        cat = "emergency"

                    facilities_map[p_id] = {
                        "id": f"g_{p_id}",
                        "name": name,
                        "category": cat,
                        "isEmergency": is_emergency,
                        "latitude": p_lat,
                        "longitude": p_lng,
                        "distanceKm": dist,
                        "address": place.get("vicinity"),
                        "city": None,
                        "phone": None,
                        "website": None,
                        "openingHours": "Open Now" if place.get("opening_hours", {}).get("open_now") else None,
                        "operator": None,
                        "rating": place.get("rating"),
                        "userRatingsTotal": place.get("user_ratings_total"),
                        "directionsUrl": f"https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={p_lat},{p_lng}",
                    }
        except Exception as g_err:
            print(f"[PlacesService] Google Places API warning: {g_err}")

    # 2. OpenStreetMap Nominatim Healthcare POI Query (High reliability, structured tags, addresses, phones)
    if len(facilities_map) < 8:
        delta = max(0.04, min(0.35, radius_km / 111.0))
        viewbox = f"{lng - delta:.4f},{lat + delta:.4f},{lng + delta:.4f},{lat - delta:.4f}"

        search_terms = ["hospital", "clinic", "trauma center", "diagnostic centre", "dispensary"]
        if facility_type == "hospital":
            search_terms = ["hospital"]
        elif facility_type == "emergency":
            search_terms = ["trauma center", "emergency hospital", "hospital"]
        elif facility_type == "clinic":
            search_terms = ["clinic", "dispensary", "polyclinic"]
        elif facility_type == "diagnostic":
            search_terms = ["diagnostic centre", "pathology lab", "medical laboratory"]

        headers = {
            "User-Agent": "SmartHealthcareAssistant/2.0 (contact: info@smarthealthcare.org; healthcare telemetry portal)",
            "Accept": "application/json",
        }

        for query_term in search_terms:
            try:
                nom_params = {
                    "q": query_term,
                    "format": "jsonv2",
                    "viewbox": viewbox,
                    "bounded": 1,
                    "limit": min(30, limit),
                    "addressdetails": 1,
                    "extratags": 1,
                }
                nom_res = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params=nom_params,
                    headers=headers,
                    timeout=6,
                )
                if nom_res.status_code == 200:
                    items = nom_res.json()
                    for item in items:
                        place_id = str(item.get("place_id"))
                        if place_id in facilities_map:
                            continue

                        raw_name = item.get("name") or (
                            item.get("display_name", "").split(",")[0]
                            if item.get("display_name")
                            else ""
                        )
                        raw_name = raw_name.strip()
                        if not raw_name or len(raw_name) < 3:
                            continue

                        try:
                            p_lat = float(item.get("lat"))
                            p_lng = float(item.get("lon"))
                        except (ValueError, TypeError):
                            continue

                        dist = calculate_haversine_distance(lat, lng, p_lat, p_lng)
                        if dist > radius_km * 1.3:
                            continue

                        extratags = item.get("extratags") or {}
                        addrtags = item.get("address") or {}

                        is_emergency = (
                            extratags.get("emergency") in ["yes", "designated"]
                            or "emergency" in raw_name.lower()
                            or "trauma" in raw_name.lower()
                        )

                        cat = "hospital"
                        raw_name_lower = raw_name.lower()
                        item_type = item.get("type", "").lower()
                        if (
                            "diagnostic" in raw_name_lower
                            or "pathology" in raw_name_lower
                            or "lab" in raw_name_lower
                            or item_type in ["laboratory", "diagnostic_centre"]
                        ):
                            cat = "diagnostic"
                        elif (
                            "clinic" in raw_name_lower
                            or "dispensary" in raw_name_lower
                            or "polyclinic" in raw_name_lower
                            or item_type in ["clinic", "doctors"]
                        ):
                            cat = "clinic"
                        elif is_emergency:
                            cat = "emergency"

                        addr_parts = []
                        for k in [
                            "building",
                            "house_number",
                            "road",
                            "neighbourhood",
                            "suburb",
                            "city",
                            "state",
                            "postcode",
                        ]:
                            val = addrtags.get(k)
                            if val and val not in addr_parts:
                                addr_parts.append(val)
                        formatted_addr = (
                            ", ".join(addr_parts) if addr_parts else item.get("display_name")
                        )

                        phone = (
                            extratags.get("phone")
                            or extratags.get("contact:phone")
                            or None
                        )
                        website = (
                            extratags.get("website")
                            or extratags.get("contact:website")
                            or None
                        )
                        opening_hours = extratags.get("opening_hours") or None
                        operator = extratags.get("operator") or None

                        facilities_map[place_id] = {
                            "id": f"osm_{place_id}",
                            "name": raw_name,
                            "category": cat,
                            "isEmergency": is_emergency,
                            "latitude": p_lat,
                            "longitude": p_lng,
                            "distanceKm": dist,
                            "address": formatted_addr,
                            "city": (
                                addrtags.get("city")
                                or addrtags.get("town")
                                or addrtags.get("county")
                                or None
                            ),
                            "phone": phone,
                            "website": website,
                            "openingHours": opening_hours,
                            "operator": operator,
                            "rating": None,
                            "directionsUrl": f"https://www.google.com/maps/dir/?api=1&origin={lat},{lng}&destination={p_lat},{p_lng}",
                        }
            except Exception as e:
                print(f"[PlacesService] Nominatim search error for '{query_term}': {e}")
                time.sleep(0.3)

    facility_list = list(facilities_map.values())

    # Apply category filter
    if facility_type and facility_type != "all":
        if facility_type == "emergency":
            facility_list = [
                f for f in facility_list if f["isEmergency"] or f["category"] == "emergency"
            ]
        else:
            facility_list = [
                f for f in facility_list if f["category"] == facility_type
            ]

    # Sort strictly by distance (nearest first)
    facility_list.sort(key=lambda x: x["distanceKm"])
    facility_list = facility_list[:limit]

    result = {
        "status": "success",
        "count": len(facility_list),
        "center": {"latitude": lat, "longitude": lng},
        "radiusKm": radius_km,
        "facilityType": facility_type,
        "provider": provider,
        "lastUpdated": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "facilities": facility_list,
    }

    _PLACES_CACHE[cache_key] = {"timestamp": now, "data": result}
    return result
