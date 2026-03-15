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

class SeniorProductionV57:
    """Enterprise Engine v57.1. 100% logic restoration. [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('base_path', 'f_reg', 'f_bold')

    def __init__(self) -> None:
        self.base_path: Final[str] = os.path.dirname(os.path.abspath(__file__))
        self.f_reg = self._get_path("arial.ttf")
        self.f_bold = self._get_path("arialbd.ttf")

    def _get_path(self, filename: str) -> str:
        full_path = os.path.join(self.base_path, filename)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Missing asset: {filename}")
        return full_path

    def _fmt(self, val: float) -> str:
        return f"\u20ac{val:,.2f}"

    async def generate(self, doc_type: str, raw_addr: List[str]) -> io.BytesIO:
        try:
            configs = {"energia": {"pdf": "Utilydy_bill_Energia-1.pdf", "json": "coords.json"}}
            target = configs.get(doc_type)
            if not target: raise ValueError(f"Unknown type: {doc_type}")

            with open(self._get_path(target["json"]), "r") as f:
                cfg = json.load(f)

            # --- МАТЕМАТИКА ТА ДАТИ [cite: 2026-02-05] ---
            p_bal = round(random.uniform(70.0, 135.0), 2)
            trans = round(random.uniform(85.0, 225.0), 2)
            now = datetime.now()
            cutoff_dt = now - timedelta(days=20)
            
            fin_map = {
                "Fin_Val_1_PrevBal": {"v": self._fmt(p_bal), "f": self.f_reg, "n": "Arial"},
                "Fin_Val_2_Payment": {"v": self._fmt(p_bal), "f": self.f_reg, "n": "Arial"},
                "Fin_Val_3_AccBalBefore": {"v": "\u20ac0.00", "f": self.f_bold, "n": "Arial-Bold"},
                "Fin_Val_4_Trans": {"v": self._fmt(trans), "f": self.f_bold, "n": "Arial-Bold"},
                "Fin_Val_5_NewBal": {"v": self._fmt(trans), "f": self.f_bold, "n": "Arial-Bold"}
            }

            table_map = [
                str(random.randint(24500000, 24599999)),
                str(random.randint(5365000000, 5365999999)),
                "Electricity",
                f"{(now-timedelta(days=33)):%d/%m/%Y} - {(now-timedelta(days=1)):%d/%m/%Y}",
                now.strftime("%d %B %Y"),
                (now+timedelta(days=14)).strftime("%d %B %Y")
            ]

            # Форматування адреси (Upper case для специфічних рядків) [cite: 2026-02-21]
            addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(raw_addr)]

            with fitz.open(self._get_path(target["pdf"])) as doc:
                page = doc[0]
                page.clean_contents()

                # --- ЗАЧИСТКА ---
                for name, data in cfg.items():
                    if name not in ["Page_1_Shield", "Finance_Values_Zone"]:
                        page.add_redact_annot(fitz.Rect(data["rect"]), fill=(1, 1, 1))
                page.apply_redactions()

                # --- РЕНДЕРИНГ АДРЕСИ ---
                b_a = cfg["Address_Block"]
                for i, text in enumerate(addr):
                    page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                                   text, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])

                # --- РЕНДЕРИНГ ТАБЛИЦІ ІНФО ---
                b_t = cfg["Invoice_Table"]
                for i, val in enumerate(table_map):
                    page.insert_text((b_t["rect"][0], b_t["rect"][1] + 8 + (i * b_t["line_height"])), 
                                   val, fontname="Arial", fontfile=self.f_reg, fontsize=b_t["font_size"])

                # --- [FIX] ДАТА ПЛАТЕЖУ ---
                if "Finance_Date_Zone" in cfg:
                    fdz = cfg["Finance_Date_Zone"]
                    page.insert_text((fdz["rect"][0], fdz["rect"][1] + 10), 
                                   f"Payment(s) received up to {cutoff_dt:%d %B %Y}", 
                                   fontname="Arial", fontfile=self.f_reg, fontsize=9)

                # --- [FIX] БЛОК PREMISES SUPPLIED ---
                if "Premises_Block" in cfg:
                    b_p = cfg["Premises_Block"]
                    # Використовуємо твою комбінацію рядків адреси [cite: 2026-02-05]
                    page.insert_text((b_p["rect"][0], b_p["rect"][1] + 10), 
                                   f"{addr[1]}, {addr[2]}, {addr[5]}", 
                                   fontname="Arial", fontfile=self.f_reg, fontsize=b_p["font_size"])

                # --- ФІНАНСИ (RIGHT ALIGNMENT) ---
                for key, item in fin_map.items():
                    if key in cfg:
                        z = cfg[key]
                        f_obj = fitz.Font(fontfile=item["f"])
                        tw = f_obj.text_length(item["v"], fontsize=z["font_size"])
                        x_pos = z["rect"][2] - tw
                        page.insert_text((x_pos, z["rect"][1] + 10), item["v"], 
                                       fontname=item["n"], fontfile=item["f"], fontsize=z["font_size"])

                # --- АНОНІМІЗАЦІЯ МЕТАДАНИХ ---
                doc.set_metadata({
                    "producer": "macOS Version 15.3.1 (Build 24D70) Quartz PDFContext",
                    "creator": "Pages",
                    "title": "Energia Utility Bill"
                })

                output = io.BytesIO()
                doc.save(output, garbage=4, deflate=True, clean=True)
                output.seek(0)
                return output
        except Exception as e:
            print(f"CRITICAL_FAILURE: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

engine = SeniorProductionV57()

@app.post("/api/generate")
async def handle(payload: Dict[str, Any] = Body(...)):
    doc_type = payload.get("type", "energia")
    lines = payload.get("lines", [" "] * 6)
    pdf = await engine.generate(doc_type, lines)
    return StreamingResponse(pdf, media_type="application/pdf")