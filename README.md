# Praja Raksha: Your AI Legal Shield

> **Speak your problem. Know your rights. Get it filed.**

Praja Raksha is a multilingual, multi-agent AI platform that helps Indian citizens who face harassment, threats, fraud or abuse
go from *"I don't know what to do"* to *a filed police complaint that is tracked and escalated*, in their own language.

Built for **IDEA//FORGE 2026**, Track 1: *Civic Pulse, Digital Governance & Public Information*.

**Live demo:** _add link after deployment_ · **Demo video:** _add link_

---

## The problem

**Who faces it:** women facing online and offline harassment, elderly people targeted by "digital arrest" and UPI scams,
domestic violence survivors, and first-time internet users in small towns and villages, especially those more comfortable in
Kannada or Hindi than English.

**Why it matters:**
- Victims **don't know which law protects them.** Laws were renamed in 2024 (IPC → BNS, CrPC → BNSS), and legal language is hard even for graduates.
- They **fear or avoid the police station**, don't know they can file a **Zero FIR** at any station, and are often turned away.
- When police **don't act**, almost nobody knows the legal escalation path (Superintendent of Police under BNSS 173(4), then the Magistrate under BNSS 175(3)).
- Online portals are **English-heavy and form-based**, and evidence (screenshots, call recordings) is easily lost or disputed.

The scale is large. NCRB's *Crime in India 2022* report records 4,45,256 crimes against women and 65,893 cyber crime cases in India
(up 24.4% in a year), of which 12,556 were in Karnataka. Many more go unreported.

## The solution

A citizen describes the problem once, by **voice or text in Kannada, Hindi or English**, optionally with screenshots or recordings.
Six AI agents then do the work:

| # | Agent | What it does |
|---|---|---|
| 1 | **Evidence Agent** | Reads screenshots and audio with Gemini's multimodal model, extracts threats, demands, usernames, phone numbers and UPI IDs, builds a timeline, and records a **SHA-256 fingerprint** of every file. |
| 2 | **Legal Analysis Agent** | Maps the facts to sections of BNS, BNSS, IT Act, DV Act, POSH, POCSO and more, **only from a verified legal knowledge base**. Any section the AI invents is rejected by code (grounding guardrail). It also rates severity and lists the legal actions in order. |
| 3 | **Drafting Agent** | Writes a formal FIR complaint, a letter to the SP (BNSS 173(4)) or an application to the Magistrate (BNSS 175(3)), editable and downloadable as PDF. |
| 4 | **Filing Agent** | A **browser agent (Playwright)** that opens an online complaint portal and runs an *observe → decide → act → verify* loop: reads the form fields and error messages, asks Gemini what to fill, types and clicks, fixes validation errors, and returns the **acknowledgement number**. It never invents personal details; if something is missing it **stops and asks the user**. |
| 5 | **Tracking & Escalation Agent** | Checks the complaint status on the portal (in a browser) every hour. If police take no action within 14 days (the preliminary-enquiry window in BNSS 173(3)), it **automatically drafts the SP letter**; after 30 days or a closure without FIR, the **Magistrate application**. Deadlines are fixed legal rules, not AI guesses. |
| 6 | **Moderation Agent** | Checks citizen reviews and feedback before publishing: blocks abuse, threats, slurs, phone numbers and names of private persons. |

Plus a full citizen website:
- **Home:** live crime and safety news for the user's city or all India, official NCRB statistics, and how the agents work.
- **Helplines:** 112, 181, 1091, 1930, 1098, 15100 and more, one tap to call.
- **Police & lawyers near you:** a map of real police stations from OpenStreetMap, ranked for the case (for example, the Cyber Crime Police Station first for cyber cases), free legal aid (DLSA) and lawyers matched to the case type, with **citizen ratings and reviews**.
- **Public or anonymous complaints:** anonymous mode shares only the district, never the identity.
- **Track:** status, the agent's decision, and auto-drafted escalation letters.
- **Feedback** on every page.

## How it works

```
 Citizen (voice / text / screenshots, Kannada · Hindi · English)
        │
        ▼
 ┌──────────────┐   ┌────────────────────┐   ┌────────────────┐   ┌────────────────┐
 │Evidence Agent│──▶│Legal Analysis Agent│──▶│ Drafting Agent │──▶│ Filing Agent   │──▶ Acknowledgement no.
 │ Gemini vision│   │ Gemini + verified  │   │ Gemini → PDF   │   │ Playwright +   │
 │ + SHA-256    │   │ legal KB + guardrail│  │                │   │ Gemini (loop)  │
 └──────────────┘   └────────────────────┘   └────────────────┘   └───────┬────────┘
                                                                          ▼
                                     ┌──────────────────────────────────────────────┐
                                     │ Tracking & Escalation Agent (hourly)          │
                                     │ portal status → legal rules → SP / Magistrate │
                                     └──────────────────────────────────────────────┘
```

