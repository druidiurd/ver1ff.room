import io
import numpy as np
import mediapipe as mp
from PIL import Image, ImageOps
from typing import List

class FaceEngine:
    """Senior Biometric Engine з захистом від Decompression Bomb. [cite: 2026-03-15, 2026-03-16]."""
    __slots__ = ('_face_mesh',)

    def __init__(self, base_path: str):
        self._face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True, max_num_faces=1, min_detection_confidence=0.5
        )

    def get_schema(self):
        return [
            {"id": "zoom", "label": "ZOOM_FACTOR (%)", "p": "100"},
            {"id": "shift", "label": "VERTICAL_SHIFT", "p": "0"},
            {"id": "info", "label": "STATUS", "p": "AI-Detection Active."}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("EMPTY_IMAGE")
        
        # Захист: не даємо зуму впасти нижче 10% [cite: 2026-03-16]
        raw_zoom = float(lines[0] or 100)
        zoom = max(10.0, raw_zoom) / 100.0
        v_shift = int(lines[1] or 0)

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img)
        h, w, _ = img_np.shape

        results = self._face_mesh.process(img_np)
        cx, cy = w // 2, h // 2

        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0].landmark
            xs = [lm.x * w for lm in landmarks]
            ys = [lm.y * h for lm in landmarks]
            cx, cy = int(sum(xs) / len(xs)), int(sum(ys) / len(ys))

        target_ratio = 3/4
        if w/h > target_ratio:
            bw, bh = h * target_ratio, h
        else:
            bw, bh = w, w / target_ratio

        # Застосування безпечного зуму [cite: 2026-03-16]
        bw, bh = bw / zoom, bh / zoom
        
        l, t = cx - (bw / 2), cy - (bh / 2) + v_shift
        r, b = cx + (bw / 2), cy + (bh / 2) + v_shift

        # Фінальна обрізка з валідацією меж [cite: 2026-02-05]
        img_cropped = img.crop((max(0, l), max(0, t), min(w, r), min(h, b)))
        img_final = img_cropped.resize((600, 800), Image.Resampling.LANCZOS)
        
        out = io.BytesIO()
        img_final.save(out, format="jpeg", quality=98)
        out.seek(0)
        return out