import io, cv2, numpy as np
from PIL import Image, ImageOps
from typing import List

class FaceEngine:
    """Lightweight AI Biometric Engine (Haar Cascade). [cite: 2026-03-16]."""
    def __init__(self, base_path: str):
        c_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self._face_cascade = cv2.CascadeClassifier(c_path)

    def get_schema(self):
        return [
            {"id": "zoom", "label": "FACE_ZOOM (%)", "p": "100"},
            {"id": "shift", "label": "VERTICAL_PADDING", "p": "0"}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("BUFFER_EMPTY")
        
        zoom = max(10.0, float(lines[0] or 100)) / 100.0
        v_shift = int(lines[1] or 0)

        img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img_pil)
        faces = self._face_cascade.detectMultiScale(cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY), 1.1, 5)
        
        h, w = img_np.shape[:2]
        cx, cy = w // 2, h // 2
        if len(faces) > 0:
            (x, y, fw, fh) = faces[0]
            cx, cy = x + fw // 2, y + fh // 2

        target_ratio = 3/4
        bw, bh = (h * target_ratio, h) if w/h > target_ratio else (w, w / target_ratio)
        bw, bh = bw / zoom, bh / zoom
        
        cropped = img_pil.crop((max(0, cx-bw/2), max(0, cy-bh/2+v_shift), min(w, cx+bw/2), min(h, cy+bh/2+v_shift)))
        final = ImageOps.autocontrast(cropped, cutoff=0.5).resize((600, 800), Image.Resampling.LANCZOS)
        
        out = io.BytesIO()
        final.save(out, format="jpeg", quality=98)
        out.seek(0)
        return out