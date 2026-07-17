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
from engines.fra_mrz_engine import FraMrzEngine
from engines.face_engine import FaceEngine
from engines.ai_bypass_engine import AIBypassEngine
from engines.revolut_engine import RevolutEngine
from engines.mrz_gen_engine import MrzGenEngine
from engines.ita_cf_engine import ItaCfEngine
from engines.deu_tax_engine import DeuTaxEngine

app = FastAPI()
base_dir = os.path.dirname(os.path.abspath(__file__))

registry = {
    "energia":    EnergiaEngine(base_dir),
    "ndls_mrz":   MrzEngine(base_dir),
    "nld_mrz":    NldMrzEngine(base_dir),
    "fra_mrz":    FraMrzEngine(base_dir),
    "exif_cleaner": ExifEngine(base_dir),
    "face_cut":   FaceEngine(base_dir),
    "ai_bypass":  AIBypassEngine(base_dir),
    "revolut":    RevolutEngine(base_dir),
    "mrz_gen":    MrzGenEngine(base_dir),
    "ita_cf":     ItaCfEngine(base_dir),
    "deu_tax":    DeuTaxEngine(base_dir),
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
    file: Optional[UploadFile] = File(None),
    custom_tx: str = Form("false"),
    custom_merchant: str = Form(""),
    custom_to: str = Form(""),
    custom_card: str = Form(""),
    custom_amount: str = Form(""),
    custom_date: str = Form(""),
):
    if type not in registry: raise HTTPException(404, "UNKNOWN_TYPE")

    try:
        p_lines = json.loads(lines)
        is_scan = scan_mode.lower() == "true"
        image_bytes = await file.read() if file else None

        engine = registry[type]
        if type == "revolut":
            res = engine.render(p_lines, is_scan, image_bytes,
                                custom_tx=custom_tx.lower() == "true",
                                custom_merchant=custom_merchant,
                                custom_to=custom_to,
                                custom_card=custom_card,
                                custom_amount=custom_amount,
                                custom_date=custom_date)
        elif asyncio.iscoroutinefunction(engine.render):
            res = await engine.render(p_lines, is_scan, image_bytes)
        else:
            res = engine.render(p_lines, is_scan, image_bytes)
        
        if isinstance(res, dict): return JSONResponse(res)
        
        m_type = "image/jpeg" if type in ["exif_cleaner", "face_cut"] else "application/pdf"
        return StreamingResponse(res, media_type=m_type)
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"CORE_ERR: {tb}")
        return JSONResponse({"ERR": str(e), "TB": tb}, status_code=200)