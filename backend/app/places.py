"""Nearby police stations (live from OpenStreetMap) and lawyers / legal aid (directory), with citizen ratings."""
import json
import math
import time
import urllib.parse
import urllib.request

from . import db
from .config import DATA_DIR

# Public OpenStreetMap Overpass servers; if one is busy we try the next.
OVERPASS_SERVERS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
UA = {"User-Agent": "PrajaRaksha/1.0 (hackathon prototype)"}


def _nominatim(lat: float, lon: float, radius_m: int) -> list[dict]:
    """Fast primary source: OpenStreetMap's Nominatim search for police stations inside a box around the user."""
    dlat = radius_m / 111_000
    dlon = dlat / max(math.cos(math.radians(lat)), 0.1)
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": "police", "format": "jsonv2", "limit": 50, "accept-language": "en", "bounded": 1, "extratags": 1,
        "viewbox": f"{lon - dlon},{lat + dlat},{lon + dlon},{lat - dlat}"})
    rows = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=10).read())
    return [{"type": r["osm_type"], "id": r["osm_id"], "lat": float(r["lat"]), "lon": float(r["lon"]),
             "tags": {"name": r.get("name") or "Police Station", **(r.get("extratags") or {})},
             "address": ", ".join(r["display_name"].split(", ")[1:4])}
            for r in rows if r.get("type") == "police"]


def _overpass(query: str) -> list:
    last = None
    for url in OVERPASS_SERVERS:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": query}).encode(),
                                         headers=UA)
            return json.loads(urllib.request.urlopen(req, timeout=15).read())["elements"]
        except Exception as e:
            last = e
    raise RuntimeError(f"All map servers are busy: {last}")


DEMO_POLICE_ID = "demo-police-1"
_cache: dict[tuple, tuple[float, list]] = {}

# Which lawyer specialisations fit each complaint category from the Legal Analysis Agent
CATEGORY_TO_SPECIALISATION = {
    "cyber_crime": ["cyber"], "harassment_women": ["women", "criminal"], "domestic_violence": ["family", "women"],
    "physical_assault": ["criminal"], "threat_intimidation": ["criminal"], "fraud_cheating": ["criminal", "cyber"],
    "property_theft": ["criminal", "property"], "workplace_harassment": ["labour", "women"],
    "child_abuse": ["criminal", "women"], "caste_atrocity": ["criminal", "human rights"], "consumer": ["consumer"],
}


def distance_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def _bundled(lat: float, lon: float, radius_m: int) -> list[dict]:
    """Police stations from the bundled OpenStreetMap snapshot (data/police_osm.json) within the radius."""
    global _snapshot
    if _snapshot is None:
        path = DATA_DIR / "police_osm.json"
        _snapshot = json.loads(path.read_text(encoding="utf-8"))["stations"] if path.exists() else []
    out = []
    for s in _snapshot:
        if distance_km(lat, lon, s["lat"], s["lon"]) * 1000 <= radius_m:
            _, osm_type, osm_id = s["id"].split("-", 2)
            out.append({"type": osm_type, "id": osm_id, "lat": s["lat"], "lon": s["lon"], "tags": s["tags"],
                        "address": s.get("address", "")})
    return out


_snapshot = None


def police_stations(lat: float, lon: float, radius_m: int = 8000) -> list[dict]:
    key = (round(lat, 2), round(lon, 2), radius_m)
    if key in _cache and time.time() - _cache[key][0] < 3600:
        stations = _cache[key][1]
    else:
        query = f"""[out:json][timeout:20];
        (node["amenity"="police"](around:{radius_m},{lat},{lon});
         way["amenity"="police"](around:{radius_m},{lat},{lon}););
        out center tags;"""
        # Bundled OpenStreetMap snapshot first (fast, and public map servers often block cloud servers);
        # live lookup only for places outside the snapshot.
        elements = _bundled(lat, lon, radius_m)
        if len(elements) < 3:
            try:
                elements = _nominatim(lat, lon, radius_m)
            except Exception as e:
                print(f"[places] nominatim failed ({type(e).__name__}), trying overpass")
                try:
                    elements = _overpass(query)
                except Exception:
                    # Live servers unavailable: use the snapshot with a wider radius rather than failing
                    elements = _bundled(lat, lon, 25000)
                    if not elements:
                        raise
        stations = []
        for e in elements:
            t = e.get("tags", {})
            plat, plon = e.get("lat") or e["center"]["lat"], e.get("lon") or e["center"]["lon"]
            name = t.get("name:en") or t.get("name") or "Police Station"
            stations.append({
                "id": f"osm-{e['type']}-{e['id']}", "name": name, "lat": plat, "lon": plon,
                "phone": t.get("phone") or t.get("contact:phone"),
                "address": e.get("address") or ", ".join(x for x in [t.get("addr:street"), t.get("addr:suburb"), t.get("addr:city")] if x),
                "is_cyber": any(w in name.lower() for w in ("cyber", "cen ", "c.e.n", "cen crime")),
                "is_women": "women" in name.lower() or "vanitha" in name.lower(),
            })
        _cache[key] = (time.time(), stations)
    # One clearly-fictional listing so the rating feature can be demonstrated without touching real stations
    demo = {"id": DEMO_POLICE_ID, "name": "Demo Police Station (Sample)", "lat": lat + 0.011, "lon": lon + 0.008,
            "phone": None, "address": "Fictional listing for the prototype demo", "is_cyber": False, "is_women": False, "demo": True}
    out = [{**s, "distance_km": distance_km(lat, lon, s["lat"], s["lon"]), **db.rating_summary("police", s["id"])}
           for s in [*stations, demo]]
    return sorted(out, key=lambda s: s["distance_km"])


def lawyers(lat: float, lon: float, category: str = "") -> list[dict]:
    with open(DATA_DIR / "lawyers.json", encoding="utf-8") as f:
        data = json.load(f)
    wanted = CATEGORY_TO_SPECIALISATION.get(category, [])
    out = []
    for l in data["lawyers"]:
        match = [s for s in l["specialisations"] if s in wanted]
        out.append({**l, "distance_km": distance_km(lat, lon, l["lat"], l["lon"]), "matches_case": bool(match),
                    **db.rating_summary("lawyer", l["id"])})
    # Nearby free legal aid first, then nearby lawyers who fit the case, then everyone by distance
    near = lambda l: l["distance_km"] <= 60
    return sorted(out, key=lambda l: (not (l.get("free_legal_aid") and near(l)), not (l["matches_case"] and near(l)), l["distance_km"]))


def reverse_geocode(lat: float, lon: float) -> dict:
    url = "https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(
        {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10, "accept-language": "en"})
    a = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=10).read()).get("address", {})
    city = a.get("city") or a.get("town") or a.get("state_district") or a.get("county") or a.get("state") or "India"
    return {"place": city.replace(" City", "").replace(" district", "").strip(), "state": a.get("state", "")}
