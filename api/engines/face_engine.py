import io
import cv2
import numpy as np
from PIL import Image, ImageOps
from typing import List, Final, Tuple, Optional
from pathlib import Path

# --- Константи з твого еталонного коду [cite: 2026-02-21] ---
ASPECT_RATIO_W: Final[float] = 3.0
ASPECT_RATIO_H: Final[float] = 4.0
BASE_SCALE: Final[float] = 2.4  
PADDING_REDUCE: Final[int] = 20

class FaceEngine:
    """Enterprise Vision Extractor (Restored from Source). [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('_cascade',)

    def __init__(self, base_path: str):
        c_path = str(Path(cv2.data.haarcascades) / "haarcascade_frontalface_alt2.xml")
        self._cascade = cv2.CascadeClassifier(c_path)
        if self._cascade.empty():
            raise RuntimeError(f"CLASSIFIER_NOT_FOUND: {c_path}")

    def get_schema(self):
        return [
            {"id": "zoom", "label": "SCALE_MODIFIER (%)", "p": "100"},
            {"id": "shift", "label": "VERTICAL_SINK", "p": "15"}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("PAYLOAD_EMPTY")
        
        # Реактивні модифікатори [cite: 2026-02-05]
        ui_zoom = max(10.0, float(lines[0] or 100)) / 100.0
        ui_shift = int(lines[1] or 15) / 100.0 # Твій дефолт 0.15

        # Декодування матриці [cite: 2026-02-21]
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None: raise ValueError("BAD_IMAGE_HEADER")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        faces = self._cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        h_img, w_img = img.shape[:2]
        cx, cy = w_img // 2, h_img // 2
        fw, fh = w_img // 4, h_img // 4 # Fallback size

        if len(faces) > 0:
            (x, y, fw, fh) = faces[0]
            cx = x + fw // 2
            cy = y + fh // 2 + int(fh * ui_shift)

        # Твій алгоритм розрахунку бази [cite: 2026-02-21]
        base_h = int(fh * BASE_SCALE * ui_zoom)
        base_w = int(base_h * (ASPECT_RATIO_W / ASPECT_RATIO_H))
        
        target_w = max(fw, base_w - (PADDING_REDUCE * 2))
        target_h = int(target_w * (ASPECT_RATIO_H / ASPECT_RATIO_W))

        # Твоя логіка Padded Crop (copyMakeBorder) [cite: 2026-02-21]
        x1, y1 = cx - target_w // 2, cy - target_h // 2
        pad = max(target_w, target_h)
        
        padded_img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
        
        px1, py1 = x1 + pad, y1 + pad
        px2, py2 = px1 + target_w, py1 + target_h
        
        face_crop = padded_img[py1:py2, px1:px2]
        
        # Post-processing [cite: 2026-02-05]
        res_img = Image.fromarray(cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB))
        res_img = ImageOps.autocontrast(res_img, cutoff=0.5)
        res_img = res_img.resize((600, 800), Image.Resampling.LANCZOS)
        
        out = io.BytesIO()
        res_img.save(out, format="jpeg", quality=98, optimize=True)
        out.seek(0)
        return out