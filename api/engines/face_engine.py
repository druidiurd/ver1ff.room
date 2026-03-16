import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Final, List

# Ініціалізація MediaPipe один раз, щоб не жерти ресурси
mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(
    model_selection=1,  # 1 для фото далі 2 метрів, 0 для селфі
    min_detection_confidence=0.6
)

class FaceCropper:
    __slots__ = ['padding', 'target_ratio']

    def __init__(self, padding: float = 0.25, target_ratio: Optional[float] = 0.75):
        """
        :param padding: Відступ від обличчя (0.25 = 25%)
        :param target_ratio: Аспектне співвідношення (ширина/висота). 0.75 для 3:4.
        """
        self.padding: Final[float] = padding
        self.target_ratio: Final[Optional[float]] = target_ratio

    def _get_crop_coords(self, img_w: int, img_h: int, detection) -> Tuple[int, int, int, int]:
        bbox = detection.location_data.relative_bounding_box
        
        # Переводимо відносні координати в пікселі
        x = int(bbox.xmin * img_w)
        y = int(bbox.ymin * img_h)
        w = int(bbox.width * img_w)
        h = int(bbox.height * img_h)

        # Додаємо падінг
        pad_w = int(w * self.padding)
        pad_h = int(h * self.padding)

        x1 = max(0, x - pad_w)
        y1 = max(0, y - pad_h)
        x2 = min(img_w, x + w + pad_w)
        y2 = min(img_h, y + h + pad_h)

        return x1, y1, x2, y2

    def cut(self, image_path: Path, output_path: Path) -> bool:
        img = cv2.imread(str(image_path))
        if img is None:
            print(f"[X] Не вдалося прочитати: {image_path.name}")
            return False

        h_orig, w_orig = img.shape[:2]
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_detection.process(img_rgb)

        if not results.detections:
            print(f"[-] Лице не знайдено на {image_path.name}. Пропускаю.")
            return False

        # Беремо перше (найбільше) обличчя
        primary_face = results.detections[0]
        x1, y1, x2, y2 = self._get_crop_coords(w_orig, h_orig, primary_face)

        # Кропаємо через numpy slicing
        cropped = img[y1:y2, x1:x2]

        if cropped.size == 0:
            print(f"[X] Помилка розміру кропу для {image_path.name}")
            return False

        cv2.imwrite(str(output_path), cropped)
        return True

def main():
    base_dir = Path(__file__).parent
    input_dir = base_dir / "input_faces"
    output_dir = base_dir / "output_faces"
    
    input_dir.mkdir(exist_ok=True)
    output_dir.mkdir(exist_ok=True)

    cropper = FaceCropper(padding=0.3)  # Більше місця зверху під документи

    for img_file in input_dir.glob("*.jpg"):
        target = output_dir / f"CUT_{img_file.name}"
        if cropper.cut(img_file, target):
            print(f"[+] Сніфнув обличчя: {img_file.name}")

if __name__ == "__main__":
    main()