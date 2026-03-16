import io
from PIL import Image, ImageOps
from typing import List

class FaceEngine:
    """Enterprise biometric cropper with real-time response. [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('base_path',)

    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_schema(self):
        return [
            {"id": "zoom", "label": "ZOOM_LVL (%)", "p": "100"},
            {"id": "offset", "label": "VERTICAL_POS", "p": "0"},
            {"id": "info", "label": "GUIDE", "p": "Preview updates on every change."}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes:
            raise ValueError("ERR_EMPTY_BUFFER")
        
        # Парсинг параметрів з реактивних інпутів [cite: 2026-02-05]
        zoom = float(lines[0]) / 100.0 if lines and lines[0] else 1.0
        offset = int(lines[1]) if len(lines) > 1 and lines[1] else 0

        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            # Senior Contrast Fix для біометрії [cite: 2026-02-05]
            img = ImageOps.autocontrast(img, cutoff=0.5)
            
            w, h = img.size
            target_ratio = 3/4
            
            if w/h > target_ratio:
                new_w = h * target_ratio
                new_h = h
            else:
                new_w = w
                new_h = w / target_ratio

            # Розрахунок зуму та динамічного зміщення [cite: 2026-02-21]
            new_w /= zoom
            new_h /= zoom

            left = (w - new_w) / 2
            top = (h - new_h) / 2 + offset
            right = (w + new_w) / 2
            bottom = (h + new_h) / 2 + offset

            # Кроп та ресайз до стандарту 600x800
            img = img.crop((left, top, right, bottom))
            img = img.resize((600, 800), Image.Resampling.LANCZOS)
            
            output = io.BytesIO()
            img.save(output, format="jpeg", quality=98, optimize=True)
            output.seek(0)
            return output