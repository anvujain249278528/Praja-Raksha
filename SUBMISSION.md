# IDEA//FORGE submission text: Praja Raksha

Copy each section into the matching field on Challazo.

---

## Project name

Praja Raksha: Your AI Legal Shield

## Track

Track 1: Civic Pulse, Digital Governance & Public Information

## One-line summary

A multilingual, multi-agent AI that turns a citizen's spoken complaint into the right laws, a drafted FIR, an online filing and
automatic escalation if the police do not act.

---

## Problem statement

Women facing harassment and stalking, elderly people targeted by "digital arrest" and UPI scams, domestic violence survivors,
and first-time internet users in towns and villages, especially those more comfortable in Kannada or Hindi than English,
struggle to get justice when they are victims of a crime.

They face four barriers:

1. **They don't know which law protects them.** Legal language is hard, and India's criminal laws were replaced in 2024 (IPC → BNS, CrPC → BNSS).
2. **They fear or avoid the police station.** Few know they can file a Zero FIR at any station, and many are turned away.
3. **When police don't act, they give up.** Almost nobody knows the legal escalation path: a letter to the Superintendent of Police (BNSS 173(4)), then the Magistrate (BNSS 175(3)).
4. **Online systems are English-heavy forms**, and evidence such as screenshots and call recordings is easily lost.

This matters because the scale is huge and growing. NCRB's *Crime in India 2022* report records 4,45,256 crimes against women and
65,893 cyber crimes in India (up 24.4% in one year), 12,556 of them in Karnataka. Many more go unreported because victims don't
know their rights or how to use them. Every unreported or abandoned complaint means a victim without protection and an offender
without consequences.

---

## Solution description

Praja Raksha is an AI legal first-aid platform where a citizen describes their problem once, by voice or text in any of 12 Indian
languages (Kannada, Hindi, English, Tamil, Telugu, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Urdu), with answers
read aloud by voice-over, and six AI agents do the work for them:

1. **Evidence Agent:** reads uploaded screenshots and call recordings (Gemini multimodal), extracts threats, demands, phone
   numbers, usernames and UPI IDs, builds a timeline, and records a SHA-256 fingerprint of every file.
2. **Legal Analysis Agent:** maps the facts to the exact sections of BNS, BNSS, IT Act, DV Act, POSH and POCSO, explains them in
   the user's language (with voice playback), rates severity and lists the legal actions in order. It can only cite sections from
   a verified legal knowledge base; any section the AI invents is rejected by code.
3. **Drafting Agent:** writes a formal FIR complaint, SP letter or Magistrate application, editable and downloadable as PDF.
4. **Filing Agent:** a browser agent (Playwright) that opens an online complaint portal and runs an observe → decide → act → verify
   loop. It reads the form and its error messages, decides what to fill with Gemini, types and clicks, fixes validation errors and
   returns the acknowledgement number. It never invents personal details; if information is missing it stops and asks the user.
   Citizens can file publicly or anonymously.
5. **Tracking & Escalation Agent:** checks the complaint status every hour. If police take no action within the 14-day enquiry
   window, it automatically drafts the SP letter; after 30 days or a closure without FIR, the Magistrate application.
6. **Moderation Agent:** keeps citizen reviews and feedback free of abuse and personal details.

The website also shows live crime news for the user's city, official crime statistics, one-tap emergency helplines, and a map of
nearby police stations (from OpenStreetMap, with the right station for the case, such as the Cyber Crime Police Station, ranked
first), plus free legal aid and lawyers matched to the case, with citizen ratings and reviews.

**Tech:** React, Tailwind, Leaflet, Web Speech API · FastAPI, SQLite · Google Gemini · Playwright · OpenStreetMap.

**Note for judges:** for safety, the Filing Agent operates a demo e-complaint portal that simulates a government site (real portals
need OTP/CAPTCHA and must not receive test complaints). Demo lawyers, the Demo Police Station and sample reviews are clearly labelled.
Built with the help of Claude Code as an AI coding assistant.

---

## Links

- Working MVP: https://praja-raksha.onrender.com  (free hosting: first visit after idle may take ~1 minute to wake up)
- Demo video: _add after recording_
- GitHub: https://github.com/anvujain249278528/Praja-Raksha
