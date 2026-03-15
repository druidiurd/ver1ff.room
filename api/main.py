import os
import sys
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any, Optional

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine
from engines.exif_engine import ExifEngine

app = FastAPI()
bd = os.path.dirname(os.path.abspath(__file__))

registry = {
    "energia": EnergiaEngine(bd),
    "ndls_mrz": MrzEngine(bd),
    "exif_cleaner": ExifEngine(bd)
}

@app.get("/api/schema/{module}")
async def get_schema(module: str):
    if module not in registry: raise HTTPException(404)
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(
    type: str = Form(...),
    lines: str = Form("[]"),
    scan_mode: bool = Form(False),
    file: Optional[UploadFile] = File(None)
):
    if type not in registry: raise HTTPException(404)
    
    p_lines = json.loads(lines)
    img_bytes = await file.read() if file else None
    
    try:
        res = registry[type].render(p_lines, scan_mode, img_bytes)
        if isinstance(res, dict): return JSONResponse(res)
        
        m_type = "image/jpeg" if type == "exif_cleaner" else "application/pdf"
        return StreamingResponse(res, media_type=m_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))