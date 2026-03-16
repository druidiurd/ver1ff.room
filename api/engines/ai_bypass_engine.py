import io
import os
import base64
import httpx
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from typing import List, Dict, Any

class AIBypassEngine:
    """Enterprise AI Forensic Evader & Multi-Profile Sightengine Validator [cite: 2026-02-05]."""
    __slots__ = ('base_path', 'profiles')

    def __init__(self, base_path: str):
        self.base_path = base_path
        # Словник профілів (User, Secret). Додай свої ключі замість плейсхолдерів [cite: 2026-02-05]
        self.profiles = {
            "PROFILE_1": (os.environ.get("SE_USER_1", "661088083"), os.environ.get("SE_SECRET_1", "vjoitWMLAvEyuu9CvBSwAyRfRUraBEL8")),
            "PROFILE_2": (os.environ.get("SE_USER_2", "YOUR_USER_2"), os.environ.get("SE_SECRET_2", "YOUR_SECRET_2")),
            "PROFILE_3": (os.environ.get("SE_USER_3", "YOUR_USER_3"), os.environ.get("SE_SECRET_3", "YOUR_SECRET_3"))
        }

    def get_schema(self) -> List[Dict[str, Any]]:
        return [
            {"id": "noise", "label": "GAUSSIAN_NOISE (0-15)", "p": "4", "opts": None},
            {"id": "compress", "label": "JPEG_QUALITY (50-100)", "p": "72", "opts": None},
            {"id": "profile", "label": "SIGHTENGINE_NODE", "p": "PROFILE_1", "opts": ["PROFILE_1", "PROFILE_2", "PROFILE_3"]}
        ]

    async def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> Dict[str, Any]:
        if not image_bytes: 
            raise ValueError("ERR_NO_IMAGE_PAYLOAD")

        noise_lvl = int(lines[0]) if len(lines) > 0 and lines[0].strip() else 4
        quality = int(lines[1]) if len(lines) > 1 and lines[1].strip() else 72
        prof_key = lines[2] if len(lines) > 2 and lines[2].strip() else "PROFILE_1"
        
        api_user, api_secret = self.profiles.get(prof_key, self.profiles["PROFILE_1"])

        # 1. FORENSIC EVASION (Руйнування GAN-артефактів) [cite: 2026-02-21]
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            img = ImageEnhance.Color(img).enhance(0.92)
            img = ImageEnhance.Sharpness(img).enhance(0.85)
            
            arr = np.array(img)
            if noise_lvl > 0:
                noise = np.random.normal(0, noise_lvl, arr.shape).astype('int16')
                arr = np.clip(arr.astype('int16') + noise, 0, 255).astype('uint8')
            
            img = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(0.3))
            
            out = io.BytesIO()
            img.save(out, format="jpeg", quality=quality, subsampling=2)
            processed_bytes = out.getvalue()

        # 2. SIGHTENGINE API VALIDATION [cite: 2026-02-05]
        ai_score = 0.0
        status_msg = "API_BYPASS_FAILED"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                files = {'media': ('stealth.jpg', processed_bytes, 'image/jpeg')}
                data = {
                    'models': 'genai', 
                    'api_user': api_user, 
                    'api_secret': api_secret
                }
                
                resp = await client.post("https://api.sightengine.com/1.0/check.json", data=data, files=files)
                resp.raise_for_status()
                r_json = resp.json()
                
                if r_json.get("status") == "success":
                    ai_score = r_json.get("type", {}).get("ai_generated", 0.0)
                    status_msg = f"SYNC_OK [{prof_key}]"
                else:
                    status_msg = r_json.get("error", {}).get("message", "UNKNOWN_API_ERR")
        except Exception as e:
            status_msg = f"HTTPX_ERR: {str(e)}"

        # 3. ПАКУВАННЯ PAYLOAD [cite: 2026-02-21]
        b64_img = base64.b64encode(processed_bytes).decode('utf-8')
        
        return {
            "STATUS": status_msg,
            "AI_PROBABILITY": f"{ai_score * 100:.1f}%",
            "IMAGE_BASE64": b64_img,
            "TYPE": "ai_bypass"
        }