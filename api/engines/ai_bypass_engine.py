import io
import os
import base64
import httpx
from PIL import Image
from typing import List, Dict, Any

class AIBypassEngine:
    """Enterprise AI Stealth (Pure Compression & Auto-Find) [cite: 2026-02-05]."""
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
            # type: 'range' дасть нам гарний повзунок на фронті [cite: 2026-02-21]
            {"id": "compress", "label": "JPEG_QUALITY (%)", "p": "72", "type": "range", "min": 10, "max": 100},
            {"id": "profile", "label": "SIGHTENGINE_NODE", "p": "PROFILE_1", "type": "select", "opts": ["PROFILE_1", "PROFILE_2", "PROFILE_3"]}
        ]

    async def _check_api(self, client: httpx.AsyncClient, img_bytes: bytes, user: str, secret: str) -> Dict[str, Any]:
        """Атомарний виклик до Sightengine [cite: 2026-02-05]."""
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

    def _compress(self, img: Image.Image, quality: int) -> bytes:
        """Тільки чисте стиснення з підрізкою кольору (subsampling=2) [cite: 2026-02-21]."""
        out = io.BytesIO()
        img.save(out, format="jpeg", quality=quality, subsampling=2)
        return out.getvalue()

    async def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, Any]:
        if not image_bytes: raise ValueError("ERR_NO_IMAGE_PAYLOAD")

        quality = int(lines[0]) if lines and lines[0].strip() else 72
        prof_key = lines[1] if len(lines) > 1 and lines[1].strip() else "PROFILE_1"
        api_user, api_secret = self.profiles.get(prof_key, self.profiles["PROFILE_1"])

        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")

            # РЕЖИМ 1: AUTO-FIND BEST COMPRESSION (scan = True) [cite: 2026-02-05]
            if scan:
                results = []
                best_score = 1.0
                best_q = 90
                best_bytes = None
                
                async with httpx.AsyncClient(timeout=45.0) as client:
                    # Sequential loop щоб не зловити 429 Too Many Requests від API
                    for q in [90, 80, 70, 60]:
                        c_bytes = self._compress(img, q)
                        chk = await self._check_api(client, c_bytes, api_user, api_secret)
                        results.append({"quality": q, "score": chk["score"], "status": chk["status"]})
                        
                        if chk["score"] < best_score:
                            best_score = chk["score"]
                            best_q = q
                            best_bytes = c_bytes
                            
                if not best_bytes: best_bytes = self._compress(img, 90)
                return {
                    "TYPE": "ai_batch",
                    "RESULTS": results,
                    "BEST_Q": best_q,
                    "BEST_SCORE": f"{best_score * 100:.1f}%",
                    "IMAGE_BASE64": base64.b64encode(best_bytes).decode('utf-8')
                }

            # РЕЖИМ 2: SINGLE COMPRESSION (scan = False) [cite: 2026-02-21]
            c_bytes = self._compress(img, quality)
            async with httpx.AsyncClient(timeout=20.0) as client:
                chk = await self._check_api(client, c_bytes, api_user, api_secret)
            
            return {
                "TYPE": "ai_bypass",
                "STATUS": chk["status"],
                "AI_PROBABILITY": f"{chk['score'] * 100:.1f}%",
                "IMAGE_BASE64": base64.b64encode(c_bytes).decode('utf-8')
            }