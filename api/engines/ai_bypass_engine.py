import io
import os
import base64
import httpx
import numpy as np
from PIL import Image, ImageFilter
from typing import List, Dict, Any

class AIBypassEngine:
    """Enterprise AI Stealth v2.0 (Forensic Evader + Batch Scan) [cite: 2026-02-05]."""
    __slots__ = ('base_path', 'profiles')

    def __init__(self, base_path: str):
        self.base_path = base_path
        self.profiles = {
            "PROFILE_1": (os.environ.get("SE_USER_1", "661088083"), os.environ.get("SE_SECRET_1", "vjoitWMLAvEyuu9CvBSwAyRfRUraBEL8")),
            "PROFILE_2": (os.environ.get("SE_USER_2", "YOUR_USER_2"), os.environ.get("SE_SECRET_2", "YOUR_SECRET_2")),
            "PROFILE_3": (os.environ.get("SE_USER_3", "YOUR_USER_3"), os.environ.get("SE_SECRET_3", "YOUR_SECRET_3"))
        }

    def get_schema(self) -> List[Dict[str, Any]]:
        return [
            {"id": "compress", "label": "JPEG_QUALITY (%)", "p": "72", "type": "range", "min": 10, "max": 100},
            {"id": "profile", "label": "SIGHTENGINE_NODE", "p": "PROFILE_1", "type": "select", "opts": ["PROFILE_1", "PROFILE_2", "PROFILE_3"]},
            {"id": "chroma", "label": "LENS_ABERRATION (PX)", "p": "0", "type": "range", "min": 0, "max": 5},
            {"id": "blur", "label": "MICRO_SOFTNESS", "p": "0", "type": "range", "min": 0, "max": 10},
            {"id": "noise", "label": "ISO_SENSOR_NOISE", "p": "0", "type": "range", "min": 0, "max": 25}
        ]

    async def _check_api(self, client: httpx.AsyncClient, img_bytes: bytes, user: str, secret: str) -> Dict[str, Any]:
        try:
            files = {'media': ('stealth.jpg', img_bytes, 'image/jpeg')}
            data = {'models': 'genai', 'api_user': user, 'api_secret': secret}
            resp = await client.post("https://api.sightengine.com/1.0/check.json", data=data, files=files)
            resp.raise_for_status()
            r = resp.json()
            if r.get("status") == "success":
                score = r.get("type", {}).get("ai_generated", 0.0)
                return {"status": "OK", "score": score}
            return {"status": r.get("error", {}).get("message", "API_ERR"), "score": 1.0}
        except Exception as e:
            return {"status": f"ERR: {str(e)}", "score": 1.0}

    def _apply_filters_and_compress(self, img: Image.Image, quality: int, chroma: int, blur: int, noise_lvl: int) -> bytes:
        """Нанесення апаратних дефектів перед стисненням [cite: 2026-02-21]."""
        
        # 1. Chromatic Aberration (Зсув каналів через numpy для швидкості)
        if chroma > 0:
            arr = np.array(img)
            arr[:, chroma:, 0] = arr[:, :-chroma, 0]  # Червоний вправо
            arr[:, :-chroma, 2] = arr[:, chroma:, 2]  # Синій вліво
            img = Image.fromarray(arr)

        # 2. Lens Softness (Мікро-блур)
        if blur > 0:
            img = img.filter(ImageFilter.GaussianBlur(blur / 10.0))

        # 3. ISO Noise (Гауссів шум)
        if noise_lvl > 0:
            arr = np.array(img)
            noise = np.random.normal(0, noise_lvl, arr.shape).astype('int16')
            arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
            img = Image.fromarray(arr)

        # 4. Compression (з субсемплінгом для вбивства кольорових артефактів)
        out = io.BytesIO()
        img.save(out, format="jpeg", quality=quality, subsampling=2)
        return out.getvalue()

    async def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, Any]:
        if not image_bytes: raise ValueError("ERR_NO_IMAGE_PAYLOAD")

        # Хардкорний парсинг з кастуванням, щоб уникнути помилок strip() [cite: 2026-03-16]
        quality = int(lines[0]) if len(lines) > 0 and str(lines[0]).strip() else 72
        prof_key = str(lines[1]).strip() if len(lines) > 1 and str(lines[1]).strip() else "PROFILE_1"
        chroma_lvl = int(lines[2]) if len(lines) > 2 and str(lines[2]).strip() else 0
        blur_lvl = int(lines[3]) if len(lines) > 3 and str(lines[3]).strip() else 0
        noise_lvl = int(lines[4]) if len(lines) > 4 and str(lines[4]).strip() else 0
        
        api_user, api_secret = self.profiles.get(prof_key, self.profiles["PROFILE_1"])

        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")

            # РЕЖИМ BATCH SCAN
            if scan:
                results = []
                best_score = 1.0
                best_q = 90
                best_bytes = None
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    for q in [90, 80, 70, 60]:
                        c_bytes = self._apply_filters_and_compress(img, q, chroma_lvl, blur_lvl, noise_lvl)
                        chk = await self._check_api(client, c_bytes, api_user, api_secret)
                        results.append({"quality": q, "score": chk["score"], "status": chk["status"]})
                        
                        if chk["score"] < best_score:
                            best_score = chk["score"]
                            best_q = q
                            best_bytes = c_bytes
                            
                if not best_bytes: best_bytes = self._apply_filters_and_compress(img, 90, chroma_lvl, blur_lvl, noise_lvl)
                return {
                    "TYPE": "ai_batch",
                    "RESULTS": results,
                    "BEST_Q": best_q,
                    "BEST_SCORE": f"{best_score * 100:.1f}%",
                    "IMAGE_BASE64": base64.b64encode(best_bytes).decode('utf-8')
                }

            # РЕЖИМ SINGLE CHECK
            c_bytes = self._apply_filters_and_compress(img, quality, chroma_lvl, blur_lvl, noise_lvl)
            async with httpx.AsyncClient(timeout=20.0) as client:
                chk = await self._check_api(client, c_bytes, api_user, api_secret)
            
            return {
                "TYPE": "ai_bypass",
                "STATUS": chk["status"],
                "AI_PROBABILITY": f"{chk['score'] * 100:.1f}%",
                "IMAGE_BASE64": base64.b64encode(c_bytes).decode('utf-8')
            }