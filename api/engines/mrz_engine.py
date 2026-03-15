import numpy as np
from typing import List, Dict, Final

class MrzEngine:
    """Irish NDLS Dual Core MRZ Engine [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('_weights', '_legacy_offsets')

    def __init__(self, base_path: str):
        self._weights: Final = np.array([7, 3, 1], dtype=np.int32)
        self._legacy_offsets: Final = {"55": 8, "29": 2, "04": 0, "26": 0, "17": 0, "28": 0}

    def get_schema(self):
        return [
            {"id": "surname", "label": "SURNAME_VEC", "p": "BROWNE"},
            {"id": "nat", "label": "NAT_ISO_3", "p": "IRL"},
            {"id": "lic", "label": "LIC_CORE_9", "p": "123456789"},
            {"id": "issue", "label": "ISSUE_SEQ_2", "p": "01"},
            {"id": "drv", "label": "DRIVER_ID_REF", "p": "55123456"}
        ]

    def _checksum(self, payload: str) -> int:
        arr = np.frombuffer(payload.encode('ascii'), dtype=np.uint8)
        vals = np.zeros_like(arr, dtype=np.int32)
        is_num = (arr >= 48) & (arr <= 57)
        is_alpha = (arr >= 65) & (arr <= 90)
        vals[is_num], vals[is_alpha] = arr[is_num] - 48, arr[is_alpha] - 55
        w = np.tile(self._weights, (len(arr) + 2) // 3)[:len(arr)]
        return int(np.dot(vals, w) % 10)

    def render(self, data: List[str], scan: bool = False) -> Dict[str, str]:
        # Вирівнювання вхідних даних (додаємо пусті рядки, якщо їх менше 5) [cite: 2026-02-21]
        padded = data + [""] * (5 - len(data))
        sn, nt, lc, iss, drv = padded[0], padded[1], padded[2], padded[3], padded[4]
        
        n_blk = nt.upper().replace(" ", "<")[:3].ljust(3, "<")
        i_blk = iss.zfill(2)[:2]
        l_blk = lc.upper()[:9]
        
        # GEN 2 (30 BYTES)
        s_30 = sn.upper().replace(" ", "<")[:12].ljust(12, "<")
        base_30 = f"D<{s_30}{n_blk}<{l_blk}{i_blk}"
        
        # GEN 1 (31 BYTES)
        s_31 = sn.upper().replace(" ", "<")[:13].ljust(13, "<")
        base_31 = f"D<{s_31}{n_blk}<{l_blk}{i_blk}"
        off = self._legacy_offsets.get(drv[:2], 0)

        return {
            "GEN_2_ISO": f"{base_30}{self._checksum(base_30)}",
            "GEN_1_LEGACY": f"{base_31}{(self._checksum(base_31) + off) % 10}",
            "STATUS": "UPLINK_LIVE"
        }