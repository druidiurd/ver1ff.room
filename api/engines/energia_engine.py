import fitz
import json
import random
import io
import os
import numpy as np
from PIL import Image, ImageFilter
from datetime import datetime, timedelta
from typing import List, Dict, Final

class EnergiaEngine:
    """Enterprise Engine v57.3. PDF Rendering Core [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('base_path', 'f_reg', 'f_bold')

    def __init__(self, base_path: str):
        self.base_path = base_path
        self.f_reg = self._get_p("arial.ttf")
        self.f_bold = self._get_p("arialbd.ttf")

    def _get_p(self, f: str):
        p = os.path.join(self.base_path, f)
        if not os.path.exists(p): raise FileNotFoundError(f"Missing asset: {f}")
        return p

    def get_schema(self):
        return [
            {"id": "name", "label": "IDENTITY_NAME", "p": "Mr Peter Browne"},
            {"id": "street", "label": "STREET_LOCUS", "p": "114 STANNAWAY RD"},
            {"id": "dist1", "label": "DISTRICT_ZONE", "p": "KIMMAGE"},
            {"id": "dist2", "label": "CITY_DISTRICT", "p": "DUBLIN 12"},
            {"id": "county", "label": "COUNTY_REGION", "p": "Co. Dublin 12"},
            {"id": "zip", "label": "ZIP_POSTCODE", "p": "D12 N4V9"}
        ]

    def render(self, lines: List[str], scan: bool) -> io.BytesIO:
        with open(self._get_p("coords.json"), "r") as f: 
            cfg = json.load(f)
        
        now = datetime.now()
        p_bal, trans = round(random.uniform(70, 135), 2), round(random.uniform(85, 225), 2)
        # Upper Case для специфічних рядків за твоїм шаблоном [cite: 2026-02-05]
        addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(lines)]
        
        with fitz.open(self._get_p("Utilydy_bill_Energia-1.pdf")) as doc:
            page = doc[0]
            page.clean_contents()
            for n, d in cfg.items():
                if n not in ["Page_1_Shield", "Finance_Values_Zone"]:
                    page.add_redact_annot(fitz.Rect(d["rect"]), fill=(1, 1, 1))
            page.apply_redactions()
            
            # Рендеринг Адреси
            b_a = cfg["Address_Block"]
            for i, t in enumerate(addr):
                page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                               t, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])
            
            # Premises Block restoration [cite: 2026-02-05]
            if "Premises_Block" in cfg:
                page.insert_text((cfg["Premises_Block"]["rect"][0], cfg["Premises_Block"]["rect"][1] + 10), 
                               f"{addr[1]}, {addr[2]}, {addr[5]}", fontname="Arial", fontfile=self.f_reg, 
                               fontsize=cfg["Premises_Block"]["font_size"])

            # Finance Right-Alignment Logic [cite: 2026-02-05]
            fin_vals = [f"\u20ac{p_bal:,.2f}", f"\u20ac{p_bal:,.2f}", "\u20ac0.00", f"\u20ac{trans:,.2f}", f"\u20ac{trans:,.2f}"]
            for i, k in enumerate(["Fin_Val_1_PrevBal", "Fin_Val_2_Payment", "Fin_Val_3_AccBalBefore", "Fin_Val_4_Trans", "Fin_Val_5_NewBal"]):
                z, fp = cfg[k], (self.f_bold if i > 1 else self.f_reg)
                tw = fitz.Font(fontfile=fp).text_length(fin_vals[i], fontsize=z["font_size"])
                page.insert_text((z["rect"][2] - tw, z["rect"][1] + 10), fin_vals[i], 
                               fontname="Arial-Bold" if i > 1 else "Arial", fontfile=fp, fontsize=z["font_size"])

            doc.set_metadata({"producer": "macOS 15.3.1 Quartz PDFContext", "creator": "Pages"})
            tmp = io.BytesIO()
            doc.save(tmp, garbage=4, deflate=True)
            tmp.seek(0)
            return self.apply_artifacts(tmp) if scan else tmp

    def apply_artifacts(self, pdf_bytes: io.BytesIO) -> io.BytesIO:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.open(io.BytesIO(pix.tobytes()))
        img = img.rotate(random.uniform(-0.4, 0.4), resample=Image.BICUBIC, expand=True, fillcolor=(255, 255, 255))
        arr = np.array(img)
        noise = np.random.normal(0, 2.8, arr.shape).astype('int16')
        arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
        img = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(radius=0.35))
        out = io.BytesIO()
        img.save(out, format="PDF", resolution=300.0, quality=82)
        out.seek(0)
        return out