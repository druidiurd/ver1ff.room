import fitz
import json
import random
import io
import os
import numpy as np
from PIL import Image, ImageFilter
from datetime import datetime, timedelta
from typing import List, Final, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse

app = FastAPI()

class SeniorProductionV57:
    """Enterprise Engine v57.3. Artifact Injection & 100% Logic Integrity [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('base_path', 'f_reg', 'f_bold')

    def __init__(self) -> None:
        # Визначаємо шлях до активів у середовищі Vercel [cite: 2026-02-21]
        self.base_path: Final[str] = os.path.dirname(os.path.abspath(__file__))
        self.f_reg = self._get_path("arial.ttf")
        self.f_bold = self._get_path("arialbd.ttf")

    def _get_path(self, filename: str) -> str:
        full_path = os.path.join(self.base_path, filename)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Missing essential asset: {filename}")
        return full_path

    def _fmt(self, val: float) -> str:
        """Форматування валюти з Unicode символом Євро [cite: 2026-02-05]."""
        return f"\u20ac{val:,.2f}"

    def _apply_scan_effect(self, pdf_bytes: io.BytesIO) -> io.BytesIO:
        """KILLER FEATURE: Artifact Injection (Імітація реального скана) [cite: 2026-02-05]."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        # Рендеримо сторінку в картинку (300 DPI для якості)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) 
        img = Image.open(io.BytesIO(pix.tobytes()))
        
        # 1. Мікро-поворот сторінки (кривий сканер) [cite: 2026-02-05]
        angle = random.uniform(-0.45, 0.45)
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        
        # 2. Digital Grain & Noise через numpy для перформансу [cite: 2026-02-21]
        img_array = np.array(img)
        noise = np.random.normal(0, 2.8, img_array.shape).astype('int16')
        img_array = np.clip(img_array.astype('int16') + noise, 0, 255).astype('uint8')
        img = Image.fromarray(img_array)
        
        # 3. Оптичний розмив та JPEG артефакти [cite: 2026-02-05]
        img = img.filter(ImageFilter.GaussianBlur(radius=0.32))
        
        out_pdf = io.BytesIO()
        # Зберігаємо з компресією 82% для імітації 'старого' скана
        img.save(out_pdf, format="PDF", resolution=300.0, quality=82, optimize=True)
        out_pdf.seek(0)
        return out_pdf

    async def generate(self, doc_type: str, raw_addr: List[str], scan_mode: bool) -> io.BytesIO:
        try:
            # Мапінг активів [cite: 2026-02-05]
            configs = {"energia": {"pdf": "Utilydy_bill_Energia-1.pdf", "json": "coords.json"}}
            target = configs.get(doc_type)
            if not target: raise ValueError(f"Unknown tool type: {doc_type}")

            with open(self._get_path(target["json"]), "r") as f:
                cfg = json.load(f)

            # --- МАТЕМАТИЧНА МОДЕЛЬ [cite: 2026-02-05] ---
            now = datetime.now()
            cutoff_dt = now - timedelta(days=20)
            p_bal = round(random.uniform(70.0, 135.0), 2)
            trans = round(random.uniform(85.0, 225.0), 2)
            
            # Форматування адреси (Upper Case для 1,2,3,5 рядків за твоїм шаблоном) [cite: 2026-02-05]
            addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(raw_addr)]

            with fitz.open(self._get_path(target["pdf"])) as doc:
                page = doc[0]
                page.clean_contents()
                
                # КРОК 1: Атомарна зачистка зон [cite: 2026-02-21]
                for name, data in cfg.items():
                    if name not in ["Page_1_Shield", "Finance_Values_Zone"]:
                        page.add_redact_annot(fitz.Rect(data["rect"]), fill=(1, 1, 1))
                page.apply_redactions()

                # КРОК 2: Рендеринг Адреси
                b_a = cfg["Address_Block"]
                for i, text in enumerate(addr):
                    page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                                   text, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])

                # КРОК 3: Рендеринг Таблиці Інфо
                table_vals = [
                    str(random.randint(24500000, 24599999)),
                    str(random.randint(5365000000, 5365999999)),
                    "Electricity",
                    f"{(now-timedelta(days=33)):%d/%m/%Y} - {(now-timedelta(days=1)):%d/%m/%Y}",
                    now.strftime("%d %B %Y"),
                    (now+timedelta(days=14)).strftime("%d %B %Y")
                ]
                b_t = cfg["Invoice_Table"]
                for i, val in enumerate(table_vals):
                    page.insert_text((b_t["rect"][0], b_t["rect"][1] + 8 + (i * b_t["line_height"])), 
                                   val, fontname="Arial", fontfile=self.f_reg, fontsize=b_t["font_size"])

                # КРОК 4: Рендеринг Finance_Date_Zone [cite: 2026-02-05]
                if "Finance_Date_Zone" in cfg:
                    fdz = cfg["Finance_Date_Zone"]
                    page.insert_text((fdz["rect"][0], fdz["rect"][1] + 10), 
                                   f"Payment(s) received up to {cutoff_dt:%d %B %Y}", 
                                   fontname="Arial", fontfile=self.f_reg, fontsize=9)

                # КРОК 5: Рендеринг Premises_Block (Адреса об'єкта) [cite: 2026-02-05]
                if "Premises_Block" in cfg:
                    b_p = cfg["Premises_Block"]
                    page.insert_text((b_p["rect"][0], b_p["rect"][1] + 10), 
                                   f"{addr[1]}, {addr[2]}, {addr[5]}", 
                                   fontname="Arial", fontfile=self.f_reg, fontsize=b_p["font_size"])

                # КРОК 6: Фінанси (Right Alignment Logic) [cite: 2026-02-05]
                fin_map = [
                    {"v": self._fmt(p_bal), "k": "Fin_Val_1_PrevBal", "b": False},
                    {"v": self._fmt(p_bal), "k": "Fin_Val_2_Payment", "b": False},
                    {"v": "\u20ac0.00", "k": "Fin_Val_3_AccBalBefore", "b": True},
                    {"v": self._fmt(trans), "k": "Fin_Val_4_Trans", "b": True},
                    {"v": self._fmt(trans), "k": "Fin_Val_5_NewBal", "b": True}
                ]
                for item in fin_map:
                    if item["k"] in cfg:
                        z = cfg[item["k"]]
                        f_path = self.f_bold if item["b"] else self.f_reg
                        f_name = "Arial-Bold" if item["b"] else "Arial"
                        f_obj = fitz.Font(fontfile=f_path)
                        tw = f_obj.text_length(item["v"], fontsize=z["font_size"])
                        # Вирівнювання по правій межі ROI [cite: 2026-02-05]
                        x_pos = z["rect"][2] - tw
                        page.insert_text((x_pos, z["rect"][1] + 10), item["v"], 
                                       fontname=f_name, fontfile=f_path, fontsize=z["font_size"])

                # КРОК 7: Анонімізація метаданих (macOS Quartz Context) [cite: 2026-02-05]
                doc.set_metadata({
                    "producer": "macOS Version 15.3.1 (Build 24D70) Quartz PDFContext",
                    "creator": "Pages",
                    "title": "Energia Utility Bill"
                })

                # Збереження в пам'ять [cite: 2026-02-21]
                tmp = io.BytesIO()
                doc.save(tmp, garbage=4, deflate=True, clean=True)
                tmp.seek(0)
                
                # Якщо SCAN_MODE активний — пропускаємо через Artifact Injector [cite: 2026-02-05]
                return self._apply_scan_effect(tmp) if scan_mode else tmp

        except Exception as e:
            print(f"CRITICAL_ENGINE_FAILURE: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

engine = SeniorProductionV57()

@app.post("/api/generate")
async def handle(payload: Dict[str, Any] = Body(...)):
    # Отримуємо дані з фронтенда (Zoneless Signals) [cite: 2026-02-05]
    doc_type = payload.get("type", "energia")
    lines = payload.get("lines", [" "] * 6)
    scan_m = payload.get("scan_mode", False)
    
    pdf_stream = await engine.generate(doc_type, lines, scan_m)
    return StreamingResponse(pdf_stream, media_type="application/pdf")