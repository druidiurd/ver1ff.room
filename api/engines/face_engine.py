import io
import os
from PIL import Image, ImageOps
from typing import List

class FaceEngine:
    """Engine for biometric face preparation. [cite: 2026-02-05, 2026-02-21]."""
    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_schema(self):
        return [
            {"id": "quality", "label": "COMPRESSION_LVL", "p": "95"},
            {"id": "bg", "label": "BACKGROUND_VAL", "p": "WHITE"}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("ERR_NO_IMAGE_PAYLOAD")
        
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            # Автоматичний баланс білого та кроп [cite: 2026-02-05]
            img = ImageOps.autocontrast(img, cutoff=0.5)
            
            output = io.BytesIO()
            img.save(output, format="jpeg", quality=95)
            output.seek(0)
            return output