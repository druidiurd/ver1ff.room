import fitz
import io
import os
from datetime import datetime
from typing import List
from pathlib import Path


# Zones to wipe from the original PDF before rewriting
_REDACT_ZONES = [
    # Full name (y: 139–160, left column only)
    [39.0,  139.0, 350.0, 162.0],
    # Address lines (y: 165–220)
    [39.0,  165.0, 350.0, 222.0],
    # IBAN value only (x starts after "IBAN" label which ends at ~372)
    [373.0, 136.0, 560.0, 152.0],
    # BIC value only (x starts after "BIC" label which ends at ~366)
    [373.0, 148.0, 460.0, 164.0],
    # "Generated on" date — starts below EUR Statement (y_max=96.4)
    [440.0,  97.0, 560.0, 112.0],
    # Transaction row: date, description, amount, sub-lines
    [39.0,  288.0, 560.0, 328.0],
]


class RevolutEngine:
    __slots__ = ('base_path', 'f_reg', 'f_bold')

    def __init__(self, base_path: str):
        self.base_path = base_path
        api_dir = Path(base_path)
        self.f_reg  = str((api_dir / "Roboto-Regular.ttf").absolute())
        self.f_bold = str((api_dir / "Roboto-Bold.ttf").absolute())

    def get_schema(self):
        return [
            {"id": "name",    "label": "ACCOUNT_HOLDER",    "p": "Bartolomej Fenyes"},
            {"id": "addr1",   "label": "STREET_ADDRESS",    "p": "Ivana Krasku 2307/27"},
            {"id": "zip",     "label": "POSTAL_CODE",       "p": "075 01"},
            {"id": "city",    "label": "CITY",              "p": "Trebišov"},
            {"id": "region",  "label": "REGION",            "p": "Košický kraj"},
            {"id": "iban",    "label": "IBAN",              "p": "LT393250079998998517"},
            {"id": "bic",     "label": "BIC",               "p": "REVOLT21"},
            {"id": "tx_date", "label": "TX_DATE",           "p": "10 Apr 2026"},
            {"id": "tx_desc", "label": "TX_DESCRIPTION",    "p": "Betway"},
            {"id": "tx_eur",  "label": "TX_AMOUNT_EUR",     "p": "11.54"},
            {"id": "tx_to",   "label": "TX_MERCHANT_CITY",  "p": "Betway, London"},
            {"id": "tx_card", "label": "TX_CARD_MASK",      "p": "416598******2650"},
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        l = (lines + [""] * 12)[:12]
        name, addr1, zip_code, city, region, iban, bic, \
            tx_date, tx_desc, tx_eur, tx_to, tx_card = l

        now = datetime.now()
        gen_date = f"Generated on the {now.strftime('%-d %b %Y')}" if os.name != 'nt' \
                   else f"Generated on the {now.day} {now.strftime('%b %Y')}"

        pdf_path = os.path.join(self.base_path, "revo-example.pdf")
        with fitz.open(pdf_path) as doc:
            page = doc[0]
            page.clean_contents()

            # Wipe old values
            for rect in _REDACT_ZONES:
                page.add_redact_annot(fitz.Rect(rect), fill=(1, 1, 1))
            page.apply_redactions()

            r = self.f_reg
            b = self.f_bold

            def ins(x, y, text, size, fontfile=None, fontname="Roboto"):
                ff = fontfile or r
                page.insert_text((x, y), text, fontname=fontname, fontfile=ff, fontsize=size)

            # Full name (bold, 12.4pt)
            ins(39.7, 155.0, name, 12.4, b, "Roboto-Bold")

            # Address block (8.2pt regular)
            ins(39.7, 178.0, addr1,    8.2)
            ins(39.7, 190.4, zip_code, 8.2)
            ins(39.7, 202.8, city,     8.2)
            ins(39.7, 215.2, region,   8.2)

            # IBAN / BIC
            ins(376.1, 147.8, iban, 8.2)
            ins(376.1, 160.2, bic,  8.2)

            # Generated date
            ins(446.1, 106.0, gen_date, 8.2)

            # Transaction row
            ins(42.7,  302.0, tx_date,           8.2)
            ins(155.1, 302.0, tx_desc,           8.2)

            # Amount right-aligned to x=555.6
            eur_str = f"€{float(tx_eur):,.2f}" if tx_eur else "€0.00"
            f_obj = fitz.Font(fontfile=r)
            tw = f_obj.text_length(eur_str, fontsize=8.2)
            ins(555.6 - tw, 302.0, eur_str, 8.2)

            # Sub-lines (4.5pt)
            if tx_to:
                ins(155.1, 317.0, f"To: {tx_to}", 4.5)
            if tx_card:
                ins(155.1, 322.3, f"Card: {tx_card}", 4.5)

            doc.set_metadata({
                "producer": "Revolut Bank UAB",
                "creator":  "Revolut",
                "title":    "EUR Statement",
            })

            out = io.BytesIO()
            doc.save(out, garbage=4, deflate=True, clean=True)
            out.seek(0)
            return out
