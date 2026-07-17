"""
Генератор номера водительского удостоверения Великобритании (DVLA, 16 символов).
Алгоритм синхронизирован с src/app/components/uk-dl-gen.ts (buildDlNumber).

Структура 16-символьного номера:
  [1-5]   фамилия (5 латинских букв, паддинг '9'; MAC- в начале → MC)
  [6]     последняя цифра десятилетия года рождения
  [7-8]   месяц рождения (01-12 для М; для Ж: десятки+5, единицы как есть, напр. 08→58)
  [9-10]  день рождения (01-31)
  [11]    последняя цифра года рождения
  [12-13] инициалы: первая буква имени + первая буква отчества (паддинг '9')
  [14]    произвольная цифра — у DVLA всегда '9'
  [15-16] две буквы, детерминированный сид от фамилии+даты (не случайные)

Отдельно (не входит в 16 символов): randomSuffix — 2 случайные цифры,
печатаются на карте после номера через пробел.
"""

import random
import re
from dataclasses import dataclass
from datetime import date

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


@dataclass
class DvlaInput:
    surname: str
    first_name: str
    middle_name: str = ""
    dob: date = None
    gender: str = "M"  # "M" или "F"


def _clean_letters(s: str) -> str:
    return re.sub(r"[^A-Za-z]", "", s).upper()


def _surname_block(surname: str) -> str:
    s = _clean_letters(surname)
    if s.startswith("MAC") and len(s) > 3:
        s = "MC" + s[3:]
    if len(s) < 5:
        s = s.ljust(5, "9")
    return s[:5]


def _initials_block(first_name: str, middle_name: str) -> str:
    f = _clean_letters(first_name)
    m = _clean_letters(middle_name)
    first_init = f[0] if f else "9"
    middle_init = m[0] if m else "9"
    return first_init + middle_init


def _month_block(month: int, gender: str) -> str:
    if gender.upper() == "F":
        tens, units = divmod(month, 10)
        return f"{tens + 5}{units}"
    return str(month).zfill(2)


def generate_uk_dl_number(data: DvlaInput) -> str:
    """Собирает 16-символьный номер UK DL по введённым данным."""
    if data.dob is None:
        raise ValueError("dob (дата рождения) обязательна")

    surname_block = _surname_block(data.surname)
    decade_digit = str(data.dob.year % 100 // 10)
    month_block = _month_block(data.dob.month, data.gender)
    day_block = str(data.dob.day).zfill(2)
    year_digit = str(data.dob.year % 10)
    initials_block = _initials_block(data.first_name, data.middle_name)

    # Сид для последних двух букв — детерминированный, как на сайте (buildDlNumber)
    seed1 = (ord(surname_block[0]) + ord(surname_block[1]) + data.dob.day) % 26
    seed2 = (ord(surname_block[2]) + ord(surname_block[3]) + data.dob.month) % 26

    return (
        surname_block
        + decade_digit
        + month_block
        + day_block
        + year_digit
        + initials_block
        + "9"
        + LETTERS[seed1]
        + LETTERS[seed2]
    )


def generate_random_suffix() -> str:
    """Отдельное двузначное поле, печатается на карте после основного номера."""
    return str(random.randint(0, 99)).zfill(2)


def format_uk_dl_number(number: str, suffix: str) -> str:
    """Полное отображение: 16-символьный номер + пробел + suffix."""
    if len(number) != 16:
        raise ValueError("номер должен быть длиной 16 символов")
    return f"{number} {suffix}"


def parse_uk_dl_number(number: str) -> dict:
    """Обратный разбор 16-символьного номера (без suffix)."""
    if len(number) != 16:
        raise ValueError("номер должен быть длиной 16 символов")

    surname_block = number[0:5]
    decade_digit = number[5]
    month_raw = int(number[6:8])
    day = int(number[8:10])
    year_digit = number[10]
    initials_block = number[11:13]
    arbitrary_digit = number[13]
    seed_letters = number[14:16]

    gender = "F" if month_raw > 12 else "M"
    month = month_raw - 50 if gender == "F" else month_raw

    return {
        "surname_block": surname_block,
        "decade_digit": decade_digit,
        "month": month,
        "day": day,
        "year_digit": year_digit,
        "gender": gender,
        "initials_block": initials_block,
        "arbitrary_digit": arbitrary_digit,
        "seed_letters": seed_letters,
    }


def random_uk_dl(surname: str = None, first_name: str = None) -> tuple[str, str]:
    """Быстрая генерация со случайными ФИО/датой. Возвращает (номер, suffix)."""
    surnames_pool = ["SMITH", "JONES", "TAYLOR", "BROWN", "WILLIAMS", "WILSON"]
    names_pool = ["JOHN", "JAMES", "DAVID", "MARK", "PAUL", "ROBERT"]

    surname = surname or random.choice(surnames_pool)
    first_name = first_name or random.choice(names_pool)

    year = random.randint(1955, 2005)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    gender = random.choice(["M", "F"])

    data = DvlaInput(
        surname=surname,
        first_name=first_name,
        middle_name="",
        dob=date(year, month, day),
        gender=gender,
    )
    num = generate_uk_dl_number(data)
    return num, generate_random_suffix()


def _prompt_dob() -> date:
    while True:
        raw = input("Дата рождения (ДД-ММ-ГГГГ): ").strip()
        m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", raw)
        if not m:
            print("неверный формат, пример: 14-07-1985")
            continue
        day, month, year = map(int, m.groups())
        try:
            return date(year, month, day)
        except ValueError:
            print("такой даты не существует, попробуй ещё раз")


def _prompt_gender() -> str:
    while True:
        raw = input("Пол (M/F): ").strip().upper()
        if raw in ("M", "F"):
            return raw
        print("введи M или F")


def run_interactive() -> None:
    print("=== UK DL Number Generator ===")
    surname = input("Фамилия: ").strip()
    first_name = input("Имя: ").strip()
    middle_name = input("Отчество (можно пусто): ").strip()
    dob = _prompt_dob()
    gender = _prompt_gender()

    data = DvlaInput(
        surname=surname,
        first_name=first_name,
        middle_name=middle_name,
        dob=dob,
        gender=gender,
    )
    num = generate_uk_dl_number(data)
    suffix = generate_random_suffix()
    print("\nНомер:", format_uk_dl_number(num, suffix))
    print("Разбор:", parse_uk_dl_number(num))


if __name__ == "__main__":
    run_interactive()
