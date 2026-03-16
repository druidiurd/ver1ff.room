import io
from PIL import Image, ImageOps
from typing import List

class FaceEngine:
    """Біометричний кроп 3х4 з регулюванням відступів [cite: 2026-02-05]."""
    __slots__ = ('base_path',)

    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_schema(self):
        return [
            {"id": "zoom", "label": "ZOOM_FACTOR (%)", "p": "100"},
            {"id": "offset", "label": "VERTICAL_SHIFT", "p": "0"},
            {"id": "instr", "label": "INFO", "p": "Target: 3x4 Aspect. Auto-levels enabled."}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("NO_IMAGE_DATA")
        
        zoom = float(lines[0]) / 100.0 if lines and lines[0] else 1.0
        offset = int(lines[1]) if len(lines) > 1 and lines[1] else 0

        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            img = ImageOps.autocontrast(img, cutoff=0.5)
            
            w, h = img.size
            # Розрахунок 3х4 кропу відносно центру [cite: 2026-02-05]
            target_ratio = 3/4
            if w/h > target_ratio:
                new_w = h * target_ratio
                new_h = h
            else:
                new_w = w
                new_h = w / target_ratio

            # Застосування зуму [cite: 2026-02-21]
            new_w /= zoom
            new_h /= zoom

            left = (w - new_w) / 2
            top = (h - new_h) / 2 + offset
            right = (w + new_w) / 2
            bottom = (h + new_h) / 2 + offset

            img = img.crop((left, top, right, bottom))
            img = img.resize((600, 800), Image.Resampling.LANCZOS)
            
            output = io.BytesIO()
            img.save(output, format="jpeg", quality=98)
            output.seek(0)
            return output