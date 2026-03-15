import os
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any

# Імпорт твоїх нових двигунів [cite: 2026-02-21]
from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine

app = FastAPI()
bp = os.path.dirname(os.path.abspath(__file__))

# Реєстрація модулів
registry = {
    "energia": EnergiaEngine(bp),
    "ndls_mrz": MrzEngine(bp)
}

@app.get("/api/schema/{module}")
async def get_schema(module: str):
    if module not in registry: raise HTTPException(404)
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(payload: Dict[str, Any] = Body(...)):
    mod_id = payload.get("type", "energia")
    if mod_id not in registry: raise HTTPException(404)
    
    engine = registry[mod_id]
    result = engine.render(payload.get("lines", []), payload.get("scan_mode", False))
    
    if isinstance(result, dict):
        return JSONResponse(result)
    return StreamingResponse(result, media_type="application/pdf")