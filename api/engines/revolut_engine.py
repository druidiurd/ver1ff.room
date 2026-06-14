import fitz
import io
import os
import random
import numpy as np
from datetime import datetime, timedelta
from typing import List
from pathlib import Path
from PIL import Image, ImageFilter


_REDACT_ZONES = [
    [39.0,  139.0, 350.0, 162.0],
    [39.0,  165.0, 350.0, 222.0],
    [373.0, 136.0, 560.0, 152.0],
    [373.0, 148.0, 460.0, 164.0],
    [440.0,  97.0, 560.0, 112.0],
    [39.0,  288.0, 560.0, 328.0],
]

_MERCHANTS = [
    ("Lidl",          "Lidl, Dublin"),
    ("Tesco",         "Tesco, Dublin"),
    ("Dunnes Stores", "Dunnes Stores, Dublin"),
    ("Spar",          "Spar, Cork"),
    ("Circle K",      "Circle K, Galway"),
    ("Costa Coffee",  "Costa Coffee, Dublin"),
    ("McDonald's",    "McDonald's, Limerick"),
    ("Centra",        "Centra, Waterford"),
    ("Penneys",       "Penneys, Dublin"),
    ("Starbucks",     "Starbucks, Dublin"),
    ("Boots",         "Boots, Cork"),
    ("Argos",         "Argos, Galway"),
]

_IBAN_BASE = "LT39325007999899"


