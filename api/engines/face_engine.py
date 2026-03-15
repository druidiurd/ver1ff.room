import io
from PIL import Image, ImageOps
from typing import List

class FaceEngine:
    """Біометрична підготовка обличчя [cite: 2026-02-05]."""
    __slots__ = ('base_path',)

    def __init__(self, base_path: str):
        self.base_path = base_path

    def get_schema(self):
        return [
            {"id": "quality", "label": "COMPRESSION", "p": "95"},
            {"id": "mode", "label": "AUTO_LEVELS", "p": "ENABLED"}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: 
            raise ValueError("NO_IMAGE_PAYLOAD")
        
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            # Senior Move: авто-контраст для чіткості обличчя [cite: 2026-02-05]
            img = ImageOps.autocontrast(img, cutoff=0.5)
            
            output = io.BytesIO()
            img.save(output, format="jpeg", quality=95, optimize=True)
            output.seek(0)
            return output