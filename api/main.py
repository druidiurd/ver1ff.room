import os
import sys
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any, Optional

# Senior Path Logic: додаємо корінь api для стабільних імпортів [cite: 2026-02-05]
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine
from engines.exif_engine import ExifEngine
from engines.face_engine import FaceEngine

app = FastAPI()
base_dir = os.path.dirname(os.path.abspath(__file__))

# Реєстрація бойових юнітів [cite: 2026-03-15]
registry = {
    "energia": EnergiaEngine(base_dir),
    "ndls_mrz": MrzEngine(base_dir),
    "exif_cleaner": ExifEngine(base_dir),
    "face_cut": FaceEngine(base_dir)
}

@app.get("/api/schema/{module}")
async def get_schema(module: str):
    if module not in registry: 
        raise HTTPException(status_code=404, detail="MODULE_NOT_FOUND")
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(
    type: str = Form(...),
    lines: str = Form("[]"),
    scan_mode: str = Form("false"),
    file: Optional[UploadFile] = File(None)
):
    """Універсальний шлюз для всіх операцій [cite: 2026-02-21]."""
    if type not in registry: 
        raise HTTPException(status_code=404, detail="UNKNOWN_ENGINE")
    
    try:
        parsed_lines = json.loads(lines)
        is_scan = scan_mode.lower() == "true"
        image_data = await file.read() if file else None
        
        engine = registry[type]
        result = engine.render(parsed_lines, is_scan, image_data)
        
        if isinstance(result, dict):
            return JSONResponse(result)
        
        # Визначаємо MIME-тип на основі модуля [cite: 2026-02-05]
        m_type = "image/jpeg" if type in ["exif_cleaner", "face_cut"] else "application/pdf"
        return StreamingResponse(result, media_type=m_type)
        
    except Exception as e:
        # Жорсткий лог для дебагу на продакшені [cite: 2026-02-05]
        print(f"CRITICAL_ERROR_{type.upper()}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))