import numpy as np
from typing import List, Dict, Final

class MrzEngine:
    __slots__ = ('_weights', '_legacy_offsets')

    def __init__(self, base_path: str):
        self._weights: Final = np.array([7, 3, 1], dtype=np.int32)
        self._legacy_offsets: Final = {"55": 8, "29": 2, "04": 0, "26": 0, "17": 0, "28": 0}

    def get_schema(self):
        return [
            {"id": "sn", "label": "ПРІЗВИЩЕ", "p": "BROWNE"},
            {"id": "nt", "label": "КРАЇНА_(ISO_3)", "p": "IRL"},
            {"id": "lc", "label": "НОМЕР_ПРАВ_(9_ЦИФР)", "p": "123456789"},
            {"id": "is", "label": "СЕРІЯ_ВИДАЧІ", "p": "01"},
            {"id": "dr", "label": "DRIVER_ID_(PREFIX)", "p": "55123456"}
        ]

    def _fast_checksum(self, payload: str) -> int:
        arr = np.frombuffer(payload.encode('ascii'), dtype=np.uint8)
        vals = np.zeros_like(arr, dtype=np.int32)
        is_num = (arr >= 48) & (arr <= 57)
        is_alpha = (arr >= 65) & (arr <= 90)
        vals[is_num], vals[is_alpha] = arr[is_num] - 48, arr[is_alpha] - 55
        weights = np.tile(self._weights, (len(arr) + 2) // 3)[:len(arr)]
        return int(np.dot(vals, weights) % 10)

    def render(self, data: List[str], scan: bool = False) -> Dict[str, str]:
        sn, nt, lc, iss, drv = (data + [""] * 5)[:5]
        n_blk = nt.upper().replace(" ", "<")[:3].ljust(3, "<")
        i_blk = iss.zfill(2)[:2]
        l_blk = lc.upper()[:9]
        
        s_30 = sn.upper().replace(" ", "<")[:12].ljust(12, "<")
        m_30 = f"D<{s_30}{n_blk}<{l_blk}{i_blk}"
        
        s_31 = sn.upper().replace(" ", "<")[:13].ljust(13, "<")
        m_31 = f"D<{s_31}{n_blk}<{l_blk}{i_blk}"
        offset = self._legacy_offsets.get(drv[:2], 0)

        return {
            "GEN_2_ISO": f"{m_30}{self._fast_checksum(m_30)}",
            "GEN_1_LEGACY": f"{m_31}{(self._fast_checksum(m_31) + offset) % 10}"
        }