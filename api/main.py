import fitz
import json
import random
import io
import os
import numpy as np
from PIL import Image, ImageFilter
from datetime import datetime, timedelta
from typing import List, Final, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse, JSONResponse

app = FastAPI()

class IrishNDLSDualCore:
    """Staff-level Dual Engine для MRZ. [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('_weights', '_doc_type', '_pad', '_legacy_offsets')

    def __init__(self) -> None:
        self._weights: Final = np.array([7, 3, 1], dtype=np.int32)
        self._doc_type: Final = "D<"
        self._pad: Final = "<"
        self._legacy_offsets: Final = {"55": 8, "29": 2, "04": 0, "26": 0, "17": 0, "28": 0}

    def _fast_checksum(self, payload: str) -> int:
        arr = np.frombuffer(payload.encode('ascii'), dtype=np.uint8)
        vals = np.zeros_like(arr, dtype=np.int32)
        is_num = (arr >= 48) & (arr <= 57)
        is_alpha = (arr >= 65) & (arr <= 90)
        vals[is_num] = arr[is_num] - 48
        vals[is_alpha] = arr[is_alpha] - 55
        weights = np.tile(self._weights, (len(arr) + 2) // 3)[:len(arr)]
        return int(np.dot(vals, weights) % 10)

    async def build(self, data: List[str]) -> Dict[str, str]:
        # Мапінг: 0:Surname, 1:Nationality, 2:Licence9, 3:Issue2, 4:DriverID_Prefix
        try:
            surname, nat, lic_9, issue_num, drv_id = data[0], data[1], data[2], data[3], data[4]
            n_block = nat.upper().replace(" ", self._pad)[:3].ljust(3, self._pad)
            i_block = issue_num.zfill(2)[:2]
            l_block = lic_9.upper()[:9]
            
            # GEN 2 (30 BYTES)
            s_30 = surname.upper().replace(" ", self._pad)[:12].ljust(12, self._pad)
            mrz_30_base = f"{self._doc_type}{s_30}{n_block}{self._pad}{l_block}{i_block}"
            cs_30 = self._fast_checksum(mrz_30_base) % 10
            
            # GEN 1 (31 BYTES)
            s_31 = surname.upper().replace(" ", self._pad)[:13].ljust(13, self._pad)
            mrz_31_base = f"{self._doc_type}{s_31}{n_block}{self._pad}{l_block}{i_block}"
            offset = self._legacy_offsets.get(drv_id[:2], 0)
            cs_31 = (self._fast_checksum(mrz_31_base) + offset) % 10

            return {
                "GEN_2_ISO": f"{mrz_30_base}{cs_30}",
                "GEN_1_LEGACY": f"{mrz_31_base}{cs_31}"
            }
        except Exception as e:
            raise ValueError(f"MRZ_VEC_ERR: {e}")

class SeniorProductionV57:
    """PDF Engine v57.3. [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('base_path', 'f_reg', 'f_bold')

    def __init__(self) -> None:
        self.base_path = os.path.dirname(os.path.abspath(__file__))
        self.f_reg = self._get_path("arial.ttf")
        self.f_bold = self._get_path("arialbd.ttf")

    def _get_path(self, filename: str) -> str:
        p = os.path.join(self.base_path, filename)
        if not os.path.exists(p): raise FileNotFoundError(f"Asset missing: {filename}")
        return p

    def _fmt(self, val: float) -> str: return f"\u20ac{val:,.2f}"

    def _apply_scan(self, pdf_bytes: io.BytesIO) -> io.BytesIO:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.open(io.BytesIO(pix.tobytes()))
        img = img.rotate(random.uniform(-0.4, 0.4), resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        arr = np.array(img)
        noise = np.random.normal(0, 2.5, arr.shape).astype('int16')
        arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
        img = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(radius=0.32))
        out = io.BytesIO()
        img.save(out, format="PDF", resolution=300.0, quality=82, optimize=True)
        out.seek(0)
        return out

    async def generate_pdf(self, raw_addr: List[str], scan_mode: bool) -> io.BytesIO:
        with open(self._get_path("coords.json"), "r") as f: cfg = json.load(f)
        now = datetime.now()
        p_bal, trans = round(random.uniform(70, 135), 2), round(random.uniform(85, 225), 2)
        addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(raw_addr)]
        
        with fitz.open(self._get_path("Utilydy_bill_Energia-1.pdf")) as doc:
            page = doc[0]
            page.clean_contents()
            for n, d in cfg.items():
                if n not in ["Page_1_Shield", "Finance_Values_Zone"]:
                    page.add_redact_annot(fitz.Rect(d["rect"]), fill=(1, 1, 1))
            page.apply_redactions()
            
            # Рендеринг (спрощено для моноліту)
            b_a = cfg["Address_Block"]
            for i, t in enumerate(addr):
                page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), t, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])
            
            # Right Alignment Logic [cite: 2026-02-05]
            fin_vals = [self._fmt(p_bal), self._fmt(p_bal), "\u20ac0.00", self._fmt(trans), self._fmt(trans)]
            for i, k in enumerate(["Fin_Val_1_PrevBal", "Fin_Val_2_Payment", "Fin_Val_3_AccBalBefore", "Fin_Val_4_Trans", "Fin_Val_5_NewBal"]):
                z, val = cfg[k], fin_vals[i]
                f_p = self.f_bold if i > 1 else self.f_reg
                tw = fitz.Font(fontfile=f_p).text_length(val, fontsize=z["font_size"])
                page.insert_text((z["rect"][2] - tw, z["rect"][1] + 10), val, fontname="Arial-Bold" if i > 1 else "Arial", fontfile=f_p, fontsize=z["font_size"])

            doc.set_metadata({"producer": "macOS 15.3.1 Quartz PDFContext", "creator": "Pages"})
            tmp = io.BytesIO()
            doc.save(tmp, garbage=4, deflate=True)
            tmp.seek(0)
            return self._apply_scan(tmp) if scan_mode else tmp

pdf_engine = SeniorProductionV57()
mrz_engine = IrishNDLSDualCore()

@app.post("/api/process")
async def handle_request(payload: Dict[str, Any] = Body(...)):
    try:
        m_type = payload.get("type", "energia")
        lines = payload.get("lines", [])
        
        if m_type == "ndls_mrz":
            res = await mrz_engine.build(lines)
            return JSONResponse(content=res)
        
        pdf = await pdf_engine.generate_pdf(lines, payload.get("scan_mode", False))
        return StreamingResponse(pdf, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))