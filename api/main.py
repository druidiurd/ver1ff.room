import os
import sys
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any, Optional
from PIL import Image

# Відключаємо ліміт пікселів для обробки важких фото, 
# але захищаємо логіку в двигунах [cite: 2026-03-16]
Image.MAX_IMAGE_PIXELS = None 

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine
from engines.exif_engine import ExifEngine
from engines.face_engine import FaceEngine

app = FastAPI()
base_dir = os.path.dirname(os.path.abspath(__file__))

registry = {
    "energia": EnergiaEngine(base_dir),
    "ndls_mrz": MrzEngine(base_dir),
    "exif_cleaner": ExifEngine(base_dir),
    "face_cut": FaceEngine(base_dir)
}

@app.get("/api/schema/{module}")
async def get_schema(module: str):
    if module not in registry: raise HTTPException(404)
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(
    type: str = Form(...),
    lines: str = Form("[]"),
    scan_mode: str = Form("false"),
    file: Optional[UploadFile] = File(None)
):
    if type not in registry: raise HTTPException(404)
    
    try:
        p_lines = json.loads(lines)
        is_scan = scan_mode.lower() == "true"
        image_data = await file.read() if file else None
        
        engine = registry[type]
        result = engine.render(p_lines, is_scan, image_data)
        
        if isinstance(result, dict): return JSONResponse(result)
        
        m_type = "image/jpeg" if type in ["exif_cleaner", "face_cut"] else "application/pdf"
        return StreamingResponse(result, media_type=m_type)
        
    except Exception as e:
        # Логування помилки в консоль Vercel для дебагу [cite: 2026-03-15]
        print(f"CORE_ERR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))