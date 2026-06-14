import io
import os
import base64
import httpx
import numpy as np
import piexif
import datetime
from PIL import Image, ImageFilter
from typing import List, Dict, Any, Optional

try:
    import cv2 as _cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False


class AIBypassEngine:
    """AI Stealth v5.0 — multi-preset camera pipeline emulator."""
    __slots__ = ('base_path', 'profiles', '_sensor_pattern')

    PRESET_DESC = {
        'LITE':    'Minimal: adaptive blur + monochrome noise only. Fast, low distortion. Good against simple classifiers.',
        'STANDARD':'Full camera emulation: radial aberration + PRNU noise + freq break + double JPEG + EXIF. Default.',
        'GHOST':   'Signal-level only: adaptive photon noise + INTER_AREA/LANCZOS4 destructive resample + double-shift JPEG. No EXIF. Maximum DCT disruption.',
        'MAX':     'All techniques combined: GHOST + STANDARD. Heaviest processing, highest bypass rate.',
        'DENOISE': 'NLM denoising (Non-local Means via OpenCV). Standalone cleanup / post-process mode.',
    }

    def __init__(self, base_path: str):
        self.base_path = base_path
        self.profiles = {
            f"PROFILE_{i}": (
                os.environ.get(f"SE_USER_{i}", ""),
                os.environ.get(f"SE_SECRET_{i}", "")
            )
            for i in range(1, 11)
        }
        rng = np.random.default_rng(seed=42)
        self._sensor_pattern = rng.standard_normal((1, 1, 3)).astype('float32') * 0.5

    def get_schema(self) -> List[Dict[str, Any]]:
        return [
            {"id": "preset",  "label": "PIPELINE_PRESET",      "p": "STANDARD",  "type": "select",
             "opts": ["LITE", "STANDARD", "GHOST", "MAX", "DENOISE"],
             "desc": " | ".join(f"[{k}] {v}" for k, v in self.PRESET_DESC.items())},
            {"id": "quality", "label": "JPEG_QUALITY (%)",      "p": "78",        "type": "range", "min": 40, "max": 95,
             "desc": "Final JPEG quality. Lower = more compression artifacts. 78 is the sweet spot. Ignored in DENOISE preset."},
            {"id": "profile", "label": "SIGHTENGINE_NODE",      "p": "PROFILE_1", "type": "select",
             "opts": [f"PROFILE_{i}" for i in range(1, 11)],
             "desc": "SightEngine API profile. Profiles use SE_USER_N / SE_SECRET_N env vars."},
            {"id": "chroma",  "label": "RADIAL_ABERRATION",     "p": "2",         "type": "range", "min": 0, "max": 8,
             "desc": "Chromatic aberration strength. 0=off, 2–4=subtle, 8=heavy. Used in STANDARD and MAX."},
            {"id": "noise",   "label": "SENSOR_NOISE_ISO",      "p": "3",         "type": "range", "min": 0, "max": 20,
             "desc": "Sensor noise intensity. Used in all presets. In GHOST/MAX: adaptive photon noise. In STANDARD: PRNU pattern."},
            {"id": "resize",  "label": "FREQ_BREAK_PASSES",     "p": "2",         "type": "range", "min": 0, "max": 5,
             "desc": "Destructive resample passes. In STANDARD: gentle freq break. In GHOST/MAX: INTER_AREA→LANCZOS4 (harder)."},
        ]

    # ── EXIF ────────────────────────────────────────────────────────────
    def _get_fake_exif(self) -> bytes:
        dt_str = datetime.datetime.now().strftime("%Y:%m:%d %H:%M:%S")
        exif_dict = {
            "0th": {
                piexif.ImageIFD.Make:        b"Apple",
                piexif.ImageIFD.Model:       b"iPhone 13 Pro",
                piexif.ImageIFD.Software:    b"16.4.1",
                piexif.ImageIFD.DateTime:    dt_str.encode('ascii'),
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

    # ── STANDARD pipeline steps ─────────────────────────────────────────
    def _radial_chromatic_aberration(self, img: Image.Image, strength: float) -> Image.Image:
        if strength <= 0:
            return img
        arr = np.array(img, dtype='float32')
        h, w = arr.shape[:2]
        cx, cy = w / 2, h / 2
        xs = (np.arange(w) - cx) / cx
        ys = (np.arange(h) - cy) / cy
        xx, yy = np.meshgrid(xs, ys)
        scale_r = 1.0 + strength * 0.01 * (xx**2 + yy**2)
        scale_b = 1.0 - strength * 0.008 * (xx**2 + yy**2)

        def remap(ch: np.ndarray, scale: np.ndarray) -> np.ndarray:
            shift_x = cx + (xx * cx / scale)
            shift_y = cy + (yy * cy / scale)
            from scipy.ndimage import map_coordinates
            return map_coordinates(ch, [shift_y.ravel(), shift_x.ravel()],
                                   order=1, mode='reflect').reshape(h, w)

        try:
            out = arr.copy()
            out[:, :, 0] = remap(arr[:, :, 0], scale_r)
            out[:, :, 2] = remap(arr[:, :, 2], scale_b)
            return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))
        except ImportError:
            s = max(1, int(strength))
            a = arr.copy()
            a[:, s:, 0] = arr[:, :-s, 0]
            a[:, :-s, 2] = arr[:, s:, 2]
            return Image.fromarray(np.clip(a, 0, 255).astype('uint8'))

    def _prnu_sensor_noise(self, arr: np.ndarray, iso: float) -> np.ndarray:
        if iso <= 0:
            return arr
        h, w = arr.shape[:2]
        random_noise = np.random.normal(0, iso * 0.5, (h, w, 3)).astype('float32')
        sensor = np.tile(self._sensor_pattern, (h, w, 1)) * iso * 0.3
        luminance = arr.mean(axis=2, keepdims=True) / 255.0
        noise_mask = 1.0 - luminance * 0.6
        return np.clip(arr.astype('float32') + (random_noise + sensor) * noise_mask, 0, 255).astype('uint8')

    def _freq_break(self, img: Image.Image, level: int) -> Image.Image:
        if level <= 0:
            return img
        w, h = img.size
        factor = 1.0 - level * 0.01
        tw, th = max(32, int(w * factor)), max(32, int(h * factor))
        img = img.resize((tw, th), Image.LANCZOS)
        return img.resize((w, h), Image.BICUBIC)

    def _in_camera_sharpen(self, img: Image.Image) -> Image.Image:
        return img.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=3))

    def _double_jpeg(self, arr: np.ndarray, final_quality: int, exif: Optional[bytes] = None) -> bytes:
        img = Image.fromarray(arr)
        buf1 = io.BytesIO()
        img.save(buf1, format='jpeg', quality=75, subsampling=2)
        buf1.seek(0)
        img2 = Image.open(buf1)
        img2.load()
        buf2 = io.BytesIO()
        kwargs: Dict[str, Any] = {'format': 'jpeg', 'quality': final_quality, 'subsampling': 2}
        if exif:
            kwargs['exif'] = exif
        img2.save(buf2, **kwargs)
        return buf2.getvalue()

    # ── GHOST pipeline steps ────────────────────────────────────────────
    def _adaptive_photon_noise(self, arr: np.ndarray, strength: float) -> np.ndarray:
        """Luminance-weighted monochrome noise: more noise in bright zones (photon shot noise)."""
        if strength <= 0:
            return arr
        h, w = arr.shape[:2]
        noise_mono = np.random.normal(0, strength * 0.5, (h, w, 1)).astype('float32')
        noise_rgb = np.repeat(noise_mono, 3, axis=2)
        intensity = arr.astype('float32') / 255.0
        noisy = arr.astype('float32') + noise_rgb * (intensity + 0.15)
        return np.clip(noisy, 0, 255).astype('uint8')

    def _destructive_resample(self, img: Image.Image, passes: int) -> Image.Image:
        """INTER_AREA equivalent (BOX filter) → LANCZOS4: physically destroys GAN upscale signatures."""
        if passes <= 0:
            return img
        w, h = img.size
        for _ in range(passes):
            sw, sh = max(32, int(w * 0.89)), max(32, int(h * 0.89))
            img = img.resize((sw, sh), Image.Resampling.BOX)
            img = img.resize((w, h), Image.Resampling.LANCZOS)
        return img

    def _double_shift_jpeg(self, arr: np.ndarray, q_mid: int = 96, q_final: int = 87,
                           exif: Optional[bytes] = None) -> bytes:
        """Pixel shift 4px before each JPEG encode: desynchronizes DCT grid alignment."""
        shift = 4
        # Pass A: shift left-up, pad right-down
        s1 = np.pad(arr[shift:, shift:], ((0, shift), (0, shift), (0, 0)), mode='edge')
        buf1 = io.BytesIO()
        Image.fromarray(s1).save(buf1, 'JPEG', quality=q_mid)
        buf1.seek(0)
        temp = np.array(Image.open(buf1))
        # Pass B: shift right-down, pad left-up (compensate)
        s2 = np.pad(temp[:-shift, :-shift], ((shift, 0), (shift, 0), (0, 0)), mode='edge')
        buf2 = io.BytesIO()
        kwargs: Dict[str, Any] = {'format': 'JPEG', 'quality': q_final}
        if exif:
            kwargs['exif'] = exif
        Image.fromarray(s2).save(buf2, **kwargs)
        return buf2.getvalue()

    # ── DENOISE step ────────────────────────────────────────────────────
    def _nlm_denoise(self, arr: np.ndarray, h_lum: int = 10, h_col: int = 10) -> np.ndarray:
        """Non-local Means denoising (cv2). Fallback: PIL GaussianBlur."""
        if _HAS_CV2:
            bgr = _cv2.cvtColor(arr, _cv2.COLOR_RGB2BGR)
            cleaned = _cv2.fastNlMeansDenoisingColored(bgr, None,
                h=h_lum, hColor=h_col, templateWindowSize=7, searchWindowSize=21)
            return _cv2.cvtColor(cleaned, _cv2.COLOR_BGR2RGB)
        # Fallback: Gaussian blur approximation (much weaker)
        img = Image.fromarray(arr)
        img = img.filter(ImageFilter.GaussianBlur(radius=1.2))
        return np.array(img)

    # ── Pipeline presets ────────────────────────────────────────────────
    def _pipeline_lite(self, img: Image.Image, quality: int, noise_iso: int) -> bytes:
        arr = np.array(img)
        arr = self._adaptive_photon_noise(arr, noise_iso)
        return self._double_jpeg(arr, quality)

    def _pipeline_standard(self, img: Image.Image, quality: int, chroma: int,
                            noise_iso: int, resize_level: int) -> bytes:
        img = self._radial_chromatic_aberration(img, chroma)
        img = self._freq_break(img, resize_level)
        img = self._in_camera_sharpen(img)
        arr = self._prnu_sensor_noise(np.array(img), noise_iso)
        return self._double_jpeg(arr, quality, exif=self._get_fake_exif())

    def _pipeline_ghost(self, img: Image.Image, quality: int,
                        noise_iso: int, resize_level: int) -> bytes:
        arr = self._adaptive_photon_noise(np.array(img), noise_iso)
        img2 = self._destructive_resample(Image.fromarray(arr), max(1, resize_level))
        return self._double_shift_jpeg(np.array(img2), q_mid=96, q_final=max(40, quality - 9))

    def _pipeline_max(self, img: Image.Image, quality: int, chroma: int,
                      noise_iso: int, resize_level: int) -> bytes:
        img = self._radial_chromatic_aberration(img, chroma)
        arr = self._adaptive_photon_noise(np.array(img), noise_iso)
        arr = self._prnu_sensor_noise(arr, noise_iso * 0.5)
        img2 = self._destructive_resample(Image.fromarray(arr), max(1, resize_level))
        img2 = self._in_camera_sharpen(img2)
        return self._double_shift_jpeg(np.array(img2), q_mid=96, q_final=quality,
                                       exif=self._get_fake_exif())

    def _pipeline_denoise(self, img: Image.Image, quality: int) -> bytes:
        arr = self._nlm_denoise(np.array(img))
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, 'JPEG', quality=quality, exif=self._get_fake_exif())
        return buf.getvalue()

    def _apply_preset(self, img: Image.Image, preset: str,
                      quality: int, chroma: int, noise_iso: int, resize_level: int) -> bytes:
        if preset == 'LITE':
            return self._pipeline_lite(img, quality, noise_iso)
        if preset == 'GHOST':
            return self._pipeline_ghost(img, quality, noise_iso, resize_level)
        if preset == 'MAX':
            return self._pipeline_max(img, quality, chroma, noise_iso, resize_level)
        if preset == 'DENOISE':
            return self._pipeline_denoise(img, quality)
        # STANDARD (default)
        return self._pipeline_standard(img, quality, chroma, noise_iso, resize_level)

    # ── SightEngine check ───────────────────────────────────────────────
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
                last_err = r.get("error", {}).get("message", "NODE_DRY")
            except Exception as e:
                last_err = str(e)
        return {"status": f"ALL_NODES_DEAD: {last_err}", "score": 1.0, "used_profile": "NONE"}

    # ── Main entry ──────────────────────────────────────────────────────
    async def render(self, lines: List[str], scan: bool = False,
                     image_bytes: bytes = None) -> Dict[str, Any]:
        if not image_bytes:
            raise ValueError("ERR_NO_IMAGE_PAYLOAD")

        def _s(idx: int, default: str = '') -> str:
            return str(lines[idx]).strip() if idx < len(lines) and str(lines[idx]).strip() else default

        def _i(idx: int, default: int) -> int:
            try:
                return int(_s(idx, str(default)))
            except (ValueError, TypeError):
                return default

        preset       = _s(0, 'STANDARD').upper()
        quality      = _i(1, 78)
        start_node   = _s(2, 'PROFILE_1')
        chroma       = _i(3, 2)
        noise_iso    = _i(4, 3)
        resize_level = _i(5, 2)

        with Image.open(io.BytesIO(image_bytes)) as src:
            img = src.convert("RGB")

            if scan:
                results = []
                best_score = 1.0
                best_bytes: Optional[bytes] = None
                best_q = quality
                best_node = "NONE"

                async with httpx.AsyncClient(timeout=60.0) as client:
                    for q in [85, 78, 70, 60]:
                        c_bytes = self._apply_preset(img, preset, q, chroma, noise_iso, resize_level)
                        chk = await self._robust_check_api(client, c_bytes, start_node)
                        results.append({"quality": q, "score": chk["score"], "status": chk["status"]})
                        if chk["score"] < best_score:
                            best_score = chk["score"]
                            best_q = q
                            best_bytes = c_bytes
                            best_node = chk["used_profile"]

                if not best_bytes:
                    best_bytes = self._apply_preset(img, preset, quality, chroma, noise_iso, resize_level)

                return {
                    "TYPE":         "ai_batch",
                    "PRESET":       preset,
                    "RESULTS":      results,
                    "BEST_Q":       best_q,
                    "BEST_SCORE":   f"{best_score * 100:.1f}%",
                    "USED_PROFILE": best_node,
                    "IMAGE_BASE64": base64.b64encode(best_bytes).decode('utf-8'),
                }

            c_bytes = self._apply_preset(img, preset, quality, chroma, noise_iso, resize_level)
            async with httpx.AsyncClient(timeout=20.0) as client:
                chk = await self._robust_check_api(client, c_bytes, start_node)

            return {
                "TYPE":           "ai_bypass",
                "PRESET":         preset,
                "STATUS":         chk["status"],
                "USED_PROFILE":   chk["used_profile"],
                "AI_PROBABILITY": f"{chk['score'] * 100:.1f}%",
                "IMAGE_BASE64":   base64.b64encode(c_bytes).decode('utf-8'),
            }
