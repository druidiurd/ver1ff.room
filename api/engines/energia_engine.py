import fitz
import json
import random
import io
import os
import shutil
from datetime import datetime, timedelta
from typing import List
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

class EnergiaEngine:
    """Enterprise Engine v57. Right Alignment & Precision Financial Logic."""
    __slots__ = ('base_path', 'f_reg', 'f_bold')

    def __init__(self, base_path: str):
        self.base_path = base_path
        self.f_reg, self.f_bold = self._prepare_fonts()

    def _prepare_fonts(self) -> tuple[str, str]:
        """Копіює системні шрифти в робочу директорію (сумісно з Windows та Vercel)."""
        wdir = Path(os.environ.get('WINDIR', 'C:\\Windows')) / "Fonts"
        local_dir = Path(self.base_path)
        reg_name, bold_name = "arial.ttf", "arialbd.ttf"
        
        for name in [reg_name, bold_name]:
            target = local_dir / name
            if not target.exists():
                source = wdir / name
                if not source.exists(): source = wdir / name.capitalize()
                if source.exists():
                    shutil.copy(source, target)
        
        return str((local_dir / reg_name).absolute()), str((local_dir / bold_name).absolute())

    def get_schema(self):
        return [
            {"id": "n", "label": "IDENTITY_NAME", "p": "Mr Peter Browne"},
            {"id": "s", "label": "STREET_LOCUS", "p": "114 STANNAWAY RD"},
            {"id": "d1", "label": "DISTRICT_ZONE", "p": "KIMMAGE"},
            {"id": "d2", "label": "CITY_DISTRICT", "p": "DUBLIN 12"},
            {"id": "c", "label": "COUNTY_REGION", "p": "Co. Dublin 12"},
            {"id": "z", "label": "ZIP_POSTCODE", "p": "D12 N4V9"}
        ]

    def _fmt(self, val: float) -> str:
        """Символ Євро через стабільний Unicode."""
        return f"\u20ac{val:,.2f}"

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        cfg_path = os.path.join(self.base_path, "coords.json")
        with open(cfg_path, "r") as f:
            cfg = json.load(f)
            
        now = datetime.now()
        p_bal = round(random.uniform(70.0, 135.0), 2)
        trans = round(random.uniform(85.0, 225.0), 2)
        cutoff_dt = now - timedelta(days=20)
        
        # МАПУВАННЯ (1-2 Regular, 3-5 Bold)
        fin_map = {
            "Fin_Val_1_PrevBal": {"v": self._fmt(p_bal), "file": self.f_reg, "name": "Arial"},
            "Fin_Val_2_Payment": {"v": self._fmt(p_bal), "file": self.f_reg, "name": "Arial"},
            "Fin_Val_3_AccBalBefore": {"v": "\u20ac0.00", "file": self.f_bold, "name": "Arial-Bold"},
            "Fin_Val_4_Trans": {"v": self._fmt(trans), "file": self.f_bold, "name": "Arial-Bold"},
            "Fin_Val_5_NewBal": {"v": self._fmt(trans), "file": self.f_bold, "name": "Arial-Bold"}
        }

        table_map = {
            "Invoice No.": str(random.randint(24500000, 24599999)),
            "Account Number": str(random.randint(5365000000, 5365999999)),
            "Tariff": "Electricity",
            "Billing Period": f"{(now-timedelta(days=33)):%d/%m/%Y} - {(now-timedelta(days=1)):%d/%m/%Y}",
            "Date of this Bill": now.strftime("%d %B %Y"),
            "Payment Due Date": (now+timedelta(days=14)).strftime("%d %B %Y")
        }

        raw_addr = (lines + [""]*6)[:6]
        addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(raw_addr)]

        pdf_path = os.path.join(self.base_path, "Utilydy_bill_Energia-1.pdf")
        with fitz.open(pdf_path) as doc:
            page = doc[0]
            page.clean_contents()

            # ЗАЧИСТКА
            for name, data in cfg.items():
                if name not in ["Page_1_Shield", "Finance_Values_Zone"]:
                    page.add_redact_annot(fitz.Rect(data["rect"]), fill=(1, 1, 1))
            page.apply_redactions()

            # АДРЕСА
            b_a = cfg["Address_Block"]
            for i, text in enumerate(addr):
                page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                               text, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])

            # ТАБЛИЦЯ ІНФО
            b_t = cfg["Invoice_Table"]
            for i, val in enumerate(table_map.values()):
                page.insert_text((b_t["rect"][0], b_t["rect"][1] + 8 + (i * b_t["line_height"])), 
                               val, fontname="Arial", fontfile=self.f_reg, fontsize=b_t["font_size"])

            # ДАТА ПЛАТЕЖУ
            if "Finance_Date_Zone" in cfg:
                fdz = cfg["Finance_Date_Zone"]
                page.insert_text((fdz["rect"][0], fdz["rect"][1] + 10), 
                               f"Payment(s) received up to {cutoff_dt:%d %B %Y}", 
                               fontname="Arial", fontfile=self.f_reg, fontsize=9)

            # АТОМАРНІ СУМИ: RIGHT ALIGNMENT LOGIC
            for key, item in fin_map.items():
                if key in cfg:
                    z = cfg[key]
                    f_obj = fitz.Font(fontfile=item["file"])
                    tw = f_obj.text_length(item["v"], fontsize=z["font_size"])
                    x_pos = z["rect"][2] - tw
                    page.insert_text((x_pos, z["rect"][1] + 10), item["v"], 
                                   fontname=item["name"], fontfile=item["file"], fontsize=z["font_size"])

            # БЛОК PREMISES
            b_p = cfg["Premises_Block"]
            page.insert_text((b_p["rect"][0], b_p["rect"][1] + 10), 
                           f"{addr[1]}, {addr[2]}, {addr[5]}", 
                           fontname="Arial", fontfile=self.f_reg, fontsize=b_p["font_size"])

            # АНОНІМІЗАЦІЯ
            meta = {
                "producer": "macOS Version 15.3.1 (Build 24D70) Quartz PDFContext",
                "creator": "Pages",
                "title": "Energia Utility Bill"
            }
            doc.set_metadata(meta)
            
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
        img.save(out, format="PDF", resolution=300.0, quality=82)
        out.seek(0)
        return out