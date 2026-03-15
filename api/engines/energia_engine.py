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
    """Enterprise Engine v57.0 (Restored Etchalon). [cite: 2026-02-05, 2026-02-21]."""
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
        
        # 1. МАТЕМАТИКА ТА ДАТИ [cite: 2026-02-05]
        now = datetime.now()
        p_bal = round(random.uniform(70.0, 135.0), 2)
        trans = round(random.uniform(85.0, 225.0), 2)
        cutoff_dt = now - timedelta(days=20)
        
        # Форматування адреси (Upper Case для 1,2,3,5 за шаблоном) [cite: 2026-02-05]
        addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(lines)]
        
        # МАПУВАННЯ ФІНАНСІВ [cite: 2026-02-21]
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

            # Крок 1: ЗАЧИСТКА
            for name, data in cfg.items():
                if name not in ["Page_1_Shield", "Finance_Values_Zone"]:
                    page.add_redact_annot(fitz.Rect(data["rect"]), fill=(1, 1, 1))
            page.apply_redactions()
            
            # Крок 2: РЕНДЕРИНГ
            # Адреса
            b_a = cfg["Address_Block"]
            for i, text in enumerate(addr):
                page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                               text, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])

            # Таблиця інфо (Invoice, Account, etc.)
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

            # Дата платежу (Finance_Date_Zone) [cite: 2026-02-05]
            if "Finance_Date_Zone" in cfg:
                fdz = cfg["Finance_Date_Zone"]
                page.insert_text((fdz["rect"][0], fdz["rect"][1] + 10), 
                               f"Payment(s) received up to {cutoff_dt:%d %B %Y}", 
                               fontname="Arial", fontfile=self.f_reg, fontsize=9)

            # Фінанси: RIGHT ALIGNMENT LOGIC [cite: 2026-02-05]
            for key, item in fin_map.items():
                if key in cfg:
                    z = cfg[key]
                    f_obj = fitz.Font(fontfile=item["file"])
                    tw = f_obj.text_length(item["v"], fontsize=z["font_size"])
                    x_pos = z["rect"][2] - tw
                    page.insert_text((x_pos, z["rect"][1] + 10), item["v"], 
                                   fontname=item["name"], fontfile=item["file"], fontsize=z["font_size"])

            # Блок Premises [cite: 2026-02-05]
            if "Premises_Block" in cfg:
                b_p = cfg["Premises_Block"]
                page.insert_text((b_p["rect"][0], b_p["rect"][1] + 10), 
                               f"{addr[1]}, {addr[2]}, {addr[5]}", 
                               fontname="Arial", fontfile=self.f_reg, fontsize=b_p["font_size"])

            # Крок 3: АНОНІМІЗАЦІЯ macOS [cite: 2026-02-05]
            doc.set_metadata({
                "producer": "macOS Version 15.3.1 (Build 24D70) Quartz PDFContext",
                "creator": "Pages",
                "title": "Energia Utility Bill"
            })

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
        noise = np.random.normal(0, 2.5, arr.shape).astype('int16')
        arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
        img = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(radius=0.32))
        out = io.BytesIO()
        img.save(out, format="PDF", resolution=300.0, quality=82, optimize=True)
        out.seek(0)
        return out