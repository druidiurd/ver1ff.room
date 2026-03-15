import cv2
import numpy as np
import base64
import logging
from typing import Dict, Final

logger = logging.getLogger("VisionExtractor")

class FaceEngine:
    """Глобальний модуль: Екстрактор обличчя через OpenCV (Zero I/O overhead) [cite: 2026-02-05]."""
    __slots__ = ('_cascade', '_aspect_w', '_aspect_h', '_scale')

    def __init__(self, base_path: str):
        self._aspect_w: Final[float] = 3.0
        self._aspect_h: Final[float] = 4.0
        self._scale: Final[float] = 2.4
        
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml"
        self._cascade = cv2.CascadeClassifier(cascade_path)
        if self._cascade.empty():
            raise RuntimeError(f"HAAR Cascade не знайдено: {cascade_path}")

    def get_schema(self):
        # Порожня схема, бо UI кастомний (Drag&Drop)
        return []

    def render(self, image_b64: str, padding: int) -> Dict[str, str]:
        if not image_b64:
            return {"error": "NO_IMAGE_PAYLOAD"}

        try:
            # Парсинг Base64
            if "," in image_b64:
                image_b64 = image_b64.split(",")[1]
            
            img_data = base64.b64decode(image_b64)
            np_arr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if img is None:
                return {"error": "INVALID_IMAGE_BUFFER"}

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)

            faces = self._cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )

            if not len(faces):
                return {"error": "NO_FACE_DETECTED"}

            # Беремо перше обличчя
            x, y, w, h = faces[0]
            cx = x + w // 2
            cy = y + h // 2 + int(h * 0.15)

            base_h = int(h * self._scale)
            base_w = int(base_h * (self._aspect_w / self._aspect_h))

            # Динамічний паддінг від фронта [cite: 2026-02-05]
            target_w = max(w, base_w - (padding * 2))
            target_h = int(target_w * (self._aspect_h / self._aspect_w))

            x1 = cx - target_w // 2
            y1 = cy - target_h // 2

            pad_w, pad_h = target_w, target_h
            padded_img = cv2.copyMakeBorder(
                img, pad_h, pad_h, pad_w, pad_w, cv2.BORDER_REPLICATE
            )

            px1 = x1 + pad_w
            py1 = y1 + pad_h
            face_crop = padded_img[py1:py1+target_h, px1:px1+target_w]

            is_success, buffer = cv2.imencode('.jpg', face_crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
            if not is_success:
                return {"error": "ENCODING_FAILED"}

            res_b64 = base64.b64encode(buffer).decode('utf-8')
            return {"cropped": f"data:image/jpeg;base64,{res_b64}"}

        except Exception as e:
            return {"error": f"CV_CORE_CRASH: {str(e)}"}