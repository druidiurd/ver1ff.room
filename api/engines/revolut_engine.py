import fitz
import io
import os
import random
from datetime import datetime, timedelta
from typing import List
from pathlib import Path


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
            {"id": "name",   "label": "ACCOUNT_HOLDER", "p": "John Murphy"},
            {"id": "addr1",  "label": "STREET_ADDRESS",  "p": "14 Grafton Street"},
            {"id": "zip",    "label": "POSTAL_CODE",     "p": "D02 AB12"},
            {"id": "city",   "label": "CITY",            "p": "Dublin"},
            {"id": "region", "label": "REGION",          "p": "County Dublin"},
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        l = (lines + [""] * 5)[:5]
        name, addr1, zip_code, city, region = l

        now = datetime.now()
        gen_date = f"Generated on the {now.day} {now.strftime('%b %Y')}"

        # Random transaction date — last 30 days, not today
        tx_offset = random.randint(1, 30)
        tx_dt = now - timedelta(days=tx_offset)
        tx_date = f"{tx_dt.day} {tx_dt.strftime('%b %Y')}"

        merchant, merchant_city = random.choice(_MERCHANTS)
        tx_eur = round(random.uniform(4.5, 180.0), 2)
        eur_str = f"€{tx_eur:,.2f}"

        card_suffix = random.randint(1000, 9999)
        tx_card = f"416598******{card_suffix}"

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

            ins(39.7, 155.0, name,     12.4, b, "Roboto-Bold")
            ins(39.7, 178.0, addr1,    8.2)
            ins(39.7, 190.4, zip_code, 8.2)
            ins(39.7, 202.8, city,     8.2)
            ins(39.7, 215.2, region,   8.2)

            ins(376.1, 147.8, iban,       8.2)
            ins(376.1, 160.2, "REVOLT21", 8.2)

            ins(446.1, 106.0, gen_date, 8.2)

            ins(42.7,  302.0, tx_date,  8.2)
            ins(155.1, 302.0, merchant, 8.2)

            f_obj = fitz.Font(fontfile=r)
            tw = f_obj.text_length(eur_str, fontsize=8.2)
            ins(555.6 - tw, 302.0, eur_str, 8.2)

            ins(155.1, 317.0, f"To: {merchant_city}", 4.5)
            ins(155.1, 322.3, f"Card: {tx_card}",     4.5)

            doc.set_metadata({
                "producer": "Revolut Bank UAB",
                "creator":  "Revolut",
                "title":    "EUR Statement",
            })

            out = io.BytesIO()
            doc.save(out, garbage=4, deflate=True, clean=True)
            out.seek(0)
            return out
