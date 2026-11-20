from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agents import legal_agent

app = FastAPI(title="Praja Raksha API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class AnalyzeRequest(BaseModel):
    complaint: str
    evidence_notes: str = ""


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    if len(req.complaint.strip()) < 10:
        raise HTTPException(400, "Please describe the problem in a little more detail.")
    try:
        return legal_agent.analyze(req.complaint, req.evidence_notes)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
