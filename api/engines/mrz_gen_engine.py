"""
MRZ Generator Engine — ICAO 9303 compliant.
Supports: MRP (Passport TD3), TD1 (ID Card), TD2, eDL (Driver's License).
"""
import random
import string
from typing import List, Dict, Any


class MrzGenEngine:
    __slots__ = ('base_path',)

    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_schema(self) -> List[Dict[str, Any]]:
        return [
            {"id": "doc_type",    "label": "DOCUMENT_TYPE",    "p": "Passport",    "type": "select", "opts": ["Passport", "ID Card", "Visa"]},
            {"id": "lastname",    "label": "LAST_NAME",         "p": "SMITH"},
            {"id": "firstname",   "label": "FIRST_NAME",        "p": "JOHN"},
            {"id": "birth_date",  "label": "BIRTH_DATE (DD-MM-YYYY)", "p": "01-01-1990"},
            {"id": "nationality", "label": "NATIONALITY (3L)",  "p": "GBR"},
            {"id": "sex",         "label": "SEX",               "p": "M",           "type": "select", "opts": ["M", "F", "U"]},
            {"id": "doc_num",     "label": "DOCUMENT_NUMBER",   "p": "PA1234567"},
            {"id": "expiry_date", "label": "EXPIRY_DATE (DD-MM-YYYY)", "p": "01-01-2030"},
            {"id": "issuer",      "label": "ISSUER_CODE (3L)",  "p": "GBR"},
            {"id": "sub_type",    "label": "SUB_TYPE (opt)",    "p": ""},
            {"id": "pers_num",    "label": "PERSONAL_NUMBER (opt)", "p": ""},
            {"id": "optional",    "label": "OPTIONAL_FIELD (opt)",  "p": ""},
        ]

    # ── Core helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _clean(s: str) -> str:
        """Uppercase, keep A-Z 0-9, replace space with <, strip rest."""
        s = s.upper().strip()
        out = []
        for c in s:
            if c.isalpha() or c.isdigit():
                out.append(c)
            elif c in (' ', '<'):
                out.append('<')
        return ''.join(out)

    @staticmethod
    def _clamp(s: str, length: int, pad: str = '<') -> str:
        s = s[:length]
        return s.ljust(length, pad)

    @staticmethod
    def _check_digit(data: str) -> str:
        weights = [7, 3, 1]
        total = 0
        for i, c in enumerate(data):
            cc = ord(c)
            if 48 <= cc <= 57:
                val = cc - 48
            elif 65 <= cc <= 90:
                val = cc - 55
            else:
                val = 0  # '<' and others = 0
            total += val * weights[i % 3]
        return str(total % 10)

    @staticmethod
    def _date_to_mrz(dmy: str) -> str:
        """Convert DD-MM-YYYY → YYMMDD."""
        try:
            parts = dmy.strip().replace('/', '-').split('-')
            dd, mm, yyyy = parts[0].zfill(2), parts[1].zfill(2), parts[2]
            yy = yyyy[-2:]
            return f"{yy}{mm}{dd}"
        except Exception:
            return '000000'

    def _build_name_field(self, lastname: str, firstname: str, length: int) -> str:
        ln = self._clean(lastname) or '<'
        fn = self._clean(firstname) or '<'
        combined = f"{ln}<<{fn}"
        return self._clamp(combined, length)

    # ── MRP — Passport (TD3), 2×44 ───────────────────────────────────────────

    def _mrp(self, f: Dict[str, str]) -> List[str]:
        doc_type  = 'P'
        sub_type  = self._clamp(self._clean(f.get('sub_type', '') or '<'), 1) or '<'
        issuer    = self._clamp(self._clean(f.get('issuer', 'XXX')), 3)
        name_fld  = self._build_name_field(f.get('lastname', ''), f.get('firstname', ''), 39)

        line1 = f"{doc_type}{sub_type}{issuer}{name_fld}"

        doc_num   = self._clamp(self._clean(f.get('doc_num', '')), 9)
        cd1       = self._check_digit(doc_num)
        nat       = self._clamp(self._clean(f.get('nationality', 'XXX')), 3)
        bdate     = self._date_to_mrz(f.get('birth_date', ''))
        cd2       = self._check_digit(bdate)
        sex       = f.get('sex', 'U')[0].upper() if f.get('sex') else 'U'
        edate     = self._date_to_mrz(f.get('expiry_date', ''))
        cd3       = self._check_digit(edate)
        pers      = self._clamp(self._clean(f.get('pers_num', '') or ''), 14)
        cd4       = self._check_digit(pers)
        final_src = f"{doc_num}{cd1}{bdate}{cd2}{edate}{cd3}{pers}{cd4}"
        cd5       = self._check_digit(final_src)

        line2 = f"{doc_num}{cd1}{nat}{bdate}{cd2}{sex}{edate}{cd3}{pers}{cd4}{cd5}"
        return [line1, line2]

    # ── TD1 — ID Card, 3×30 ──────────────────────────────────────────────────

    def _td1(self, f: Dict[str, str]) -> List[str]:
        doc_type  = 'I'
        sub_type  = self._clamp(self._clean(f.get('sub_type', '') or '<'), 1) or '<'
        issuer    = self._clamp(self._clean(f.get('issuer', 'XXX')), 3)
        doc_num   = self._clamp(self._clean(f.get('doc_num', '')), 9)
        cd1       = self._check_digit(doc_num)
        optional  = self._clamp(self._clean(f.get('optional', '') or ''), 15)
        cd_opt    = self._check_digit(optional)

        line1 = f"{doc_type}{sub_type}{issuer}{doc_num}{cd1}{optional}{cd_opt}"
        # line1 must be 30
        line1 = self._clamp(line1, 30)

        bdate     = self._date_to_mrz(f.get('birth_date', ''))
        cd2       = self._check_digit(bdate)
        sex       = f.get('sex', 'U')[0].upper() if f.get('sex') else 'U'
        edate     = self._date_to_mrz(f.get('expiry_date', ''))
        cd3       = self._check_digit(edate)
        nat       = self._clamp(self._clean(f.get('nationality', 'XXX')), 3)
        pers      = self._clamp(self._clean(f.get('pers_num', '') or ''), 11)
        final_src = (f"{doc_num}{cd1}{optional}{cd_opt}"
                     f"{bdate}{cd2}{edate}{cd3}{pers}")
        cd4       = self._check_digit(final_src)

        line2 = f"{bdate}{cd2}{sex}{edate}{cd3}{nat}{pers}{cd4}"
        line2 = self._clamp(line2, 30)

        line3 = self._build_name_field(f.get('lastname', ''), f.get('firstname', ''), 30)

        return [line1, line2, line3]

    # ── TD2 — 2×36 / 2×35 ───────────────────────────────────────────────────

    def _td2(self, f: Dict[str, str]) -> List[str]:
        doc_type  = 'I'
        sub_type  = self._clamp(self._clean(f.get('sub_type', '') or '<'), 1) or '<'
        issuer    = self._clamp(self._clean(f.get('issuer', 'XXX')), 3)
        name_fld  = self._build_name_field(f.get('lastname', ''), f.get('firstname', ''), 31)

        line1 = f"{doc_type}{sub_type}{issuer}{name_fld}"   # 36 chars

        doc_num   = self._clamp(self._clean(f.get('doc_num', '')), 9)
        cd1       = self._check_digit(doc_num)
        nat       = self._clamp(self._clean(f.get('nationality', 'XXX')), 3)
        bdate     = self._date_to_mrz(f.get('birth_date', ''))
        cd2       = self._check_digit(bdate)
        sex       = f.get('sex', 'U')[0].upper() if f.get('sex') else 'U'
        edate     = self._date_to_mrz(f.get('expiry_date', ''))
        cd3       = self._check_digit(edate)
        optional  = self._clamp(self._clean(f.get('optional', '') or ''), 7)
        final_src = f"{doc_num}{cd1}{bdate}{cd2}{edate}{cd3}{optional}"
        cd4       = self._check_digit(final_src)

        line2 = f"{doc_num}{cd1}{nat}{bdate}{cd2}{sex}{edate}{cd3}{optional}{cd4}"  # 36

        return [line1, line2]

    # ── eDL — Electronic Driver's License ────────────────────────────────────

    def _edl(self, f: Dict[str, str]) -> List[str]:
        doc_num = self._clamp(self._clean(f.get('doc_num', '')), 9, '0')
        cd1     = self._check_digit(doc_num)
        # 13 random alphanumeric chars for padding
        rand13  = ''.join(random.choices(string.ascii_uppercase + string.digits, k=13))
        prefix  = 'D1NLD2'
        body    = f"{doc_num}{cd1}{rand13}"
        cd2     = self._check_digit(prefix + body)
        return [f"{prefix}{body}{cd2}"]

    # ── Public render ─────────────────────────────────────────────────────────

    async def render(self, lines: List[str], scan: bool = False,
                     image_bytes: bytes = None) -> Dict[str, Any]:
        schema = self.get_schema()
        f: Dict[str, str] = {}
        for i, field in enumerate(schema):
            f[field['id']] = lines[i].strip() if i < len(lines) and lines[i] else ''

        doc_type = f.get('doc_type', 'Passport')

        result: Dict[str, Any] = {
            'STATUS': 'SYNC_OK',
            'DOC_TYPE': doc_type,
        }

        if doc_type == 'Passport':
            lines_mrp = self._mrp(f)
            result['MRP'] = lines_mrp
        elif doc_type == 'ID Card':
            lines_td1 = self._td1(f)
            lines_td2 = self._td2(f)
            result['TD1'] = lines_td1
            result['TD2'] = lines_td2
        elif doc_type == 'Visa':
            # Visa uses MRV-A (2×44 like MRP but type=V) or MRV-B (2×36)
            # We generate MRV-A as primary
            f_visa = dict(f)
            visa_lines = self._mrp(f_visa)
            visa_lines[0] = 'V' + visa_lines[0][1:]  # replace P with V
            result['MRV_A'] = visa_lines
        else:
            lines_mrp = self._mrp(f)
            result['MRP'] = lines_mrp

        # Always include eDL
        result['EDL'] = self._edl(f)

        return result
