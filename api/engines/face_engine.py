import io
import numpy as np
import mediapipe as mp
from PIL import Image, ImageOps
from typing import List, Tuple

class FaceEngine:
    """Senior Biometric Engine: Face Detection + 3x4 Crop. [cite: 2026-03-15, 2026-02-21]."""
    __slots__ = ('_face_mesh',)

    def __init__(self, base_path: str):
        # Ініціалізація MediaPipe для швидкої детекції [cite: 2026-03-15]
        self._face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.5
        )

    def get_schema(self):
        return [
            {"id": "zoom", "label": "ZOOM_FACTOR (%)", "p": "100"},
            {"id": "shift", "label": "VERTICAL_SHIFT", "p": "0"},
            {"id": "info", "label": "BIOMETRIC_STATUS", "p": "AI-Detection Active. Output: 600x800."}
        ]

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("IMAGE_STREAM_EMPTY")
        
        zoom = float(lines[0] or 100) / 100.0
        v_shift = int(lines[1] or 0)

        # Конвертація байтів у PIL та OpenCV формат [cite: 2026-02-05]
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(img)
        h, w, _ = img_np.shape

        # Детекція обличчя [cite: 2026-03-15]
        results = self._face_mesh.process(img_np)
        
        # Центр кропу за замовчуванням (середина фото)
        center_x, center_y = w // 2, h // 2

        if results.multi_face_landmarks:
            # Беремо середню точку всіх знайдених точок обличчя [cite: 2026-03-15]
            landmarks = results.multi_face_landmarks[0].landmark
            xs = [lm.x * w for lm in landmarks]
            ys = [lm.y * h for lm in landmarks]
            center_x = int(sum(xs) / len(xs))
            center_y = int(sum(ys) / len(ys))

        # Розрахунок боксу 3х4 [cite: 2026-02-05]
        target_ratio = 3/4
        # Визначаємо базовий розмір боксу
        if w/h > target_ratio:
            box_h = h
            box_w = h * target_ratio
        else:
            box_w = w
            box_h = w / target_ratio

        # Застосування зуму та вертикального зміщення [cite: 2026-03-15]
        box_w /= zoom
        box_h /= zoom
        
        # Фінальні координати кропу
        left = center_x - (box_w / 2)
        top = center_y - (box_h / 2) + v_shift
        right = center_x + (box_w / 2)
        bottom = center_y + (box_h / 2) + v_shift

        # Senior Check: запобігання виходу за межі фото [cite: 2026-02-05]
        img_cropped = img.crop((max(0, left), max(0, top), min(w, right), min(h, bottom)))
        
        # Senior Post-Processing: авто-контраст та ресайз [cite: 2026-02-05]
        img_cropped = ImageOps.autocontrast(img_cropped, cutoff=0.5)
        img_final = img_cropped.resize((600, 800), Image.Resampling.LANCZOS)
        
        out = io.BytesIO()
        img_final.save(out, format="jpeg", quality=98, optimize=True)
        out.seek(0)
        return out