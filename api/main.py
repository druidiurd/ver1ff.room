import os, sys, json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional
from PIL import Image

# Senior Performance Reset [cite: 2026-03-16]
Image.MAX_IMAGE_PIXELS = None 

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine
from engines.exif_engine import ExifEngine
from engines.face_engine import FaceEngine

app = FastAPI()
bd = os.path.dirname(os.path.abspath(__file__))

# Жорсткий реєстр: ключ 'face_cut' має збігатися з фронтендом [cite: 2026-03-16]
registry = {
    "energia": EnergiaEngine(bd),
    "ndls_mrz": MrzEngine(bd),
    "exif_cleaner": ExifEngine(bd),
    "face_cut": FaceEngine(bd)
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
        
        res = registry[type].render(p_lines, is_scan, image_data)
        if isinstance(res, dict): return JSONResponse(res)
        
        m_type = "image/jpeg" if type in ["exif_cleaner", "face_cut"] else "application/pdf"
        return StreamingResponse(res, media_type=m_type)
    except Exception as e:
        print(f"CRASH_LOG: {str(e)}")
        raise HTTPException(500, detail=str(e))