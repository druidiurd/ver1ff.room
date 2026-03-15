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
from fastapi.responses import StreamingResponse, JSONResponse

app = FastAPI()

class BaseEngine:
    """Core logic для всіх модулів [cite: 2026-02-21]."""
    def __init__(self, base_path: str):
        self.base_path = base_path
    def get_p(self, f: str): return os.path.join(self.base_path, f)

class EnergiaEngine(BaseEngine):
    """Модуль Ірландської енергії [cite: 2026-02-05]."""
    def get_schema(self):
        return [
            {"id": "name", "label": "IDENTITY_NAME", "p": "Mr Peter Browne"},
            {"id": "street", "label": "STREET_LOCUS", "p": "114 STANNAWAY RD"},
            {"id": "dist1", "label": "DISTRICT_ZONE", "p": "KIMMAGE"},
            {"id": "dist2", "label": "CITY_DISTRICT", "p": "DUBLIN 12"},
            {"id": "county", "label": "COUNTY_REGION", "p": "Co. Dublin 12"},
            {"id": "zip", "label": "ZIP_POSTCODE", "p": "D12 N4V9"}
        ]

    def process(self, lines: List[str], scan: bool) -> io.BytesIO:
        f_reg, f_bold = self.get_p("arial.ttf"), self.get_p("arialbd.ttf")
        with open(self.get_p("coords.json"), "r") as f: cfg = json.load(f)
        now = datetime.now()
        p_bal, trans = round(random.uniform(70, 135), 2), round(random.uniform(85, 225), 2)
        addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(lines)]
        
        with fitz.open(self.get_p("Utilydy_bill_Energia-1.pdf")) as doc:
            page = doc[0]
            page.clean_contents()
            for n, d in cfg.items():
                if n not in ["Page_1_Shield", "Finance_Values_Zone"]:
                    page.add_redact_annot(fitz.Rect(d["rect"]), fill=(1, 1, 1))
            page.apply_redactions()
            
            # Address Block
            b_a = cfg["Address_Block"]
            for i, t in enumerate(addr):
                page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), t, fontname="Arial", fontfile=f_reg, fontsize=b_a["font_size"])
            
            # Right-Align Finance [cite: 2026-02-05]
            fin_vals = [f"\u20ac{p_bal:,.2f}", f"\u20ac{p_bal:,.2f}", "\u20ac0.00", f"\u20ac{trans:,.2f}", f"\u20ac{trans:,.2f}"]
            for i, k in enumerate(["Fin_Val_1_PrevBal", "Fin_Val_2_Payment", "Fin_Val_3_AccBalBefore", "Fin_Val_4_Trans", "Fin_Val_5_NewBal"]):
                z = cfg[k]
                fp = f_bold if i > 1 else f_reg
                tw = fitz.Font(fontfile=fp).text_length(fin_vals[i], fontsize=z["font_size"])
                page.insert_text((z["rect"][2] - tw, z["rect"][1] + 10), fin_vals[i], fontname="Arial-Bold" if i > 1 else "Arial", fontfile=fp, fontsize=z["font_size"])

            # Метадані та збереження
            doc.set_metadata({"producer": "macOS 15.3.1 Quartz PDFContext", "creator": "Pages"})
            tmp = io.BytesIO()
            doc.save(tmp, garbage=4, deflate=True)
            tmp.seek(0)
            return self.apply_artifacts(tmp) if scan else tmp

    def apply_artifacts(self, pdf_bytes: io.BytesIO) -> io.BytesIO:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.open(io.BytesIO(pix.tobytes()))
        # Artifact Injection: Rotation, Noise, Blur [cite: 2026-02-05]
        img = img.rotate(random.uniform(-0.4, 0.4), resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        arr = np.array(img)
        noise = np.random.normal(0, 2.8, arr.shape).astype('int16')
        arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
        img = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(radius=0.35))
        out = io.BytesIO()
        img.save(out, format="PDF", resolution=300.0, quality=82)
        out.seek(0)
        return out

class MrzEngine(BaseEngine):
    """Модуль MRZ обчислень на Numpy [cite: 2026-02-05, 2026-02-21]."""
    def get_schema(self):
        return [
            {"id": "s", "label": "SURNAME_VEC", "p": "BROWNE"},
            {"id": "n", "label": "NAT_ISO_3", "p": "IRL"},
            {"id": "l", "label": "LIC_CORE_9", "p": "123456789"},
            {"id": "i", "label": "ISSUE_SEQ_2", "p": "01"},
            {"id": "d", "label": "DRIVER_ID", "p": "55123456"}
        ]

    def process(self, data: List[str], scan: bool):
        # Векторний чексум [cite: 2026-02-05]
        w = np.array([7, 3, 1], dtype=np.int32)
        def cs(p):
            a = np.frombuffer(p.encode('ascii'), dtype=np.uint8)
            v = np.zeros_like(a, dtype=np.int32)
            num, alp = (a >= 48) & (a <= 57), (a >= 65) & (a <= 90)
            v[num], v[alp] = a[num] - 48, a[alp] - 55
            weights = np.tile(w, (len(a) + 2) // 3)[:len(a)]
            return int(np.dot(v, weights) % 10)

        s_30 = data[0].upper().replace(" ", "<")[:12].ljust(12, "<")
        mrz = f"D<{s_30}{data[1].upper()[:3]}<{data[2].upper()[:9]}{data[3].zfill(2)[:2]}"
        return {"GEN_2_ISO": f"{mrz}{cs(mrz)}", "STATUS": "DECODED_SUCCESS"}

# Registry
bp = os.path.dirname(os.path.abspath(__file__))
registry = {"energia": EnergiaEngine(bp), "ndls_mrz": MrzEngine(bp)}

@app.get("/api/schema/{module}")
async def schema(module: str):
    if module not in registry: raise HTTPException(404)
    return JSONResponse(registry[module].get_schema())

@app.post("/api/execute")
async def execute(payload: Dict[str, Any] = Body(...)):
    mod = payload.get("type")
    if mod not in registry: raise HTTPException(404)
    res = registry[mod].process(payload.get("lines", []), payload.get("scan_mode", False))
    if isinstance(res, dict): return JSONResponse(res)
    return StreamingResponse(res, media_type="application/pdf")