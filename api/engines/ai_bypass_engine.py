import io
import os
import base64
import httpx
import numpy as np
import piexif
import datetime
from PIL import Image, ImageFilter, ImageEnhance
from typing import List, Dict, Any


class AIBypassEngine:
    """Enterprise AI Stealth v4.0 — физически правдоподобная имитация camera pipeline."""
    __slots__ = ('base_path', 'profiles', '_sensor_pattern')

    def __init__(self, base_path: str):
        self.base_path = base_path
        self.profiles = {
            f"PROFILE_{i}": (
                os.environ.get(f"SE_USER_{i}", ""),
                os.environ.get(f"SE_SECRET_{i}", "")
            )
            for i in range(1, 11)
        }
        # Фиксированный паттерн сенсора — одинаковый для "одной камеры"
        rng = np.random.default_rng(seed=42)
        self._sensor_pattern = rng.standard_normal((1, 1, 3)).astype('float32') * 0.5

    def get_schema(self) -> List[Dict[str, Any]]:
        return [
            {"id": "quality",   "label": "JPEG_QUALITY (%)",       "p": "78",       "type": "range",  "min": 40,  "max": 95},
            {"id": "profile",   "label": "SIGHTENGINE_START_NODE", "p": "PROFILE_1","type": "select", "opts": [f"PROFILE_{i}" for i in range(1, 11)]},
            {"id": "chroma",    "label": "RADIAL_ABERRATION",       "p": "2",        "type": "range",  "min": 0,   "max": 8},
            {"id": "noise",     "label": "SENSOR_NOISE_ISO",        "p": "3",        "type": "range",  "min": 0,   "max": 20},
            {"id": "resize",    "label": "FREQ_BREAK (0=off)",      "p": "2",        "type": "range",  "min": 0,   "max": 5},
        ]

    def _get_fake_exif(self) -> bytes:
        dt_str = datetime.datetime.now().strftime("%Y:%m:%d %H:%M:%S")
        exif_dict = {
            "0th": {
                piexif.ImageIFD.Make:     b"Apple",
                piexif.ImageIFD.Model:    b"iPhone 13 Pro",
                piexif.ImageIFD.Software: b"16.4.1",
                piexif.ImageIFD.DateTime: dt_str.encode('ascii'),
                piexif.ImageIFD.XResolution: (72, 1),
                piexif.ImageIFD.YResolution: (72, 1),
            },
            "Exif": {
                piexif.ExifIFD.DateTimeOriginal:  dt_str.encode('ascii'),
                piexif.ExifIFD.DateTimeDigitized: dt_str.encode('ascii'),
                piexif.ExifIFD.LensModel:         b"iPhone 13 Pro back triple camera 26mm f/1.5",
                piexif.ExifIFD.ISOSpeedRatings:   320,
                piexif.ExifIFD.ExposureTime:      (1, 120),
                piexif.ExifIFD.FNumber:           (3, 2),
                piexif.ExifIFD.ColorSpace:        1,
                piexif.ExifIFD.PixelXDimension:   4032,
                piexif.ExifIFD.PixelYDimension:   3024,
                piexif.ExifIFD.SceneType:         b'\x01',
            }
        }
        return piexif.dump(exif_dict)

    def _radial_chromatic_aberration(self, img: Image.Image, strength: float) -> Image.Image:
        """Физически правдоподобная радиальная аберрация: R увеличен, B уменьшен."""
        if strength <= 0:
            return img
        arr = np.array(img, dtype='float32')
        h, w = arr.shape[:2]
        cx, cy = w / 2, h / 2

        # Нормализованные координаты от центра
        xs = (np.arange(w) - cx) / cx  # [-1..1]
        ys = (np.arange(h) - cy) / cy
        xx, yy = np.meshgrid(xs, ys)
        r = np.sqrt(xx**2 + yy**2)     # радиальное расстояние

        # Масштаб = 1 + strength * r^2 (barrel distortion для R, pincushion для B)
        scale_r = 1.0 + strength * 0.01 * r**2
        scale_b = 1.0 - strength * 0.008 * r**2

        def remap_channel(channel: np.ndarray, scale: np.ndarray) -> np.ndarray:
            from scipy.ndimage import map_coordinates
            src_x = cx + (np.arange(w) - cx) / scale
            src_y = cy + (np.arange(h) - cy) / scale
            gx, gy = np.meshgrid(src_x[0] if src_x.ndim > 1 else src_x,
                                  src_y[:, 0] if src_y.ndim > 1 else src_y)
            # Простая аппроксимация: сдвиг пропорциональный r
            shift_map_x = cx + (xx * cx / scale)
            shift_map_y = cy + (yy * cy / scale)
            coords = [shift_map_y.ravel(), shift_map_x.ravel()]
            return map_coordinates(channel, coords, order=1, mode='reflect').reshape(h, w)

        try:
            from scipy.ndimage import map_coordinates
            out = arr.copy()
            out[:, :, 0] = remap_channel(arr[:, :, 0], scale_r)
            out[:, :, 2] = remap_channel(arr[:, :, 2], scale_b)
            return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))
        except ImportError:
            # Fallback без scipy — простой сдвиг каналов
            s = max(1, int(strength))
            a = arr.copy()
            a[:, s:, 0] = arr[:, :-s, 0]
            a[:, :-s, 2] = arr[:, s:, 2]
            return Image.fromarray(np.clip(a, 0, 255).astype('uint8'))

    def _camera_sensor_noise(self, arr: np.ndarray, iso: float) -> np.ndarray:
        """PRNU-like шум: коррелированный по каналам паттерн конкретного сенсора."""
        if iso <= 0:
            return arr
        h, w = arr.shape[:2]
        # Случайный шум + фиксированный паттерн сенсора
        random_noise = np.random.normal(0, iso * 0.5, (h, w, 3)).astype('float32')
        # Масштабируем паттерн сенсора под размер изображения
        sensor = np.tile(self._sensor_pattern, (h, w, 1)) * iso * 0.3
        # Шум сильнее в тёмных зонах (как у реального сенсора)
        luminance = arr.mean(axis=2, keepdims=True) / 255.0
        noise_mask = 1.0 - luminance * 0.6
        combined = (random_noise + sensor) * noise_mask
        return np.clip(arr.astype('float32') + combined, 0, 255).astype('uint8')

    def _resize_frequency_break(self, img: Image.Image, level: int) -> Image.Image:
        """Downscale → upscale ломает периодические паттерны AI в frequency domain."""
        if level <= 0:
            return img
        w, h = img.size
        factor = 1.0 - level * 0.01  # 0.99 – 0.95
        tw, th = max(32, int(w * factor)), max(32, int(h * factor))
        img = img.resize((tw, th), Image.LANCZOS)
        return img.resize((w, h), Image.BICUBIC)

    def _double_jpeg_compress(self, arr: np.ndarray, final_quality: int) -> bytes:
        """Двойное JPEG сжатие — создаёт DCT distribution реального телефонного фото."""
        img = Image.fromarray(arr)
        # Первый проход — имитация camera internal JPEG
        buf1 = io.BytesIO()
        img.save(buf1, format='jpeg', quality=75, subsampling=2)
        buf1.seek(0)
        img2 = Image.open(buf1)
        img2.load()
        # Второй проход — финальное сжатие с EXIF
        buf2 = io.BytesIO()
        img2.save(buf2, format='jpeg', quality=final_quality, subsampling=2,
                  exif=self._get_fake_exif())
        return buf2.getvalue()

    def _in_camera_sharpen(self, img: Image.Image) -> Image.Image:
        """Лёгкий unsharp mask — имитирует camera processing pipeline."""
        return img.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=3))

    def _apply_pipeline(self, img: Image.Image, quality: int, chroma: int,
                        noise_iso: int, resize_level: int) -> bytes:
        # 1. Радиальная хроматическая аберрация
        img = self._radial_chromatic_aberration(img, chroma)

        # 2. Resize frequency break
        img = self._resize_frequency_break(img, resize_level)

        # 3. In-camera sharpening
        img = self._in_camera_sharpen(img)

        # 4. Camera sensor noise
        arr = self._camera_sensor_noise(np.array(img), noise_iso)

        # 5. Двойное JPEG с EXIF
        return self._double_jpeg_compress(arr, quality)

    async def _robust_check_api(self, client: httpx.AsyncClient, img_bytes: bytes,
                                 start_prof_key: str) -> Dict[str, Any]:
        keys = list(self.profiles.keys())
        start_idx = keys.index(start_prof_key) if start_prof_key in keys else 0
        ordered_keys = keys[start_idx:] + keys[:start_idx]

        last_err = "API_ERR"
        for k in ordered_keys:
            user, secret = self.profiles[k]
            if not user or not secret:
                continue
            try:
                files = {'media': ('photo.jpg', img_bytes, 'image/jpeg')}
                data = {'models': 'genai', 'api_user': user, 'api_secret': secret}
                resp = await client.post("https://api.sightengine.com/1.0/check.json",
                                         data=data, files=files)
                r = resp.json()
                if r.get("status") == "success":
                    score = r.get("type", {}).get("ai_generated", 0.0)
                    return {"status": "OK", "score": score, "used_profile": k}
                else:
                    last_err = r.get("error", {}).get("message", "NODE_DRY")
                    continue
            except Exception as e:
                last_err = str(e)
                continue

        return {"status": f"ALL_NODES_DEAD: {last_err}", "score": 1.0, "used_profile": "NONE"}

    async def render(self, lines: List[str], scan: bool = False,
                     image_bytes: bytes = None) -> Dict[str, Any]:
        if not image_bytes:
            raise ValueError("ERR_NO_IMAGE_PAYLOAD")

        def _p(idx: int, default: int) -> int:
            try:
                v = lines[idx] if idx < len(lines) else ''
                return int(str(v).strip()) if str(v).strip() else default
            except (ValueError, TypeError):
                return default

        quality      = _p(0, 78)
        start_node   = str(lines[1]).strip() if len(lines) > 1 and str(lines[1]).strip() else "PROFILE_1"
        chroma       = _p(2, 2)
        noise_iso    = _p(3, 3)
        resize_level = _p(4, 2)

        with Image.open(io.BytesIO(image_bytes)) as src:
            img = src.convert("RGB")

            if scan:
                # AUTO_COMPRESS: перебираем комбинации quality + noise
                results = []
                best_score = 1.0
                best_bytes = None
                best_q = quality
                best_node = "NONE"

                async with httpx.AsyncClient(timeout=60.0) as client:
                    for q in [85, 78, 70, 60]:
                        c_bytes = self._apply_pipeline(img, q, chroma, noise_iso, resize_level)
                        chk = await self._robust_check_api(client, c_bytes, start_node)
                        results.append({
                            "quality": q,
                            "score": chk["score"],
                            "status": chk["status"]
                        })
                        if chk["score"] < best_score:
                            best_score = chk["score"]
                            best_q = q
                            best_bytes = c_bytes
                            best_node = chk["used_profile"]

                if not best_bytes:
                    best_bytes = self._apply_pipeline(img, quality, chroma, noise_iso, resize_level)

                return {
                    "TYPE":         "ai_batch",
                    "RESULTS":      results,
                    "BEST_Q":       best_q,
                    "BEST_SCORE":   f"{best_score * 100:.1f}%",
                    "USED_PROFILE": best_node,
                    "IMAGE_BASE64": base64.b64encode(best_bytes).decode('utf-8'),
                }

            c_bytes = self._apply_pipeline(img, quality, chroma, noise_iso, resize_level)
            async with httpx.AsyncClient(timeout=20.0) as client:
                chk = await self._robust_check_api(client, c_bytes, start_node)

            return {
                "TYPE":           "ai_bypass",
                "STATUS":         chk["status"],
                "USED_PROFILE":   chk["used_profile"],
                "AI_PROBABILITY": f"{chk['score'] * 100:.1f}%",
                "IMAGE_BASE64":   base64.b64encode(c_bytes).decode('utf-8'),
            }
