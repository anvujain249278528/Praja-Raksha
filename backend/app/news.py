"""Latest crime & safety news from Google News RSS (public feed), by place, cached to stay fast and polite."""
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

TOPICS = ('("cyber fraud" OR "digital arrest" OR sextortion OR "online scam" OR stalking OR "dowry harassment" '
          'OR "sexual harassment" OR "cyber crime" OR "chain snatching" OR "cyber police")')
KARNATAKA = ["karnataka", "k'taka", "bengaluru", "bangalore", "mysuru", "mysore", "mangaluru", "mangalore", "hubballi",
             "hubli", "dharwad", "belagavi", "belgaum", "kalaburagi", "gulbarga", "ballari", "bellary", "shivamogga",
             "tumakuru", "udupi", "hassan", "mandya", "davanagere", "vijayapura", "raichur", "bidar", "kolar", "chikkamagaluru"]
INDIA = ["india", "indian", "₹", "rs ", "rs.", "lakh", "crore", "fir ", "delhi", "mumbai", "chennai", "hyderabad", "kolkata",
         "pune", "uttar pradesh", "bihar", "gujarat", "rajasthan", "kerala", "tamil nadu", "telangana", "maharashtra",
         "punjab", "haryana", "odisha", "assam", "madhya pradesh", "andhra", "jharkhand", "noida", "gurugram", *KARNATAKA]
ALIASES = {"mysuru": ["mysuru", "mysore"], "bengaluru": ["bengaluru", "bangalore"], "mangaluru": ["mangaluru", "mangalore"],
           "belagavi": ["belagavi", "belgaum"], "kalaburagi": ["kalaburagi", "gulbarga"], "hubballi": ["hubballi", "hubli"],
           "ballari": ["ballari", "bellary"], "shivamogga": ["shivamogga", "shimoga"], "tumakuru": ["tumakuru", "tumkur"]}
CACHE_SECONDS = 30 * 60
MAX_AGE_DAYS = 30
_cache: dict[str, tuple[float, list]] = {}


def _feed(place: str) -> str:
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": f"{TOPICS} {place} when:30d", "hl": "en-IN", "gl": "IN", "ceid": "IN:en"})


def latest(place: str = "Karnataka", limit: int = 8) -> list[dict]:
    place = (place or "Karnataka").strip()[:60]
    hit = _cache.get(place.lower())
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1][:limit]
    items = []
    try:
        req = urllib.request.Request(_feed(f'"{place}"'), headers={"User-Agent": "Mozilla/5.0 (PrajaRaksha news reader)"})
        root = ET.fromstring(urllib.request.urlopen(req, timeout=10).read())
        for it in root.iter("item"):
            title = it.findtext("title", "")
            source = it.findtext("source", "")
            if source and title.endswith(" - " + source):
                title = title[: -len(source) - 3]
            pub = it.findtext("pubDate")
            items.append({"title": title, "link": it.findtext("link", ""), "source": source,
                          "published": parsedate_to_datetime(pub).isoformat() if pub else None})
        items.sort(key=lambda x: x["published"] or "", reverse=True)
        # Google sometimes ignores "when:7d"; keep only the last MAX_AGE_DAYS ourselves.
        cutoff = (datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)).isoformat()
        items = [i for i in items if (i["published"] or "") >= cutoff]
        # Keep only stories that are actually about the place (news search also returns loosely related foreign items)
        words = _place_words(place)
        items = [i for i in items if any(w in i["title"].lower() for w in words)]
        _cache[place.lower()] = (time.time(), items)
    except Exception as e:  # news is nice-to-have; never break the home page
        print(f"[news] fetch failed for {place}: {e}")
        if hit:
            return hit[1][:limit]
    return items[:limit]


def _place_words(place: str) -> list[str]:
    p = place.lower()
    if p == "india":
        return INDIA
    if p == "karnataka":
        return KARNATAKA
    return ALIASES.get(p, [p])
