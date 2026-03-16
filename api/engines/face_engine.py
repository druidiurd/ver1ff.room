import io
import cv2
import numpy as np
from PIL import Image, ImageOps
from typing import List

class FaceEngine:
    """Senior Biometric Engine: OpenCV Cascade Edition (Lightweight). [cite: 2026-03-16]."""
    __slots__ = ('_face_cascade',)

    def __init__(self, base_path: str):
        # Завантажуємо вбудований каскад облич [cite: 2026-03-16]
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self._face_cascade = cv2.CascadeClassifier(cascade_path)

    def get_schema(self):
        return [
            {"id": "zoom", "label": "ZOOM_FACTOR (%)", "p": "100"},
            {"id": "shift", "label": "VERTICAL_SHIFT", "p": "0"},
            {"id": "info", "label": "STATUS", "p": "OpenCV-Haar Active. 3x4 Output."}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("EMPTY_STREAM")
        
        zoom = max(10.0, float(lines[0] or 100)) / 100.0
        v_shift = int(lines[1] or 0)

        # Конвертуємо для OpenCV [cite: 2026-02-05]
        img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img_pil)
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        
        # Детекція обличчя [cite: 2026-03-16]
        faces = self._face_cascade.detectMultiScale(gray, 1.1, 4)
        
        h, w = img_np.shape[:2]
        cx, cy = w // 2, h // 2

        if len(faces) > 0:
            (x, y, fw, fh) = faces[0]
            cx, cy = x + fw // 2, y + fh // 2

        # Розрахунок 3х4 [cite: 2026-02-05, 2026-03-16]
        target_ratio = 3/4
        bw, bh = (h * target_ratio, h) if w/h > target_ratio else (w, w / target_ratio)
        
        bw, bh = bw / zoom, bh / zoom
        l, t, r, b = cx - bw/2, cy - bh/2 + v_shift, cx + bw/2, cy + bh/2 + v_shift

        # Фінальний кроп та ахуєнний ресайз [cite: 2026-02-05]
        cropped = img_pil.crop((max(0, l), max(0, t), min(w, r), min(h, b)))
        final = ImageOps.autocontrast(cropped, cutoff=0.5).resize((600, 800), Image.Resampling.LANCZOS)
        
        out = io.BytesIO()
        final.save(out, format="jpeg", quality=98)
        out.seek(0)
        return out