**Reliability:** a shared Gemini caller tries the best model first, falls back to faster models when one is overloaded,
remembers failing models for 5 minutes, and uses short timeouts, so a busy AI model never freezes the app.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Leaflet (maps), Web Speech API (voice in/out) |
| Backend | Python, FastAPI, SQLite |
| AI | Google Gemini (structured JSON output, multimodal image/audio) |
| Browser automation | Playwright (Chromium) |
| Documents | ReportLab (PDF) |
| Open data | OpenStreetMap (Nominatim, Overpass), Google News RSS |

## Run it locally

Requirements: Python 3.12+, Node.js 20+, a free Gemini API key from https://aistudio.google.com/apikey

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install fastapi "uvicorn[standard]" google-genai python-dotenv python-multipart reportlab playwright
python -m playwright install chromium
copy .env.example .env            # then put your key in GEMINI_API_KEY

# Frontend (build once; the backend serves it)
cd ../frontend
npm install
npm run build

# Start everything on http://localhost:8000
cd ../backend
uvicorn app.main:app --port 8000
```

Environment variables (`backend/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | (required) | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Preferred model (fallbacks are automatic) |
| `AUTO_TRACK_MINUTES` | `60` | How often the Tracking Agent re-checks complaints (0 = off) |
| `PORTAL_URL` | this app's `/portal/` | Portal the Filing and Tracking Agents operate |

## Project structure

```
backend/app/
  agents/        evidence, legal, drafting, filing, tracking, moderation agents
  data/          legal_kb.json (verified laws), lawyers.json, sample_reviews.json
  portal/        demo e-complaint portal used by the Filing and Tracking agents
  llm.py         Gemini caller with model fallback and cooldown
  places.py      police stations (OpenStreetMap), lawyers, distance ranking
  news.py        location-based crime news
  db.py          SQLite: complaints, cases, reviews, feedback
  main.py        API + serves the React build
frontend/src/
  pages/         Home, Helplines, ComplaintPage, Nearby
  components/    complaint form, agent panel, results, draft, filing, tracking, reviews, feedback
samples/         sample WhatsApp threat screenshot and generated FIR PDF
```

## Safety, privacy and honesty

- **No invented laws:** the AI can only cite sections from `legal_kb.json`; anything else is dropped by code.
- **No invented facts:** the Filing Agent never makes up names, phones or dates. It asks the user instead.
- **Consent:** the agent files only after the user ticks *"I confirm and authorise"*.
- **Anonymity:** anonymous complaints store no name, phone, email or address.
- **Evidence integrity:** SHA-256 fingerprints of uploaded files.
- **Moderated reviews:** abuse, slurs and personal details are blocked.
- **Clear labels:** the complaint portal is a **demo portal** (real portals need OTP/CAPTCHA and must not receive test complaints).
  Advocates marked *Demo data*, the *Demo Police Station*, reviews tagged *Sample (demo)* and success stories tagged
  *Illustrative example* are not real. Real police stations show only real citizen reviews.
- Praja Raksha gives **legal information, not legal advice**.

## Limitations and next steps

- Integrate with official portals (cybercrime.gov.in, state police e-FIR) through official APIs or partnerships.
- Onboard verified advocates through the Bar Council and DLSAs.
- Grow the legal knowledge base with review by lawyers; add more Indian languages.
- WhatsApp and IVR (phone call) access for users without smartphones.
- SMS/WhatsApp alerts from the Tracking Agent.

## Credits

- **AI model:** Google Gemini (via the `google-genai` SDK)
- **Libraries:** FastAPI, Uvicorn, Playwright, ReportLab, React, Vite, Tailwind CSS, Leaflet / React-Leaflet, Lucide icons, Pydantic
- **Data:** OpenStreetMap contributors (map tiles, Nominatim, Overpass), Google News RSS, NCRB *Crime in India 2022*,
  India Code (bare acts), government helpline directories
- **Development:** built with the help of Claude Code (Anthropic) as an AI coding assistant

## Disclaimer

Praja Raksha is a hackathon prototype. It provides legal information to help citizens understand their options; it is not a
substitute for advice from a qualified lawyer. In an emergency, call **112**.
