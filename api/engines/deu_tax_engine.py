"""
German Steuer-ID (Steueridentifikationsnummer) generator.
11-digit personal tax number, issued once per person for life.
Check digit: ISO 7064 Modulo 11,10.
Rules: first digit != 0, exactly one digit appears 2-3x, no digit appears 4+ times.
"""
import random
from typing import List, Dict, Any


class DeuTaxEngine:
    __slots__ = ('base_path',)

    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_schema(self) -> List[Dict[str, Any]]:
        return []

    @staticmethod
    def _check_digit(number_str: str) -> str:
        remainder = 10
        for digit in number_str:
            s = (int(digit) + remainder) % 10
            if s == 0:
                s = 10
            remainder = (s * 2) % 11
        cd = 11 - remainder
        return '0' if cd == 10 else str(cd)

    @staticmethod
    def _generate_one() -> str:
        while True:
            repeat_digit = random.choice('0123456789')
            repeat_count = random.choice([2, 3])
            others = [d for d in '0123456789' if d != repeat_digit]
            unique = random.sample(others, 10 - repeat_count)
            first10 = [repeat_digit] * repeat_count + unique
            random.shuffle(first10)
            if first10[0] == '0':
                continue
            base = ''.join(first10)
            return base + DeuTaxEngine._check_digit(base)

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, Any]:
        tax_id = self._generate_one()
        return {'STATUS': 'OK', 'TAX_ID': tax_id}
