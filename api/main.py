import os
import sys
import json
import asyncio
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine
from engines.nld_mrz_engine import NldMrzEngine
from engines.exif_engine import ExifEngine
from engines.face_engine import FaceEngine
from engines.ai_bypass_engine import AIBypassEngine

app = FastAPI()
base_dir = os.path.dirname(os.path.abspath(__file__))

registry = {
    "energia": EnergiaEngine(base_dir),
    "ndls_mrz": MrzEngine(base_dir),
    "nld_mrz": NldMrzEngine(base_dir),
    "exif_cleaner": ExifEngine(base_dir),
    "face_cut": FaceEngine(base_dir),
    "ai_bypass": AIBypassEngine(base_dir)
}

@app.get("/api/schema/{module}")
async def get_schema(module: str):
    if module not in registry: raise HTTPException(404, "MOD_NOT_FOUND")
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(
    type: str = Form(...),
    lines: str = Form("[]"),
    scan_mode: str = Form("false"),
    file: Optional[UploadFile] = File(None)
):
    if type not in registry: raise HTTPException(404, "UNKNOWN_TYPE")
    
    try:
        p_lines = json.loads(lines)
        is_scan = scan_mode.lower() == "true"
        image_bytes = await file.read() if file else None
        
        engine = registry[type]
        if asyncio.iscoroutinefunction(engine.render):
            res = await engine.render(p_lines, is_scan, image_bytes)
        else:
            res = engine.render(p_lines, is_scan, image_bytes)
        
        if isinstance(res, dict): return JSONResponse(res)
        
        m_type = "image/jpeg" if type in ["exif_cleaner", "face_cut"] else "application/pdf"
        return StreamingResponse(res, media_type=m_type)
    except Exception as e:
        print(f"CORE_ERR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))