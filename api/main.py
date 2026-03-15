import os
import sys
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any, Optional

# Додаємо шлях для стабільних імпортів модулів [cite: 2026-02-05]
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine
from engines.exif_engine import ExifEngine
from engines.face_engine import FaceEngine

app = FastAPI()
base_dir = os.path.dirname(os.path.abspath(__file__))

# Реєстрація всіх бойових модулів [cite: 2026-02-21]
registry = {
    "energia": EnergiaEngine(base_dir),
    "ndls_mrz": MrzEngine(base_dir),
    "exif_cleaner": ExifEngine(base_dir),
    "face_cut": FaceEngine(base_dir)
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
    """Універсальний шлюз: фікс помилки 422 [cite: 2026-03-15]."""
    if type not in registry: raise HTTPException(404, "UNKNOWN_TYPE")
    
    try:
        p_lines = json.loads(lines)
        is_scan = scan_mode.lower() == "true"
        image_bytes = await file.read() if file else None
        
        res = registry[type].render(p_lines, is_scan, image_bytes)
        
        if isinstance(res, dict): return JSONResponse(res)
        
        m_type = "image/jpeg" if type in ["exif_cleaner", "face_cut"] else "application/pdf"
        return StreamingResponse(res, media_type=m_type)
    except Exception as e:
        print(f"CORE_ERR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))