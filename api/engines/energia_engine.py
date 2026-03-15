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
            {"id": "name", "label": "ПОВНЕ_ІМ'Я", "p": "Mr Peter Browne"},
            {"id": "street", "label": "ВУЛИЦЯ", "p": "114 STANNAWAY RD"},
            {"id": "dist1", "label": "РАЙОН", "p": "KIMMAGE"},
            {"id": "dist2", "label": "МІСТО", "p": "DUBLIN 12"},
            {"id": "county", "label": "ОКРУГ", "p": "Co. Dublin 12"},
            {"id": "zip", "label": "ПОШТОВИЙ_ІНДЕКС", "p": "D12 N4V9"}
        ]

    def render(self, lines: List[str], scan: bool) -> io.BytesIO:
        with open(self._get_p("coords.json"), "r") as f: cfg = json.load(f)
        now = datetime.now()
        p_bal = round(random.uniform(70.0, 135.0), 2)
        trans = round(random.uniform(85.0, 225.0), 2)
        cutoff_dt = now - timedelta(days=20)
        
        addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(lines)]
        
        fin_map = {
            "Fin_Val_1_PrevBal": {"v": f"\u20ac{p_bal:,.2f}", "file": self.f_reg, "name": "Arial"},
            "Fin_Val_2_Payment": {"v": f"\u20ac{p_bal:,.2f}", "file": self.f_reg, "name": "Arial"},
            "Fin_Val_3_AccBalBefore": {"v": "\u20ac0.00", "file": self.f_bold, "name": "Arial-Bold"},
            "Fin_Val_4_Trans": {"v": f"\u20ac{trans:,.2f}", "file": self.f_bold, "name": "Arial-Bold"},
            "Fin_Val_5_NewBal": {"v": f"\u20ac{trans:,.2f}", "file": self.f_bold, "name": "Arial-Bold"}
        }

        with fitz.open(self._get_p("Utilydy_bill_Energia-1.pdf")) as doc:
            page = doc[0]
            page.clean_contents()

            for name, data in cfg.items():
                if name not in ["Page_1_Shield", "Finance_Values_Zone"]:
                    page.add_redact_annot(fitz.Rect(data["rect"]), fill=(1, 1, 1))
            page.apply_redactions()
            
            b_a = cfg["Address_Block"]
            for i, text in enumerate(addr):
                page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                               text, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])

            for key, item in fin_map.items():
                if key in cfg:
                    z = cfg[key]
                    f_obj = fitz.Font(fontfile=item["file"])
                    tw = f_obj.text_length(item["v"], fontsize=z["font_size"])
                    x_pos = z["rect"][2] - tw
                    page.insert_text((x_pos, z["rect"][1] + 10), item["v"], 
                                   fontname=item["name"], fontfile=item["file"], fontsize=z["font_size"])

            if "Premises_Block" in cfg:
                b_p = cfg["Premises_Block"]
                page.insert_text((b_p["rect"][0], b_p["rect"][1] + 10), 
                               f"{addr[1]}, {addr[2]}, {addr[5]}", 
                               fontname="Arial", fontfile=self.f_reg, fontsize=b_p["font_size"])

            doc.set_metadata({"producer": "macOS 15.3.1 Quartz PDFContext", "creator": "Pages"})
            tmp = io.BytesIO()
            doc.save(tmp, garbage=4, deflate=True, clean=True)
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