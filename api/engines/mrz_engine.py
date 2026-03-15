import numpy as np
from typing import List, Dict, Final

class MrzEngine:
    """Reactive NDLS Dual Core MRZ Engine [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('_weights', '_legacy_offsets')

    def __init__(self, base_path: str):
        self._weights: Final = np.array([7, 3, 1], dtype=np.int32)
        self._legacy_offsets: Final = {"55": 8, "29": 2, "04": 0, "26": 0, "17": 0, "28": 0}

    def get_schema(self):
        return [
            {"id": "sn", "label": "ПРИЗВИЩЕ", "p": "BROWNE"},
            {"id": "nt", "label": "КРАЇНА (ISO_3)", "p": "IRL"},
            {"id": "lc", "label": "НОМЕР ПРАВ (9 ЦИФР)", "p": "123456789"},
            {"id": "is", "label": "СЕРІЯ ВИДАЧІ", "p": "01"},
            {"id": "dr", "label": "DRIVER_ID (PREFIX)", "p": "55123456"}
        ]

    def _fast_checksum(self, payload: str) -> int:
        arr = np.frombuffer(payload.encode('ascii'), dtype=np.uint8)
        vals = np.zeros_like(arr, dtype=np.int32)
        vals[(arr >= 48) & (arr <= 57)] = arr[(arr >= 48) & (arr <= 57)] - 48
        vals[(arr >= 65) & (arr <= 90)] = arr[(arr >= 65) & (arr <= 90)] - 55
        w = np.tile(self._weights, (len(arr) + 2) // 3)[:len(arr)]
        return int(np.dot(vals, w) % 10)

    def render(self, data: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, str]:
        # Fix: додано image_bytes у сигнатуру [cite: 2026-03-16]
        raw = (data + [""] * 5)[:5]
        sn, nt, lc, iss, drv = raw[0], raw[1], raw[2], raw[3], raw[4]
        
        n_blk = nt.upper().replace(" ", "<")[:3].ljust(3, "<")
        i_blk = iss.zfill(2)[:2]
        l_blk = lc.upper()[:9]
        
        s_30 = sn.upper().replace(" ", "<")[:12].ljust(12, "<")
        m_30 = f"D<{s_30}{n_blk}<{l_blk}{i_blk}"
        
        s_31 = sn.upper().replace(" ", "<")[:13].ljust(13, "<")
        m_31 = f"D<{s_31}{n_blk}<{l_blk}{i_blk}"
        off = self._legacy_offsets.get(drv[:2], 0)

        return {
            "GEN_2_ISO": f"{m_30}{self._fast_checksum(m_30)}",
            "GEN_1_LEGACY": f"{m_31}{(self._fast_checksum(m_31) + off) % 10}",
            "STATUS": "SYNC_OK"
        }