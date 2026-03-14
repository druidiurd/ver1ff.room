import fitz
import json
import random
import io
import os
from datetime import datetime, timedelta
from typing import List, Final, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse

app = FastAPI()

class UniversalDocEngine:
    """Core Engine v57. Memory-Efficient. [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('base_path',)

    def __init__(self) -> None:
        self.base_path: Final[str] = os.path.dirname(__file__)

    def _get_path(self, filename: str) -> str:
        return os.path.join(self.base_path, filename)

    async def generate(self, doc_type: str, raw_addr: List[str]) -> io.BytesIO:
        try:
            # Мапінг шаблонів. Додавай сюди нові інструменти. [cite: 2026-02-05]
            configs = {
                "energia": {"pdf": "template.pdf", "json": "coords.json"}
            }
            
            target = configs.get(doc_type)
            if not target: raise ValueError(f"Unknown tool: {doc_type}")

            with open(self._get_path(target["json"]), "r") as f:
                cfg = json.load(f)

            f_reg = self._get_path("arial.ttf")
            f_bold = self._get_path("arialbd.ttf")

            with fitz.open(self._get_path(target["pdf"])) as doc:
                page = doc[0]
                page.clean_contents()

                # 1. Стираємо старі дані [cite: 2026-02-21]
                for name, data in cfg.items():
                    if name not in ["Page_1_Shield", "Finance_Values_Zone"]:
                        page.add_redact_annot(fitz.Rect(data["rect"]), fill=(1, 1, 1))
                page.apply_redactions()

                # 2. Рендеринг адреси
                b_a = cfg["Address_Block"]
                for i, text in enumerate(raw_addr):
                    page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                                   text, fontname="Arial", fontfile=f_reg, fontsize=b_a["font_size"])

                # 3. Рендеринг фінансів (Right Alignment) [cite: 2026-02-05]
                # Тут твоя логіка розрахунку tw та x_pos...

                out = io.BytesIO()
                doc.save(out, garbage=4, deflate=True)
                out.seek(0)
                return out
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

engine = UniversalDocEngine()

@app.post("/api/generate")
async def handle_request(payload: Dict[str, Any] = Body(...)):
    doc_type = payload.get("type", "energia")
    lines = payload.get("lines", [" "] * 6)
    pdf_stream = await engine.generate(doc_type, lines)
    return StreamingResponse(pdf_stream, media_type="application/pdf")