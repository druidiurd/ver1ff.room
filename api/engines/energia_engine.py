import fitz
import json
import random
import io
import os
import numpy as np
from PIL import Image, ImageFilter
from datetime import datetime, timedelta
from typing import List

class EnergiaEngine:
    """Enterprise Engine v57.0 (Right-Aligned) [cite: 2026-02-05, 2026-02-21]."""
    def __init__(self, base_path: str):
        self.base_path = base_path
        self.f_reg = os.path.join(base_path, "arial.ttf")
        self.f_bold = os.path.join(base_path, "arialbd.ttf")

    def get_schema(self):
        return [
            {"id": "n", "label": "IDENTITY_NAME", "p": "Mr Peter Browne"},
            {"id": "s", "label": "STREET_LOCUS", "p": "114 STANNAWAY RD"},
            {"id": "d1", "label": "DISTRICT_ZONE", "p": "KIMMAGE"},
            {"id": "d2", "label": "CITY_DISTRICT", "p": "DUBLIN 12"},
            {"id": "c", "label": "COUNTY_REGION", "p": "Co. Dublin 12"},
            {"id": "z", "label": "ZIP_POSTCODE", "p": "D12 N4V9"}
        ]

    def render(self, lines: List[str], scan: bool, image_bytes: bytes = None) -> io.BytesIO:
        # Fix: додано image_bytes=None [cite: 2026-03-16]
        with open(os.path.join(self.base_path, "coords.json"), "r") as f: cfg = json.load(f)
        now = datetime.now()
        p_bal, trans = round(random.uniform(70, 135), 2), round(random.uniform(85, 225), 2)
        addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(lines)]
        
        with fitz.open(os.path.join(self.base_path, "Utilydy_bill_Energia-1.pdf")) as doc:
            page = doc[0]
            page.clean_contents()
            for n, d in cfg.items():
                if n not in ["Page_1_Shield", "Finance_Values_Zone"]:
                    page.add_redact_annot(fitz.Rect(d["rect"]), fill=(1, 1, 1))
            page.apply_redactions()
            
            b_a = cfg["Address_Block"]
            for i, t in enumerate(addr):
                page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), t, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])
            
            fin_map = {
                "Fin_Val_1_PrevBal": f"\u20ac{p_bal:,.2f}", "Fin_Val_2_Payment": f"\u20ac{p_bal:,.2f}",
                "Fin_Val_3_AccBalBefore": "\u20ac0.00", "Fin_Val_4_Trans": f"\u20ac{trans:,.2f}", "Fin_Val_5_NewBal": f"\u20ac{trans:,.2f}"
            }
            for key, val in fin_map.items():
                if key in cfg:
                    z, fp = cfg[key], (self.f_bold if "3" in key or "4" in key or "5" in key else self.f_reg)
                    tw = fitz.Font(fontfile=fp).text_length(val, fontsize=z["font_size"])
                    page.insert_text((z["rect"][2] - tw, z["rect"][1] + 10), val, fontfile=fp, fontsize=z["font_size"])

            if "Premises_Block" in cfg:
                page.insert_text((cfg["Premises_Block"]["rect"][0], cfg["Premises_Block"]["rect"][1] + 10), f"{addr[1]}, {addr[2]}, {addr[5]}", fontname="Arial", fontfile=self.f_reg, fontsize=cfg["Premises_Block"]["font_size"])

            doc.set_metadata({"producer": "macOS 15.3.1 Quartz PDFContext", "creator": "Pages"})
            tmp = io.BytesIO(); doc.save(tmp, garbage=4, deflate=True); tmp.seek(0)
            return self.apply_artifacts(tmp) if scan else tmp

    def apply_artifacts(self, b: io.BytesIO) -> io.BytesIO:
        doc = fitz.open(stream=b, filetype="pdf"); pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.open(io.BytesIO(pix.tobytes())).rotate(random.uniform(-0.4, 0.4), expand=True, fillcolor=(255,255,255))
        arr = np.array(img); noise = np.random.normal(0, 2.5, arr.shape).astype('int16')
        img = Image.fromarray(np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.32))
        out = io.BytesIO(); img.save(out, format="PDF", resolution=300.0, quality=82); out.seek(0); return out