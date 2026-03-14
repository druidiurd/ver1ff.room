import fitz
import json
import random
import warnings
import asyncio
import sys
import os
import shutil
from datetime import datetime, timedelta
from typing import Final, List, Dict, Any
from pathlib import Path

# Senior Performance Setup [cite: 2026-02-21]
warnings.filterwarnings("ignore")
if sys.platform == 'win32':
    try: asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except: pass

class SeniorProductionV57:
    """Enterprise Engine v57. Right Alignment & Precision Financial Logic [cite: 2026-02-05]."""
    __slots__ = ('input_path', 'cfg', 'now', 'output_path', 'f_reg', 'f_bold')

    def __init__(self, input_path: str):
        self.input_path = input_path
        self.now = datetime.now()
        
        # Завантаження твого атомарного конфігу
        with open("coords.json", "r") as f:
            self.cfg = json.load(f)
        
        # Підготовка локальних шрифтів для обходу прав доступу [cite: 2026-02-05]
        self.f_reg, self.f_bold = self._prepare_fonts()
        
        ts = self.now.strftime("%Y%m%d_%H%M")
        self.output_path = f"Energia_Bill_{ts}.pdf"

    def _prepare_fonts(self) -> tuple[str, str]:
        """Копіює системні шрифти в робочу директорію для стабільного доступу [cite: 2026-02-05]."""
        wdir = Path(os.environ.get('WINDIR', 'C:\\Windows')) / "Fonts"
        local_dir = Path(os.getcwd())
        reg_name, bold_name = "arial.ttf", "arialbd.ttf"
        
        for name in [reg_name, bold_name]:
            target = local_dir / name
            if not target.exists():
                source = wdir / name
                if not source.exists(): source = wdir / name.capitalize()
                if source.exists():
                    shutil.copy(source, target)
        return str((local_dir / reg_name).absolute()), str((local_dir / bold_name).absolute())

    def _fmt(self, val: float) -> str:
        """Символ Євро через стабільний Unicode \u20ac [cite: 2026-02-05]."""
        return f"\u20ac{val:,.2f}"

    async def run(self, raw_addr: List[str]) -> bool:
        try:
            # 1. МАТЕМАТИКА [cite: 2026-02-05]
            p_bal = round(random.uniform(70.0, 135.0), 2)
            trans = round(random.uniform(85.0, 225.0), 2)
            bill_dt = self.now
            cutoff_dt = bill_dt - timedelta(days=20)
            
            # 2. МАПУВАННЯ (1-2 Regular, 3-5 Bold) [cite: 2026-02-21]
            fin_map = {
                "Fin_Val_1_PrevBal": {"v": self._fmt(p_bal), "file": self.f_reg, "name": "Arial"},
                "Fin_Val_2_Payment": {"v": self._fmt(p_bal), "file": self.f_reg, "name": "Arial"},
                "Fin_Val_3_AccBalBefore": {"v": "\u20ac0.00", "file": self.f_bold, "name": "Arial-Bold"},
                "Fin_Val_4_Trans": {"v": self._fmt(trans), "file": self.f_bold, "name": "Arial-Bold"},
                "Fin_Val_5_NewBal": {"v": self._fmt(trans), "file": self.f_bold, "name": "Arial-Bold"}
            }

            table_map = {
                "Invoice No.": str(random.randint(24500000, 24599999)),
                "Account Number": str(random.randint(5365000000, 5365999999)),
                "Tariff": "Electricity",
                "Billing Period": f"{(bill_dt-timedelta(days=33)):%d/%m/%Y} - {(bill_dt-timedelta(days=1)):%d/%m/%Y}",
                "Date of this Bill": bill_dt.strftime("%d %B %Y"),
                "Payment Due Date": (bill_dt+timedelta(days=14)).strftime("%d %B %Y")
            }

            addr = [l.upper() if i in [1,2,3,5] else l for i, l in enumerate(raw_addr)]

            with fitz.open(self.input_path) as doc:
                page = doc[0]
                page.clean_contents()

                # --- Крок 1: ЗАЧИСТКА ---
                for name, data in self.cfg.items():
                    if name not in ["Page_1_Shield", "Finance_Values_Zone"]:
                        page.add_redact_annot(fitz.Rect(data["rect"]), fill=(1, 1, 1))
                page.apply_redactions()

                # --- Крок 2: РЕНДЕРИНГ (З розрахунком Right Alignment) ---
                
                # Адреса
                b_a = self.cfg["Address_Block"]
                for i, text in enumerate(addr):
                    page.insert_text((b_a["rect"][0], b_a["rect"][1] + 10 + (i * b_a["line_height"])), 
                                   text, fontname="Arial", fontfile=self.f_reg, fontsize=b_a["font_size"])

                # Таблиця інфо
                b_t = self.cfg["Invoice_Table"]
                for i, val in enumerate(table_map.values()):
                    page.insert_text((b_t["rect"][0], b_t["rect"][1] + 8 + (i * b_t["line_height"])), 
                                   val, fontname="Arial", fontfile=self.f_reg, fontsize=b_t["font_size"])

                # Дата платежу
                if "Finance_Date_Zone" in self.cfg:
                    fdz = self.cfg["Finance_Date_Zone"]
                    page.insert_text((fdz["rect"][0], fdz["rect"][1] + 10), 
                                   f"Payment(s) received up to {cutoff_dt:%d %B %Y}", 
                                   fontname="Arial", fontfile=self.f_reg, fontsize=9)

                # Атомарні суми: RIGHT ALIGNMENT LOGIC [cite: 2026-02-05]
                for key, item in fin_map.items():
                    if key in self.cfg:
                        z = self.cfg[key]
                        # Ініціалізуємо шрифт для вимірювання ширини
                        f_obj = fitz.Font(fontfile=item["file"])
                        tw = f_obj.text_length(item["v"], fontsize=z["font_size"])
                        # Позиція X = права межа ROI (rect[2]) мінус ширина тексту
                        x_pos = z["rect"][2] - tw
                        
                        page.insert_text((x_pos, z["rect"][1] + 10), item["v"], 
                                       fontname=item["name"], fontfile=item["file"], fontsize=z["font_size"])

                # Блок Premises
                b_p = self.cfg["Premises_Block"]
                page.insert_text((b_p["rect"][0], b_p["rect"][1] + 10), 
                               f"{addr[1]}, {addr[2]}, {addr[5]}", 
                               fontname="Arial", fontfile=self.f_reg, fontsize=b_p["font_size"])

                # --- Крок 3: АНОНІМІЗАЦІЯ ---
                meta = {
                    "producer": "macOS Version 15.3.1 (Build 24D70) Quartz PDFContext",
                    "creator": "Pages",
                    "title": "Energia Utility Bill"
                }
                doc.set_metadata(meta)
                doc.save(self.output_path, garbage=4, deflate=True, clean=True)
                return True
        except Exception:
            import traceback
            traceback.print_exc()
            return False

async def main():
    print("--- ENERGIA PRODUCTION ENGINE v57.0 (Right-Aligned) ---")
    data = [input(f"Рядок {i+1}: ").strip() or " " for i in range(6)]
    worker = SeniorProductionV57("Utilydy bill Energia-1.pdf")
    
    print(f"[*] Рендеринг (Right Alignment активний): {worker.output_path}...")
    if await worker.run(data):
        print(f"[+] Секс. Цифри вирівняні по правому краю. [cite: 2026-02-05]")

if __name__ == "__main__":
    asyncio.run(main())