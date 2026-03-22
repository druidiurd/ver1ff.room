import numpy as np
from typing import List, Dict, Final

class NldMrzEngine:
    """NLD TD1 ID MRZ Engine. Vectorized ICAO-9303."""
    __slots__ = ('_weights',)

    def __init__(self, base_path: str):
        self._weights: Final = np.array([7, 3, 1], dtype=np.int32)

    def get_schema(self) -> List[Dict[str, str]]:
        return [
            {"id": "doc", "label": "DOC_NUM (9)", "p": "SPECIIMEN"},
            {"id": "bsn", "label": "BSN (14)", "p": "123456789"},
            {"id": "dob", "label": "DOB (YYMMDD)", "p": "800101"},
            {"id": "sex", "label": "SEX (M/F/X)", "p": "M"},
            {"id": "exp", "label": "EXPIRY (YYMMDD)", "p": "300101"},
            {"id": "nat", "label": "NATION (ISO)", "p": "NLD"},
            {"id": "sur", "label": "SURNAME", "p": "DE VRIES"},
            {"id": "nam", "label": "GIVEN NAMES", "p": "JAN"}
        ]

    def _chk(self, payload: str) -> str:
        if not payload: return "0"
        arr = np.frombuffer(payload.encode('ascii'), dtype=np.uint8)
        vals = np.zeros_like(arr, dtype=np.int32)
        vals[(arr >= 48) & (arr <= 57)] = arr[(arr >= 48) & (arr <= 57)] - 48
        vals[(arr >= 65) & (arr <= 90)] = arr[(arr >= 65) & (arr <= 90)] - 55
        w = np.tile(self._weights, (len(arr) + 2) // 3)[:len(arr)]
        return str(int(np.dot(vals, w) % 10))

    def _pad(self, txt: str, length: int) -> str:
        return str(txt).upper().replace(' ', '<')[:length].ljust(length, '<')

    def render(self, data: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, str]:
        r = (data + [""] * 8)[:8]
        doc = self._pad(r[0] or "SPECIIMEN", 9)
        bsn = self._pad(r[1] or "123456789", 14)
        dob = self._pad(r[2] or "800101", 6)
        sex = self._pad(r[3] or "M", 1)
        exp = self._pad(r[4] or "300101", 6)
        nat = self._pad(r[5] or "NLD", 3)
        sur = str(r[6] or "DE VRIES").upper().replace(' ', '<')
        nam = str(r[7] or "JAN").upper().replace(' ', '<')

        c1, c2, c3, c4 = self._chk(doc), self._chk(bsn), self._chk(dob), self._chk(exp)
        comp_raw = f"{doc}{c1}{bsn}{c2}{dob}{c3}{exp}{c4}{'<'*11}"
        c5 = self._chk(comp_raw)

        return {
            "L1": f"I<NLD{doc}{c1}{bsn}{c2}",
            "L2": f"{dob}{c3}{sex}{exp}{c4}{nat}{'<'*11}{c5}",
            "L3": self._pad(f"{sur}<<{nam}", 30),
            "STATUS": "SYNC_OK"
        }