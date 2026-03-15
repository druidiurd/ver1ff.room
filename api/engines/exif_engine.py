import os
import hashlib
import random
import io
import piexif
from PIL import Image
from datetime import datetime
from typing import List, Dict, Final, Tuple

class ExifEngine:
    """Enterprise EXIF Injector (OnePlus 6 / IMX519 Profile). [cite: 2026-02-05, 2026-02-21]."""
    __slots__ = ('_model', '_make', '_software')

    def __init__(self, base_path: str):
        self._model: Final = "ONEPLUS A6003"
        self._make: Final = "OnePlus"
        self._software: Final = "OxygenOS 10.3.12"

    def get_schema(self):
        return [
            {"id": "lat", "label": "LATITUDE", "p": "53.3498"},
            {"id": "lon", "label": "LONGITUDE", "p": "-6.2603"},
            {"id": "date", "label": "TARGET_DATE", "p": "YYYY-MM-DD (Empty=Now)"}
        ]

    def _to_exif_rational(self, value: float) -> Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int]]:
        abs_val = abs(value)
        deg = int(abs_val)
        min_float = (abs_val - deg) * 60
        minute = int(min_float)
        sec = int((min_float - minute) * 6000)
        return ((deg, 1), (minute, 1), (sec, 100))

    def render(self, lines: List[str], scan: bool = False, image_bytes: bytes = None) -> io.BytesIO:
        if not image_bytes:
            raise ValueError("ERR_NO_IMAGE_PAYLOAD")

        # Дефолтні координати (Дублін), якщо фронт нічого не прислав [cite: 2026-02-05]
        lat, lon = 53.3498, -6.2603
        target_date = datetime.now()

        try:
            if len(lines) >= 2:
                lat = float(lines[0]) if lines[0].strip() else lat
                lon = float(lines[1]) if lines[1].strip() else lon
            if len(lines) >= 3 and lines[2].strip():
                target_date = datetime.strptime(lines[2].strip(), "%Y-%m-%d")
        except: pass

        dt_obj = target_date.replace(hour=random.randint(8, 21), minute=random.randint(0, 59), second=random.randint(0, 59))
        dt_str = dt_obj.strftime("%Y:%m:%d %H:%M:%S")

        with Image.open(io.BytesIO(image_bytes)) as img:
            if img.mode != "RGB":
                img = img.convert("RGB")

            # GPS Payload [cite: 2026-02-21]
            gps_ifd = {
                piexif.GPSIFD.GPSVersionID: (2, 2, 0, 0),
                piexif.GPSIFD.GPSLatitudeRef: 'N' if lat >= 0 else 'S',
                piexif.GPSIFD.GPSLatitude: self._to_exif_rational(lat),
                piexif.GPSIFD.GPSLongitudeRef: 'E' if lon >= 0 else 'W',
                piexif.GPSIFD.GPSLongitude: self._to_exif_rational(lon),
                piexif.GPSIFD.GPSAltitudeRef: 0,
                piexif.GPSIFD.GPSAltitude: (random.randint(50, 200), 1),
                piexif.GPSIFD.GPSTimeStamp: ((dt_obj.hour, 1), (dt_obj.minute, 1), (dt_obj.second, 1)),
                piexif.GPSIFD.GPSDateStamp: dt_obj.strftime("%Y:%m:%d"),
            }

            # EXIF Payload (IMX519 Signature) [cite: 2026-02-05]
            exif_ifd = {
                piexif.ExifIFD.DateTimeOriginal: dt_str,
                piexif.ExifIFD.DateTimeDigitized: dt_str,
                piexif.ExifIFD.FNumber: (17, 10),
                piexif.ExifIFD.FocalLength: (425, 100),
                piexif.ExifIFD.ISOSpeedRatings: random.choice([100, 160, 250, 400]),
                piexif.ExifIFD.ExifVersion: b"0220",
                piexif.ExifIFD.ImageUniqueID: hashlib.sha1(os.urandom(24)).hexdigest(),
                piexif.ExifIFD.MakerNote: b'OnePlus_IMX519_V1.10_' + os.urandom(12),
                piexif.ExifIFD.SceneType: b'\x01',
                piexif.ExifIFD.ColorSpace: 1,
            }

            # Device Meta [cite: 2026-02-05]
            zeroth_ifd = {
                piexif.ImageIFD.Make: self._make,
                piexif.ImageIFD.Model: self._model,
                piexif.ImageIFD.Software: self._software,
                piexif.ImageIFD.DateTime: dt_str,
                piexif.ImageIFD.Orientation: 1,
            }

            exif_dict = {"0th": zeroth_ifd, "Exif": exif_ifd, "GPS": gps_ifd}
            
            # Thumbnail Rendering
            thumb_img = img.copy()
            thumb_img.thumbnail((256, 256), Image.Resampling.LANCZOS)
            thumb_io = io.BytesIO()
            thumb_img.save(thumb_io, format="JPEG", quality=70)
            exif_dict["thumbnail"] = thumb_io.getvalue()

            exif_bytes = piexif.dump(exif_dict)
            output = io.BytesIO()
            img.save(output, format="jpeg", exif=exif_bytes, quality=95, subsampling=2)
            output.seek(0)
            return output