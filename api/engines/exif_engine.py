import os, hashlib, random, io, piexif
from PIL import Image
from datetime import datetime
from typing import List, Tuple, Final

class ExifEngine:
    """OnePlus 6 Profile Injector. Default date = Today [cite: 2026-03-16]."""
    def __init__(self, base_path: str):
        self._model: Final = "ONEPLUS A6003"
        self._make: Final = "OnePlus"

    def get_schema(self):
        # Початкове значення дати в плейсхолдері - сьогодні
        today = datetime.now().strftime("%Y-%m-%d")
        return [
            {"id": "lat", "label": "LATITUDE", "p": "53.3498"},
            {"id": "lon", "label": "LONGITUDE", "p": "-6.2603"},
            {"id": "date", "label": "TARGET_DATE", "p": today}
        ]

    def _to_exif_rational(self, value: float) -> Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int]]:
        abs_val = abs(value)
        deg = int(abs_val)
        min_f = (abs_val - deg) * 60
        minute = int(min_f)
        sec = int((min_f - minute) * 6000)
        return ((deg, 1), (minute, 1), (sec, 100))

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes: raise ValueError("NO_IMAGE")
        lat, lon = float(lines[0] or 53.3498), float(lines[1] or -6.2603)
        # Fix: завжди сьогодні, якщо порожньо [cite: 2026-03-16]
        dt_target = datetime.strptime(lines[2], "%Y-%m-%d") if len(lines)>2 and lines[2] else datetime.now()
        dt_str = dt_target.replace(hour=random.randint(9,20)).strftime("%Y:%m:%d %H:%M:%S")

        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            exif_dict = {
                "0th": {piexif.ImageIFD.Make: self._make, piexif.ImageIFD.Model: self._model, piexif.ImageIFD.DateTime: dt_str},
                "Exif": {piexif.ExifIFD.DateTimeOriginal: dt_str, piexif.ExifIFD.ImageUniqueID: hashlib.sha1(os.urandom(10)).hexdigest()},
                "GPS": {
                    piexif.GPSIFD.GPSLatitudeRef: 'N' if lat >= 0 else 'S',
                    piexif.GPSIFD.GPSLatitude: self._to_exif_rational(lat),
                    piexif.GPSIFD.GPSLongitudeRef: 'E' if lon >= 0 else 'W',
                    piexif.GPSIFD.GPSLongitude: self._to_exif_rational(lon)
                }
            }
            output = io.BytesIO()
            img.save(output, format="jpeg", exif=piexif.dump(exif_dict), quality=95)
            output.seek(0)
            return output