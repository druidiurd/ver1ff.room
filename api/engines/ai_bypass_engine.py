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
    """Enterprise AI Stealth v3.0 (10-Node Failover + iPhone EXIF Spoofing)."""
    __slots__ = ('base_path', 'profiles')

    def __init__(self, base_path: str):
        self.base_path = base_path
        # 10 Бойових Вузлів. Впиши свої ключі в .env
        self.profiles = {f"PROFILE_{i}": (os.environ.get(f"SE_USER_{i}", ""), os.environ.get(f"SE_SECRET_{i}", "")) for i in range(1, 11)}

    def get_schema(self) -> List[Dict[str, Any]]:
        return [
            {"id": "compress", "label": "JPEG_QUALITY (%)", "p": "72", "type": "range", "min": 10, "max": 100},
            {"id": "profile", "label": "SIGHTENGINE_START_NODE", "p": "PROFILE_1", "type": "select", "opts": [f"PROFILE_{i}" for i in range(1, 11)]},
            {"id": "chroma", "label": "LENS_ABERRATION (PX)", "p": "0", "type": "range", "min": 0, "max": 5},
            {"id": "blur", "label": "MICRO_SOFTNESS", "p": "0", "type": "range", "min": 0, "max": 10},
            {"id": "noise", "label": "ISO_SENSOR_NOISE", "p": "0", "type": "range", "min": 0, "max": 25}
        ]

    def _get_fake_exif(self) -> bytes:
        """Створює фейковий дамп від iPhone 13 Pro для обходу Forensic аналізаторів."""
        dt_str = datetime.datetime.now().strftime("%Y:%m:%d %H:%M:%S")
        exif_dict = {
            "0th": {
                piexif.ImageIFD.Make: b"Apple",
                piexif.ImageIFD.Model: b"iPhone 13 Pro",
                piexif.ImageIFD.Software: b"16.4.1",
                piexif.ImageIFD.DateTime: dt_str.encode('ascii')
            },
            "Exif": {
                piexif.ExifIFD.DateTimeOriginal: dt_str.encode('ascii'),
                piexif.ExifIFD.DateTimeDigitized: dt_str.encode('ascii'),
                piexif.ExifIFD.LensModel: b"iPhone 13 Pro back dual camera 26mm f/1.5",
                piexif.ExifIFD.ISOSpeedRatings: 320,
                piexif.ExifIFD.ColorSpace: 1,
            }
        }
        return piexif.dump(exif_dict)

    async def _robust_check_api(self, client: httpx.AsyncClient, img_bytes: bytes, start_prof_key: str) -> Dict[str, Any]:
        """Senior Failover: Стукає у вузли по черзі, поки не отримає 200 OK."""
        keys = list(self.profiles.keys())
        start_idx = keys.index(start_prof_key) if start_prof_key in keys else 0
        ordered_keys = keys[start_idx:] + keys[:start_idx]

        last_err = "API_ERR"
        for k in ordered_keys:
            user, secret = self.profiles[k]
            if not user or not secret:
                continue # Скіпаємо порожні ключі
            
            try:
                files = {'media': ('stealth.jpg', img_bytes, 'image/jpeg')}
                data = {'models': 'genai', 'api_user': user, 'api_secret': secret}
                resp = await client.post("https://api.sightengine.com/1.0/check.json", data=data, files=files)
                r = resp.json()
                
                if r.get("status") == "success":
                    score = r.get("type", {}).get("ai_generated", 0.0)
                    return {"status": "OK", "score": score, "used_profile": k}
                else:
                    last_err = r.get("error", {}).get("message", "NODE_DRY")
                    print(f"[FAILOVER] {k} failed ({last_err}). Routing to next...")
                    continue
            except Exception as e:
                last_err = str(e)
                continue
                
        return {"status": f"ALL_NODES_DEAD: {last_err}", "score": 1.0, "used_profile": "NONE"}

    def _apply_filters_and_compress(self, img: Image.Image, quality: int, chroma: int, blur: int, noise_lvl: int) -> bytes:
        if chroma > 0:
            arr = np.array(img)
            arr[:, chroma:, 0] = arr[:, :-chroma, 0]
            arr[:, :-chroma, 2] = arr[:, chroma:, 2]
            img = Image.fromarray(arr)
        if blur > 0:
            img = img.filter(ImageFilter.GaussianBlur(blur / 10.0))
        if noise_lvl > 0:
            arr = np.array(img)
            noise = np.random.normal(0, noise_lvl, arr.shape).astype('int16')
            arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
            img = Image.fromarray(arr)
            
        out = io.BytesIO()
        # Ін'єкція фейкового EXIF
        fake_exif = self._get_fake_exif()
        img.save(out, format="jpeg", quality=quality, subsampling=2, exif=fake_exif)
        return out.getvalue()

    async def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, Any]:
        if not image_bytes: raise ValueError("ERR_NO_IMAGE_PAYLOAD")

        quality = int(lines[0]) if len(lines) > 0 and str(lines[0]).strip() else 72
        start_node = str(lines[1]).strip() if len(lines) > 1 and str(lines[1]).strip() else "PROFILE_1"
        chroma_lvl = int(lines[2]) if len(lines) > 2 and str(lines[2]).strip() else 0
        blur_lvl = int(lines[3]) if len(lines) > 3 and str(lines[3]).strip() else 0
        noise_lvl = int(lines[4]) if len(lines) > 4 and str(lines[4]).strip() else 0

        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            
            if scan:
                results = []
                best_score = 1.0
                best_q = 90
                best_bytes = None
                best_node = "NONE"
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    for q in [90, 80, 70, 60]:
                        c_bytes = self._apply_filters_and_compress(img, q, chroma_lvl, blur_lvl, noise_lvl)
                        chk = await self._robust_check_api(client, c_bytes, start_node)
                        results.append({"quality": q, "score": chk["score"], "status": chk["status"]})
                        if chk["score"] < best_score:
                            best_score = chk["score"]
                            best_q = q
                            best_bytes = c_bytes
                            best_node = chk["used_profile"]
                            
                if not best_bytes: best_bytes = self._apply_filters_and_compress(img, 90, chroma_lvl, blur_lvl, noise_lvl)
                return {
                    "TYPE": "ai_batch",
                    "RESULTS": results,
                    "BEST_Q": best_q,
                    "BEST_SCORE": f"{best_score * 100:.1f}%",
                    "USED_PROFILE": best_node,
                    "IMAGE_BASE64": base64.b64encode(best_bytes).decode('utf-8')
                }

            c_bytes = self._apply_filters_and_compress(img, quality, chroma_lvl, blur_lvl, noise_lvl)
            async with httpx.AsyncClient(timeout=20.0) as client:
                chk = await self._robust_check_api(client, c_bytes, start_node)
            
            return {
                "TYPE": "ai_bypass",
                "STATUS": chk["status"],
                "USED_PROFILE": chk["used_profile"],
                "AI_PROBABILITY": f"{chk['score'] * 100:.1f}%",
                "IMAGE_BASE64": base64.b64encode(c_bytes).decode('utf-8')
            }