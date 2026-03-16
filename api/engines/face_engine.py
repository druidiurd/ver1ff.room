import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path
from typing import Final, Tuple, List, Optional
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class FaceEngine:
    """Senior-level engine for precise face extraction."""
    __slots__ = ['detector', 'padding']

    def __init__(self, model_path: str = "detector.tflite", min_confidence: float = 0.5):
        # Ініціалізація детектора через Tasks API
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceDetectorOptions(base_options=base_options)
        self.detector = vision.FaceDetector.create_from_options(options)
        self.padding: Final[float] = 0.25  # 25% запасу навколо пики

    def _calculate_bounds(self, bbox, img_w: int, img_h: int) -> Tuple[int, int, int, int]:
        """Розрахунок координат з урахуванням падінгів та кордонів кадру."""
        x, y, w, h = bbox.origin_x, bbox.origin_y, bbox.width, bbox.height
        
        pad_x = int(w * self.padding)
        pad_y = int(h * self.padding)

        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(img_w, x + w + pad_x)
        y2 = min(img_h, y + h + pad_y)
        
        return x1, y1, x2, y2

    def process_image(self, input_path: Path, output_path: Path) -> bool:
        # Читаємо через OpenCV (numpy array)
        image = cv2.imread(str(input_path))
        if image is None:
            return False

        h, w = image.shape[:2]
        
        # Конвертуємо для MediaPipe
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        
        # Детекція
        detection_result = self.detector.detect(mp_image)

        if not detection_result.detections:
            print(f"[-] Face not found: {input_path.name}")
            return False

        # Беремо перший бокс (найбільший пріоритет)
        bbox = detection_result.detections[0].bounding_box
        x1, y1, x2, y2 = self._calculate_bounds(bbox, w, h)

        # Hardcore slicing через numpy
        face_crop = image[y1:y2, x1:x2]

        if face_crop.size == 0:
            return False

        cv2.imwrite(str(output_path), face_crop)
        return True

def run_cleanup():
    # Налаштування шляхів під Windows 11
    workspace = Path(__file__).parent
    in_dir = workspace / "input_faces"
    out_dir = workspace / "output_faces"
    
    in_dir.mkdir(exist_ok=True)
    out_dir.mkdir(exist_ok=True)

    # Якщо немає моделі, MediaPipe може юзати дефолтну, але краще підкинути .tflite
    # Для швидкого старту можна юзати старий медіапайп детекшн (див. нижче)
    try:
        engine = FaceEngine()
        for img_path in in_dir.glob("*.jpg"):
            target = out_dir / f"STRICT_CUT_{img_path.name}"
            if engine.process_image(img_path, target):
                print(f"[+] Grepped: {img_path.name}")
    except Exception as e:
        print(f"[!] Engine error: {e}. Check if detector.tflite exists.")

if __name__ == "__main__":
    run_cleanup()