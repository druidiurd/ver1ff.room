import os
import sys
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Dict, Any

# Senior Hack: додаємо шлях до папки api в систему, щоб імпорти не відвалилися [cite: 2026-02-05]
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Тепер імпорти спрацюють залізобетонно [cite: 2026-02-21]
from engines.energia_engine import EnergiaEngine
from engines.mrz_engine import MrzEngine

app = FastAPI()

# Реєстрація двигунів
registry = {
    "energia": EnergiaEngine(current_dir),
    "ndls_mrz": MrzEngine(current_dir)
}

@app.get("/api/schema/{module}")
async def get_schema(module: str):
    if module not in registry: 
        raise HTTPException(status_code=404, detail="Module not found")
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(payload: Dict[str, Any] = Body(...)):
    try:
        mod_id = payload.get("type", "energia")
        if mod_id not in registry: 
            raise HTTPException(status_code=404, detail="Unknown module")
        
        engine = registry[mod_id]
        lines = payload.get("lines", [])
        scan_m = payload.get("scan_mode", False)
        
        result = engine.render(lines, scan_m)
        
        if isinstance(result, dict):
            return JSONResponse(result)
        return StreamingResponse(result, media_type="application/pdf")
    except Exception as e:
        print(f"CRITICAL_EXECUTION_FAILURE: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))