class RevolutEngine:
    __slots__ = ('base_path', 'f_reg', 'f_bold')

    def __init__(self, base_path: str):
        self.base_path = base_path
        api_dir = Path(base_path)
        self.f_reg  = str((api_dir / "Roboto-Regular.ttf").absolute())
        self.f_bold = str((api_dir / "Roboto-Bold.ttf").absolute())

    def get_schema(self):
        return [
            {"id": "name",   "label": "ACCOUNT_HOLDER", "p": "John Murphy",      "desc": "Full legal name of the Revolut account holder. Appears on the statement header and transaction lines."},
            {"id": "addr1",  "label": "STREET_ADDRESS",  "p": "14 Grafton Street", "desc": "Street number and street name. This is line 1 of the billing address shown on the statement."},
            {"id": "zip",    "label": "POSTAL_CODE",     "p": "D02 AB12",          "desc": "Eircode or postal code for the account address. Irish format: A99 XXXX (e.g. D02 AB12 for Dublin 2)."},
            {"id": "city",   "label": "CITY",            "p": "Dublin",            "desc": "City name for the billing address. Typically Dublin, Cork, Galway, etc."},
            {"id": "region", "label": "REGION",          "p": "County Dublin",     "desc": "County or region. Irish format: 'County Dublin', 'County Cork', etc."},
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None,
               custom_tx: bool = False, custom_merchant: str = '', custom_to: str = '',
               custom_card: str = '', custom_amount: str = '', custom_date: str = '') -> io.BytesIO:
        l = (lines + [""] * 5)[:5]
        name, addr1, zip_code, city, region = l

        now = datetime.now()
        gen_date = f"Generated on the {now.day} {now.strftime('%b %Y')}"

        # Transaction date
        if custom_tx and custom_date:
            try:
                from datetime import date as _date
                d = _date.fromisoformat(custom_date)
                tx_date = f"{d.day} {d.strftime('%b %Y')}"
            except ValueError:
                tx_offset = random.randint(1, 30)
                tx_dt = now - timedelta(days=tx_offset)
                tx_date = f"{tx_dt.day} {tx_dt.strftime('%b %Y')}"
        else:
            tx_offset = random.randint(1, 30)
            tx_dt = now - timedelta(days=tx_offset)
            tx_date = f"{tx_dt.day} {tx_dt.strftime('%b %Y')}"

        if custom_tx and custom_merchant:
            merchant = custom_merchant
            merchant_city = custom_to or custom_merchant
            try:
                tx_eur = float(custom_amount) if custom_amount else round(random.uniform(4.5, 180.0), 2)
            except ValueError:
                tx_eur = round(random.uniform(4.5, 180.0), 2)
            tx_card = custom_card if custom_card else f"416598******{random.randint(1000, 9999)}"
        else:
            merchant, merchant_city = random.choice(_MERCHANTS)
            tx_eur = round(random.uniform(4.5, 180.0), 2)
            tx_card = f"416598******{random.randint(1000, 9999)}"

        eur_str = f"€{tx_eur:,.2f}"

        iban_suffix = str(random.randint(1000, 9999))
        iban = _IBAN_BASE + iban_suffix

        pdf_path = os.path.join(self.base_path, "revo-example.pdf")
        with fitz.open(pdf_path) as doc:
            page = doc[0]
            page.clean_contents()

            for rect in _REDACT_ZONES:
                page.add_redact_annot(fitz.Rect(rect), fill=(1, 1, 1))
            page.apply_redactions()

            r = self.f_reg
            b = self.f_bold

            def ins(x, y, text, size, fontfile=None, fontname="Roboto"):
                page.insert_text((x, y), text, fontname=fontname,
                                 fontfile=(fontfile or r), fontsize=size)

            # Y = bbox_top (from original) + measured ascender per size
            # 12.38pt ascender=10.16, 8.25pt ascender=6.84, 4.50pt ascender=4.71
            ins(39.7,  152.5, name,     12.78, b, "Roboto-Bold")
            ins(39.7,  176.1, addr1,    8.25,  b, "Roboto-Bold")
            ins(39.7,  188.5, zip_code, 8.25,  b, "Roboto-Bold")
            ins(39.7,  200.9, city,     8.25,  b, "Roboto-Bold")
            ins(39.7,  213.3, region,   8.25,  b, "Roboto-Bold")

            ins(376.1, 146.1, iban,       8.25)
            ins(376.1, 158.5, "REVOLT21", 8.25)

            ins(446.1, 104.3, gen_date, 8.25)

            ins(42.7,  300.2, tx_date,  8.25)
            ins(155.1, 300.2, merchant, 8.25)

            f_obj = fitz.Font(fontfile=r)
            tw = f_obj.text_length(eur_str, fontsize=8.25)
            ins(555.6 - tw, 300.2, eur_str, 8.25)

            ins(155.1, 308.2, f"To: {merchant_city}", 4.50)
            ins(155.1, 313.5, f"Card: {tx_card}",     4.50)

            # Keep metadata identical to original (all empty)
            doc.set_metadata({
                "producer": "", "creator": "", "title": "",
                "author": "", "subject": "", "keywords": "",
                "creationDate": "", "modDate": "",
            })

            out = io.BytesIO()
            doc.save(out, garbage=4, deflate=True, clean=True)
            out.seek(0)

            # Fix /ID: make both hashes identical (original doc signature)
            # Modified PDFs have [origID newID] — we restore [origID origID]
            patched = self._patch_id(out.read())
            result = io.BytesIO(patched)
            return self._apply_scan(result) if scan else result

    def _patch_id(self, data: bytes) -> bytes:
        import re
        # Find /ID [ <hash1> <hash2> ] and replace hash2 with hash1
        def replacer(m):
            h1 = m.group(1)
            return m.group(0).replace(m.group(2), h1)
        patched = re.sub(
            rb'/ID\s*\[\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\]',
            replacer, data
        )
        return patched

    def _apply_scan(self, pdf_bytes: io.BytesIO) -> io.BytesIO:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(2, 2))
        img = Image.open(io.BytesIO(pix.tobytes()))
        # slight random rotation like a real scan
        img = img.rotate(random.uniform(-0.8, 0.8), resample=Image.BICUBIC,
                         expand=True, fillcolor=(245, 245, 245))
        arr = np.array(img)
        # paper texture noise
        noise = np.random.normal(0, 4.0, arr.shape).astype('int16')
        arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
        # slight yellowing of white areas (scanner warmth)
        mask = arr.mean(axis=2) > 220
        arr[mask, 0] = np.clip(arr[mask, 0].astype('int16') - 3, 0, 255).astype('uint8')
        arr[mask, 2] = np.clip(arr[mask, 2].astype('int16') - 8, 0, 255).astype('uint8')
        img = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(radius=0.4))
        out = io.BytesIO()
        img.save(out, format="PDF", resolution=200.0, quality=78)
        out.seek(0)
        return out
