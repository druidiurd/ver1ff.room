import os
import sys
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine
from engines.face_engine import FaceEngine

app = FastAPI()
base_dir = os.path.dirname(os.path.abspath(__file__))

registry = {
    "energia": EnergiaEngine(base_dir),
    "ndls_mrz": MrzEngine(base_dir),
    "face_crop": FaceEngine(base_dir)
}

@app.get("/api/schema/{module}")
async def get_schema(module: str):
    if module not in registry: raise HTTPException(404)
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(payload: Dict[str, Any] = Body(...)):
    mod_id = payload.get("type", "energia")
    if mod_id not in registry: raise HTTPException(404)
    
    # Специфічна маршрутизація для Face Crop [cite: 2026-02-21]
    if mod_id == "face_crop":
        res = registry[mod_id].render(payload.get("image", ""), payload.get("padding", 20))
        return JSONResponse(res)

    result = registry[mod_id].render(payload.get("lines", []), payload.get("scan_mode", False))
    if isinstance(result, dict):
        return JSONResponse(result)
    return StreamingResponse(result, media_type="application/pdf")