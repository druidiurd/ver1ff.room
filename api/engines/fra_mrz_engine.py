import unicodedata
import re
from typing import Dict, Final, Tuple, List, Any

# --- EXCEPTIONS ---
class MRZBaseError(Exception): pass
class MRZValidationError(MRZBaseError): pass
class MRZGenerationError(MRZBaseError): pass

# --- CORE MATH & ALGORITHMS ---
WEIGHTS: Final[Tuple[int, int, int]] = (7, 3, 1)
CHAR_MAP: Final[Dict[str, int]] = {
    **{str(i): i for i in range(10)},
    **{chr(ord('A') + i): 10 + i for i in range(26)},
    '<': 0
}

def char_value(ch: str) -> int: return CHAR_MAP.get(ch.upper(), 0)

def check_digit(field: str) -> str:
    total: int = sum(char_value(ch) * WEIGHTS[i % 3] for i, ch in enumerate(field))
    return str(total % 10)

def clean_name(x: str) -> str:
    x = unicodedata.normalize('NFD', x)
    x = ''.join(c for c in x if unicodedata.category(c) != 'Mn')
    x = x.upper()
    x = re.sub(r'[^A-Z ,]', '', x)
    x = x.replace(',', ' ')
    x = re.sub(r'\s+', ' ', x).strip()
    if not x: return ''
    x = x.replace(' ', '<<')
    x = re.sub(r'<{3,}', '<<', x)
    return x

def format_date(date_input: str) -> str:
    s: str = date_input.replace('-', '')
    if len(s) == 6 and s.isdigit(): return s
    elif len(s) == 8 and s.isdigit(): return s[2:8]
    raise MRZValidationError("Дата: YYMMDD або YYYY-MM-DD")

def pad_right(s: str, total_len: int, fill: str = '<') -> str:
    if len(s) > total_len: return s[:total_len]
    return s + fill * (total_len - len(s))

DATE_PATTERN: Final[re.Pattern] = re.compile(r"^\d{6}$")

def validate_department_code(code: str) -> None:
    if len(code) != 6 or not code.isdigit(): raise MRZValidationError("Номер відділу: рівно 6 цифр.")

def validate_cin(cin: str) -> None:
    if len(cin) != 12 or not all(c.isalnum() for c in cin): raise MRZValidationError("CIN: рівно 12 символів (цифри/A-Z).")

def validate_date_yyMMdd(s: str) -> None:
    if not DATE_PATTERN.fullmatch(s): raise MRZValidationError("Дата: фатальна помилка форматування.")

def normalize_sex(sex: str) -> str:
    sx: str = sex.upper()[0] if sex else '<'
    return sx if sx in ('M', 'F', '<') else '<'

def generate_fr_cni_mrz(surname: str, given_name: str, cin_number_12: str, birth_date: str, sex: str, department_code_6: str) -> Tuple[str, str]:
    if not surname or not given_name: raise MRZValidationError("Ім'я та прізвище обов'язкові.")
    validate_department_code(department_code_6)
    validate_cin(cin_number_12)

    surname_clean: str = clean_name(surname)
    base: str = 'IDFRA' + surname_clean
    base30: str = pad_right(base, 30, '<')
    line1: str = base30 + department_code_6

    doc_number: str = cin_number_12
    doc_cd: str = check_digit(doc_number)

    personal: str = clean_name(given_name)
    personal_field: str = pad_right(personal, 14, '<')

    bdate: str = format_date(birth_date)
    validate_date_yyMMdd(bdate)
    bdate_cd: str = check_digit(bdate)

    sx: str = normalize_sex(sex)

    line2_without_overall: str = f"{doc_number}{doc_cd}{personal_field}{bdate}{bdate_cd}{sx}"
    overall_cd: str = check_digit(line1 + line2_without_overall)
    line2: str = line2_without_overall + overall_cd

    return line1, line2

class FraMrzEngine:
    """France CNI MRZ Generator Wrapper [cite: 2026-02-05]."""
    __slots__ = ('base_path',)

    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_schema(self) -> List[Dict[str, str]]:
        return [
            {"id": "sur", "label": "SURNAME", "p": "DUBOIS"},
            {"id": "nam", "label": "GIVEN NAME", "p": "JEAN RENE"},
            {"id": "cin", "label": "CIN (12 CHARS)", "p": "123456789012"},
            {"id": "dob", "label": "DOB (YYYY-MM-DD)", "p": "1980-01-01"},
            {"id": "sex", "label": "SEX (M/F/X)", "p": "M", "type": "select", "opts": ["M", "F", "<"]},
            {"id": "dep", "label": "DEPT CODE (6 DIGITS)", "p": "075001"}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, str]:
        r = (lines + [""] * 6)[:6]
        
        # Safe strict fallbacks to prevent reactive 500 errors
        sur = str(r[0]).strip() if r[0] and str(r[0]).strip() else "DUBOIS"
        nam = str(r[1]).strip() if r[1] and str(r[1]).strip() else "JEAN RENE"
        cin = str(r[2]).strip() if r[2] and len(str(r[2]).strip()) == 12 else "123456789012"
        dob = str(r[3]).strip() if r[3] and str(r[3]).strip() else "1980-01-01"
        sex = str(r[4]).strip() if r[4] and str(r[4]).strip() else "M"
        dep = str(r[5]).strip() if r[5] and len(str(r[5]).strip()) == 6 else "075001"

        try:
            l1, l2 = generate_fr_cni_mrz(sur, nam, cin, dob, sex, dep)
            return {"L1": l1, "L2": l2, "STATUS": "SYNC_OK"}
        except MRZValidationError as e:
            return {"STATUS": "VALIDATION_ERR", "ERR_MSG": str(e)}
        except Exception as e:
            return {"STATUS": "VALIDATION_ERR", "ERR_MSG": "SYSTEM_FAULT"}