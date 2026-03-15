import cv2
import numpy as np
import fitz
import json
import sys
from pathlib import Path
from typing import Final, Dict, Any

class SeniorLayoutEditorV40:
    """Atomic Calibration Engine v40 з підтримкою Right-Alignment експансії."""
    __slots__ = ('input_path', 'config_path', 'targets', 'zoom')

    def __init__(self, input_path: str, config_path: str = "coords.json") -> None:
        self.input_path: Final[str] = input_path
        self.config_path: Final[str] = config_path
        self.zoom: Final[float] = 2.0 
        # Додав кортеж (Назва, Вирівнювання)
        self.targets: Final[Dict[str, tuple[str, str]]] = {
            "1": ("Address_Block", "left"),
            "2": ("Invoice_Table", "left"),
            "3": ("Premises_Block", "left"),
            "4": ("Page_1_Shield", "left"),
            "5": ("Finance_Date_Zone", "left"),
            "6": ("Fin_Val_1_PrevBal", "right"),
            "7": ("Fin_Val_2_Payment", "right"),
            "8": ("Fin_Val_3_AccBalBefore", "right"),
            "9": ("Fin_Val_4_Trans", "right"),
            "10": ("Fin_Val_5_NewBal", "right")
        }

    def _load_cfg(self) -> Dict[str, Any]:
        p = Path(self.config_path)
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[!] Бітий дамп конфігу: {e}")
                return {}
        return {}

    def run(self) -> None:
        cfg: Dict[str, Any] = self._load_cfg()
        
        try:
            doc = fitz.open(self.input_path)
        except Exception as e:
            print(f"[!] Критична помилка I/O. Не можу підняти {self.input_path}. {e}")
            sys.exit(1)
            
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(self.zoom, self.zoom))
        img_orig = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.h, pix.w, 3))
        img_orig = cv2.cvtColor(img_orig, cv2.COLOR_RGB2BGR)

        while True:
            print("\n--- ATOMIC CALIBRATOR v40 ---")
            for k, (v, align) in self.targets.items():
                status = "[OK]" if v in cfg else "[EMPTY]"
                print(f"{k.ljust(2)}. {v.ljust(25)} | {align[:1].upper()} | {status}")
            print("S. Save and Exit | ESC. Cancel")

            choice = input("\nТаргет (1-10): ").strip().lower()
            if choice == 's': 
                break
            if choice == '\x1b': 
                return
            if choice not in self.targets: 
                continue

            field, align = self.targets[choice]
            if field not in cfg:
                roi = cv2.selectROI(f"Draw: {field}", img_orig, fromCenter=False)
                cv2.destroyWindow(f"Draw: {field}")
                if roi == (0, 0, 0, 0): 
                    continue
                cfg[field] = {
                    "rect": [roi[0]/self.zoom, roi[1]/self.zoom, (roi[0]+roi[2])/self.zoom, (roi[1]+roi[3])/self.zoom],
                    "font_size": 9.5, 
                    "align": align
                }

            r = [int(x * self.zoom) for x in cfg[field]["rect"]]
            fs = cfg[field]["font_size"]
            field_align = cfg[field].get("align", align)

            while True:
                temp_img = img_orig.copy()
                # Рендер вже існуючих зон
                for name, data in cfg.items():
                    if name != field:
                        dr = [int(x * self.zoom) for x in data["rect"]]
                        cv2.rectangle(temp_img, (dr[0], dr[1]), (dr[2], dr[3]), (0, 255, 0), 1)

                # Рендер активної зони
                cv2.rectangle(temp_img, (r[0], r[1]), (r[2], r[3]), (0, 0, 255), 2)
                
                # Симуляція тексту для розуміння вирівнювання
                placeholder = "€999.99" if field_align == "right" else "TEXT_BLOCK"
                font_scale = fs / 12.0 # Приблизна мапа масштабу для прев'ю
                thickness = max(1, int(font_scale * 1.5))
                text_size, _ = cv2.getTextSize(placeholder, cv2.FONT_HERSHEY_DUPLEX, font_scale, thickness)
                
                if field_align == "right":
                    # X координата = правий край BBox мінус ширина тексту
                    text_x = r[2] - text_size[0] - 4
                else:
                    text_x = r[0] + 4
                
                text_y = r[3] - 4 # Притискаємо до нижнього краю BBox
                
                cv2.putText(temp_img, placeholder, (text_x, text_y), cv2.FONT_HERSHEY_DUPLEX, font_scale, (255, 0, 0), thickness)
                cv2.putText(temp_img, f"TARGET: {field} | FS: {fs:.1f} | ALIGN: {field_align.upper()}", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

                cv2.imshow("Atomic Editor v40", temp_img)
                k = cv2.waitKeyEx(0)
                k_low = k & 0xFF
                key = chr(k_low).lower() if 32 < k_low < 127 else ""

                if k_low == 13: # ENTER
                    cfg[field]["rect"] = [r[0]/self.zoom, r[1]/self.zoom, r[2]/self.zoom, r[3]/self.zoom]
                    cfg[field]["font_size"] = fs
                    cfg[field]["align"] = field_align
                    break
                elif k_low == 27: # ESC
                    break

                # WASD - переміщення BBox
                # IJKL - ресайз BBox
                # [ ] - зміна розміру шрифту
                step = 1
                if k == 2424832 or key == 'a': r[0] -= step; r[2] -= step
                elif k == 2555904 or key == 'd': r[0] += step; r[2] += step
                elif k == 2490368 or key == 'w': r[1] -= step; r[3] -= step
                elif k == 2621440 or key == 's': r[1] += step; r[3] += step
                elif key == 'j' and r[2] > r[0]+2: r[2] -= step
                elif key == 'l': r[2] += step
                elif key == 'i' and r[3] > r[1]+2: r[3] -= step
                elif key == 'k': r[3] += step
                elif key == '[': fs -= 0.1
                elif key == ']': fs += 0.1

            cv2.destroyAllWindows()

        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=4)
        print(f"[+] Атомарний конфіг {self.config_path} оновлено. Усі вирівнювання прописані.")

if __name__ == "__main__":
    SeniorLayoutEditorV40("Utilydy bill Energia-1.pdf").run()