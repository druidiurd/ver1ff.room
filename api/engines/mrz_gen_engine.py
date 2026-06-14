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
            {"id": "doc_type",    "label": "DOCUMENT_TYPE",         "p": "Passport",    "type": "select", "opts": ["Passport", "ID Card", "Visa"], "desc": "Document format to generate. Passport = TD3 (2-line MRP), ID Card = TD1 (3-line), Visa = MRV-A. Determines MRZ line count and field layout."},
            {"id": "lastname",    "label": "LAST_NAME",              "p": "SMITH",       "desc": "Surname as it appears on the document. Diacritics are transliterated per ICAO 9303 (Ä→AE, ñ→N, etc.)."},
            {"id": "firstname",   "label": "FIRST_NAME",             "p": "JOHN",        "desc": "Given name(s). Multiple names separated by spaces. Middle names are included if space allows in the MRZ."},
            {"id": "birth_date",  "label": "BIRTH_DATE",             "p": "01-01-1990",  "desc": "Date of birth in DD-MM-YYYY format. Example: 15 March 1985 → 15-03-1985. Converted to YYMMDD in MRZ."},
            {"id": "nationality", "label": "NATIONALITY",            "p": "GBR",         "desc": "3-letter ISO 3166-1 alpha-3 nationality code. GBR = United Kingdom, IRL = Ireland, DEU = Germany, etc."},
            {"id": "sex",         "label": "SEX",                    "p": "M",           "type": "select", "opts": ["M", "F", "U"], "desc": "M — male, F — female, U — unspecified. Encoded as a single character in MRZ line 2."},
            {"id": "doc_num",     "label": "DOCUMENT_NUMBER",        "p": "PA1234567",   "desc": "Document number as printed on the travel document. Up to 9 characters (letters and digits). Padded with < if shorter."},
            {"id": "expiry_date", "label": "EXPIRY_DATE",            "p": "01-01-2030",  "desc": "Document expiry date in DD-MM-YYYY format. Example: 1 January 2030 → 01-01-2030. Converted to YYMMDD in MRZ."},
            {"id": "issuer",      "label": "ISSUER_CODE",            "p": "GBR",         "desc": "3-letter ISO code of the issuing country or organization. Usually same as nationality but may differ (e.g. UN documents)."},
            {"id": "sub_type",    "label": "SUB_TYPE (optional)",    "p": "",            "desc": "Document sub-type (1-2 chars). Optional field. Passport = P (or blank), diplomatic = D, etc. Leave blank if not needed."},
            {"id": "pers_num",    "label": "PERSONAL_NUMBER (opt)",  "p": "",            "desc": "Personal number or national ID. Optional. Up to 14 chars in passport TD3 line 2 optional field. Leave blank if unknown."},
            {"id": "optional",    "label": "OPTIONAL_FIELD (opt)",   "p": "",            "desc": "Additional optional data field. Used in some national document standards. Leave blank if not applicable."},
        ]

    # ── Core helpers ─────────────────────────────────────────────────────────

    # ICAO 9303 transliteration table for common diacritics
    _DIACRITICS: dict = {
        'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE', 'ß': 'SS',
        'À': 'A',  'Á': 'A',  'Â': 'A',  'Ã': 'A',  'Å': 'A',  'Æ': 'AE',
        'Ç': 'C',  'È': 'E',  'É': 'E',  'Ê': 'E',  'Ë': 'E',
        'Ì': 'I',  'Í': 'I',  'Î': 'I',  'Ï': 'I',
        'Ð': 'D',  'Ñ': 'N',
        'Ò': 'O',  'Ó': 'O',  'Ô': 'O',  'Õ': 'O',  'Ø': 'OE',
        'Ù': 'U',  'Ú': 'U',  'Û': 'U',  'Ý': 'Y',
        'Þ': 'TH', 'Š': 'S',  'Ž': 'Z',  'Œ': 'OE', 'Ÿ': 'Y',
        'Č': 'C',  'Ď': 'D',  'Ě': 'E',  'Ň': 'N',  'Ř': 'R',
        'Ť': 'T',  'Ů': 'U',  'Ź': 'Z',  'Ż': 'Z',
        'Ą': 'A',  'Ć': 'C',  'Ę': 'E',  'Ł': 'L',  'Ń': 'N',  'Ś': 'S',
        'Ő': 'O',  'Ű': 'U',
        'Ā': 'A',  'Ē': 'E',  'Ī': 'I',  'Ō': 'O',  'Ū': 'U',
        'Ģ': 'G',  'Ķ': 'K',  'Ļ': 'L',  'Ņ': 'N',  'Ŗ': 'R',
    }

    def _clean(self, s: str) -> str:
        """Uppercase, transliterate diacritics per ICAO 9303, keep A-Z 0-9."""
        s = s.upper().strip()
        out = []
        for c in s:
            if c in self._DIACRITICS:
                out.append(self._DIACRITICS[c])
            elif c.isalpha() and c.isascii():
                out.append(c)
            elif c.isdigit():
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

    # Countries that use non-standard MRZ codes (ICAO historical exceptions)
    _MRZ_CODE: dict = {
        'DEU': 'D',   # Germany uses 'D' not 'DEU' per ICAO Annex 9
    }

    # Countries that use a non-standard first character in TD1 line 1
    # Italian CIE (Carta d'Identità Elettronica) uses 'C' per Ministero dell'Interno spec
    _TD1_DOC_CHAR: dict = {
        'ITA': 'C',
    }

    def _mrz_country(self, code: str) -> str:
        """Return 3-char MRZ country field, applying ICAO historical exceptions."""
        code = self._clamp(self._clean(code or 'XXX'), 3)
        mapped = self._MRZ_CODE.get(code, code)
        return self._clamp(mapped, 3)

    # Countries that mandate '<' for non-binary/unspecified sex in MRZ
    _SEX_FORCE_NEUTRAL = {'DEU', 'AUT', 'CHE'}

    def _norm_sex(self, s: str, issuer: str = '', nationality: str = '') -> str:
        """ICAO 9303: only M, F, < are valid. Some countries always use < for non-binary."""
        v = (s or '').strip().upper()[:1]
        if v not in ('M', 'F'):
            return '<'
        # Germany, Austria, Switzerland use < for 'diverse' identity category
        raw_issuer = (issuer or '').strip().upper()
        raw_nat    = (nationality or '').strip().upper()
        if raw_issuer in self._SEX_FORCE_NEUTRAL or raw_nat in self._SEX_FORCE_NEUTRAL:
            return v  # M and F still valid, only X/diverse → <
        return v

    # ── MRP — Passport (TD3), 2×44 ───────────────────────────────────────────

    def _mrp(self, f: Dict[str, str]) -> List[str]:
        doc_type  = 'P'
        sub_type  = self._clamp(self._clean(f.get('sub_type', '') or ''), 1) or '<'
        issuer    = self._mrz_country(f.get('issuer', 'XXX'))
        name_fld  = self._build_name_field(f.get('lastname', ''), f.get('firstname', ''), 39)
        line1     = self._clamp(f"{doc_type}{sub_type}{issuer}{name_fld}", 44)

        doc_num   = self._clamp(self._clean(f.get('doc_num', '')), 9)
        cd1       = self._check_digit(doc_num)
        nat       = self._mrz_country(f.get('nationality', 'XXX'))
        bdate     = self._date_to_mrz(f.get('birth_date', ''))
        cd2       = self._check_digit(bdate)
        sex       = self._norm_sex(f.get('sex', ''), f.get('issuer', ''), f.get('nationality', ''))
        edate     = self._date_to_mrz(f.get('expiry_date', ''))
        cd3       = self._check_digit(edate)
        pers      = self._clamp(self._clean(f.get('pers_num', '') or ''), 14)
        cd4       = self._check_digit(pers)
        # Composite CD covers: doc_num+cd1 + bdate+cd2 + edate+cd3 + pers+cd4
        composite = f"{doc_num}{cd1}{bdate}{cd2}{edate}{cd3}{pers}{cd4}"
        cd5       = self._check_digit(composite)
        line2     = self._clamp(f"{doc_num}{cd1}{nat}{bdate}{cd2}{sex}{edate}{cd3}{pers}{cd4}{cd5}", 44)

        return [line1, line2]

    # ── TD1 — ID Card, 3×30 ──────────────────────────────────────────────────
    # ICAO 9303-5: Line1[1]=doc, [2]=sub, [3-5]=issuer, [6-14]=docnum, [15]=cd1,
    #              [16-30]=optional data (no separate CD in line1)
    # Line2[1-6]=bdate,[7]=cd_bdate,[8]=sex,[9-14]=edate,[15]=cd_edate,
    #             [16-18]=nat,[19-29]=optional2,[30]=cd_composite
    # Composite CD: line1[6-30] + line2[1-7] + line2[9-15] + line2[19-29]

    def _td1(self, f: Dict[str, str]) -> List[str]:
        issuer_code = self._mrz_country(f.get('issuer', 'XXX'))
        doc_type  = self._TD1_DOC_CHAR.get(issuer_code, 'I')
        sub_type  = self._clamp(self._clean(f.get('sub_type', '') or ''), 1) or '<'
        issuer    = issuer_code
        doc_num   = self._clamp(self._clean(f.get('doc_num', '')), 9)
        cd1       = self._check_digit(doc_num)
        optional1 = self._clamp(self._clean(f.get('optional', '') or ''), 15)
        # Line1: I + sub(1) + issuer(3) + docnum(9) + cd1(1) + optional1(15) = 30
        line1     = self._clamp(f"{doc_type}{sub_type}{issuer}{doc_num}{cd1}{optional1}", 30)

        bdate     = self._date_to_mrz(f.get('birth_date', ''))
        cd2       = self._check_digit(bdate)
        sex       = self._norm_sex(f.get('sex', ''), f.get('issuer', ''), f.get('nationality', ''))
        edate     = self._date_to_mrz(f.get('expiry_date', ''))
        cd3       = self._check_digit(edate)
        nat       = self._mrz_country(f.get('nationality', 'XXX'))
        optional2 = self._clamp(self._clean(f.get('pers_num', '') or ''), 11)
        # Composite CD: line1[5:] (docnum+cd1+optional1) + bdate+cd2 + edate+cd3 + optional2
        composite = f"{doc_num}{cd1}{optional1}{bdate}{cd2}{edate}{cd3}{optional2}"
        cd4       = self._check_digit(composite)
        # Line2: bdate(6)+cd2(1)+sex(1)+edate(6)+cd3(1)+nat(3)+optional2(11)+cd4(1) = 30
        line2     = self._clamp(f"{bdate}{cd2}{sex}{edate}{cd3}{nat}{optional2}{cd4}", 30)

        line3     = self._build_name_field(f.get('lastname', ''), f.get('firstname', ''), 30)

        return [line1, line2, line3]

    # ── TD2 — 2×36 ───────────────────────────────────────────────────────────

    def _td2(self, f: Dict[str, str]) -> List[str]:
        doc_type  = 'I'
        sub_type  = self._clamp(self._clean(f.get('sub_type', '') or ''), 1) or '<'
        issuer    = self._mrz_country(f.get('issuer', 'XXX'))
        name_fld  = self._build_name_field(f.get('lastname', ''), f.get('firstname', ''), 31)
        line1     = self._clamp(f"{doc_type}{sub_type}{issuer}{name_fld}", 36)

        doc_num   = self._clamp(self._clean(f.get('doc_num', '')), 9)
        cd1       = self._check_digit(doc_num)
        nat       = self._mrz_country(f.get('nationality', 'XXX'))
        bdate     = self._date_to_mrz(f.get('birth_date', ''))
        cd2       = self._check_digit(bdate)
        sex       = self._norm_sex(f.get('sex', ''), f.get('issuer', ''), f.get('nationality', ''))
        edate     = self._date_to_mrz(f.get('expiry_date', ''))
        cd3       = self._check_digit(edate)
        optional  = self._clamp(self._clean(f.get('optional', '') or ''), 7)
        composite = f"{doc_num}{cd1}{bdate}{cd2}{edate}{cd3}{optional}"
        cd4       = self._check_digit(composite)
        line2     = self._clamp(f"{doc_num}{cd1}{nat}{bdate}{cd2}{sex}{edate}{cd3}{optional}{cd4}", 36)

        return [line1, line2]

    # ── MRV-A — Visa, 2×44 ───────────────────────────────────────────────────
    # MRV-A: same layout as MRP but type=V, no personal number CD in composite

    def _mrv_a(self, f: Dict[str, str]) -> List[str]:
        sub_type  = self._clamp(self._clean(f.get('sub_type', '') or ''), 1) or '<'
        issuer    = self._mrz_country(f.get('issuer', 'XXX'))
        name_fld  = self._build_name_field(f.get('lastname', ''), f.get('firstname', ''), 39)
        line1     = self._clamp(f"V{sub_type}{issuer}{name_fld}", 44)

        doc_num   = self._clamp(self._clean(f.get('doc_num', '')), 9)
        cd1       = self._check_digit(doc_num)
        nat       = self._mrz_country(f.get('nationality', 'XXX'))
        bdate     = self._date_to_mrz(f.get('birth_date', ''))
        cd2       = self._check_digit(bdate)
        sex       = self._norm_sex(f.get('sex', ''), f.get('issuer', ''), f.get('nationality', ''))
        edate     = self._date_to_mrz(f.get('expiry_date', ''))
        cd3       = self._check_digit(edate)
        # MRV-A: no personal number field, positions 29-44 = optional (no composite CD)
        optional  = self._clamp(self._clean(f.get('optional', '') or ''), 16)
        line2     = self._clamp(f"{doc_num}{cd1}{nat}{bdate}{cd2}{sex}{edate}{cd3}{optional}", 44)

        return [line1, line2]

    # ── eDL — Electronic Driver's License ────────────────────────────────────

    def _edl(self, f: Dict[str, str]) -> List[str]:
        doc_num = self._clamp(self._clean(f.get('doc_num', '')), 9, '0')
        cd1     = self._check_digit(doc_num)
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
            result['MRP'] = self._mrp(f)
        elif doc_type == 'ID Card':
            result['TD1'] = self._td1(f)
            result['TD2'] = self._td2(f)
        elif doc_type == 'Visa':
            result['MRV_A'] = self._mrv_a(f)
        else:
            result['MRP'] = self._mrp(f)

        # Always include eDL
        result['EDL'] = self._edl(f)

        return result
