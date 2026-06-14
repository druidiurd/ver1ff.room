
# requirements: Pillow
import io, base64
from PIL import Image, ImageDraw
from typing import List, Dict

# Code 39 encoding: 9-bit string (1=wide, 0=narrow), ordered B,S,B,S,B,S,B,S,B
_C39 = {
    '0':'000110100','1':'100100001','2':'001100001','3':'101100000',
    '4':'000110001','5':'100110000','6':'001110000','7':'000100101',
    '8':'100100100','9':'001100100','A':'100001001','B':'001001001',
    'C':'101001000','D':'000011001','E':'100011000','F':'001011000',
    'G':'000001101','H':'100001100','I':'001001100','J':'000011100',
    'K':'100000011','L':'001000011','M':'101000010','N':'000010011',
    'O':'100010010','P':'001010010','Q':'000000111','R':'100000110',
    'S':'001000110','T':'000010110','U':'110000001','V':'011000001',
    'W':'111000000','X':'010010001','Y':'110010000','Z':'011010000',
    '-':'000100011','.':'100100010',' ':'011000100','*':'010010100',
}

_MONTH_CODES = 'ABCDEHLMPRST'

_ODD = {
    '0':1,'1':0,'2':5,'3':7,'4':9,'5':13,'6':15,'7':17,'8':19,'9':21,
    'A':1,'B':0,'C':5,'D':7,'E':9,'F':13,'G':15,'H':17,'I':19,'J':21,
    'K':2,'L':4,'M':18,'N':20,'O':11,'P':3,'Q':6,'R':8,'S':12,'T':14,
    'U':16,'V':10,'W':22,'X':25,'Y':24,'Z':23,
}
_EVEN = {
    '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
    'A':0,'B':1,'C':2,'D':3,'E':4,'F':5,'G':6,'H':7,'I':8,'J':9,
    'K':10,'L':11,'M':12,'N':13,'O':14,'P':15,'Q':16,'R':17,'S':18,'T':19,
    'U':20,'V':21,'W':22,'X':23,'Y':24,'Z':25,
}


def _consonants_vowels(s: str):
    s = s.upper().replace(' ', '')
    c = ''.join(x for x in s if x in 'BCDFGHJKLMNPQRSTVWXYZ')
    v = ''.join(x for x in s if x in 'AEIOU')
    return c, v

def _code_surname(s: str) -> str:
    c, v = _consonants_vowels(s)
    return (c + v + 'XXX')[:3]

def _code_name(s: str) -> str:
    c, v = _consonants_vowels(s)
    if len(c) >= 4:
        return c[0] + c[2] + c[3]
    return (c + v + 'XXX')[:3]

def _control(cf15: str) -> str:
    total = sum(_ODD[c] if (i + 1) % 2 != 0 else _EVEN[c] for i, c in enumerate(cf15))
    return chr(ord('A') + (total % 26))

def _generate_cf(sn: str, nm: str, dob: str, gender: str, place: str) -> str:
    cf = _code_surname(sn) + _code_name(nm)
    parts = dob.replace('-', '/').replace('.', '/').split('/')
    day, month, year = parts[0].strip(), parts[1].strip(), parts[2].strip()
    cf += year[-2:]
    cf += _MONTH_CODES[int(month) - 1]
    day_val = int(day) + (40 if gender.upper() == 'F' else 0)
    cf += f'{day_val:02d}'
    cf += place.upper()[:4].ljust(4, 'X')
    cf += _control(cf)
    return cf

def _barcode_png(data: str, w: int = 2740, h: int = 383) -> str:
    payload = '*' + data + '*'
    NARROW, WIDE = 1, 3
    GAP = 1  # inter-char narrow space

    seq: list[tuple[bool, int]] = []
    for i, ch in enumerate(payload):
        if i > 0:
            seq.append((False, GAP))
        for j, bit in enumerate(_C39[ch]):
            seq.append((j % 2 == 0, WIDE if bit == '1' else NARROW))

    total_units = sum(u for _, u in seq)
    quiet_px = int(w * 0.015)
    bar_w = w - 2 * quiet_px
    unit_px = bar_w / total_units

    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    x = float(quiet_px)
    for is_bar, units in seq:
        pw = units * unit_px
        if is_bar:
            draw.rectangle([round(x), 0, round(x + pw) - 1, h - 1], fill=(0, 0, 0, 255))
        x += pw

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()


class ItaCfEngine:
    def __init__(self, base_path: str): pass

    def get_schema(self):
        return [
            {'id': 'sn', 'label': 'SURNAME',       'p': 'ROSSI',      'desc': 'Last name as in the document. Only letters, no accents needed.'},
            {'id': 'nm', 'label': 'FIRST NAME',     'p': 'MARIO',      'desc': 'First name (given name). Multiple names: enter the first one only.'},
            {'id': 'bd', 'label': 'DATE OF BIRTH',  'p': '15/03/1990', 'desc': 'Format: DD/MM/YYYY'},
            {'id': 'gn', 'label': 'GENDER',         'p': 'M', 'type': 'select', 'opts': ['M', 'F'], 'desc': 'M — male, F — female. Affects day-of-birth encoding (+40 for female).'},
            {'id': 'pc', 'label': 'PLACE CODE',     'p': 'F205',       'desc': 'Belfiore code of birth municipality or country. Italy cities: F205=Milan, H501=Rome, L219=Turin. Foreign: Z118=Ukraine, Z114=Russia, Z112=UK, Z139=USA.'},
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict:
        sn, nm, bd, gn, pc = (lines + [''] * 5)[:5]
        if not all([sn, nm, bd, gn, pc]):
            return {'STATUS': 'INCOMPLETE', 'CF_CODE': '', 'BARCODE_B64': ''}
        try:
            cf = _generate_cf(sn, nm, bd, gn, pc)
            barcode_b64 = _barcode_png(cf)
            return {'STATUS': 'OK', 'CF_CODE': cf, 'BARCODE_B64': barcode_b64}
        except Exception as e:
            return {'STATUS': 'ERR', 'CF_CODE': str(e), 'BARCODE_B64': ''}
