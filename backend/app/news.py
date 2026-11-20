"""Latest crime & safety news from Google News RSS (public feed), cached to stay fast and polite."""
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

QUERY = ('("cyber fraud" OR "digital arrest" OR sextortion OR "online scam" OR stalking OR "dowry harassment" '
         'OR "sexual harassment" OR "cyber crime police") (Karnataka OR Bengaluru OR Mysuru)')
FEED = "https://news.google.com/rss/search?" + urllib.parse.urlencode(
    {"q": QUERY + " when:7d", "hl": "en-IN", "gl": "IN", "ceid": "IN:en"})
CACHE_SECONDS = 30 * 60
_cache = {"at": 0.0, "items": []}


def latest(limit: int = 8) -> list[dict]:
    if time.time() - _cache["at"] < CACHE_SECONDS and _cache["items"]:
        return _cache["items"][:limit]
    try:
        req = urllib.request.Request(FEED, headers={"User-Agent": "Mozilla/5.0 (PrajaRaksha news reader)"})
        root = ET.fromstring(urllib.request.urlopen(req, timeout=10).read())
        items = []
        for it in root.iter("item"):
            title = it.findtext("title", "")
            source = it.findtext("source", "")
            if source and title.endswith(" - " + source):
                title = title[: -len(source) - 3]
            pub = it.findtext("pubDate")
            items.append({
                "title": title, "link": it.findtext("link", ""), "source": source,
                "published": parsedate_to_datetime(pub).isoformat() if pub else None,
            })
        _cache.update(at=time.time(), items=items)
    except Exception as e:  # news is nice-to-have; never break the home page
        print(f"[news] fetch failed: {e}")
    return _cache["items"][:limit]
