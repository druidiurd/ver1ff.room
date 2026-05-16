import { Injectable, signal, computed } from '@angular/core';

export type Lang = 'en' | 'ru' | 'ua';

const T = {
  en: {
    brand: 'VER1FF_ROOM',
    selectModule: 'SELECT_MODULE',
    nodesOnline: (n: number) => `${n} NODES ONLINE`,
    sysOnline: 'SYS_ONLINE',
    scan: 'SCAN',
    execute: 'EXECUTE',
    testQuality: 'TEST_QUALITY',
    autoCompress: 'AUTO_COMPRESS',
    fileLocked: 'FILE_LOCKED',
    dropOrClick: 'DROP_OR_CLICK',
    dropUpTo5: 'DROP_UP_TO_5',
    processing: 'PROCESSING...',
    pending: 'PENDING',
    awaitingSource: 'AWAITING_SOURCE',
    nodesDead: 'NODES_DEAD',

    groups: {
      IRELAND: 'IRELAND',
      NETHERLANDS: 'NETHERLANDS',
      FRANCE: 'FRANCE',
      TOOLS: 'TOOLS',
      GLOBAL: 'GLOBAL',
    },

    modules: {
      energia:      { label: 'IE-BILL-GEN',    nav: 'IE-Bill',    desc: 'Irish utility bill generator. Auto-aligns fields. Scan mode adds noise and analog artifacts.' },
      ndls_mrz:     { label: 'IE-NDLS-MRZ',    nav: 'IE-MRZ',     desc: 'Real-time dual-core MRZ for Irish NDLS. Sync checksums for GEN1 and GEN2 standards.' },
      revolut:      { label: 'REVOLUT-BILL',   nav: 'Revolut BILL', desc: 'Revolut EUR statement generator. Fill holder data and one transaction. Outputs clean PDF.' },
      nld_mrz:      { label: 'NL-ID-MRZ',      nav: 'NL-MRZ',     desc: 'Netherlands TD1 ID card MRZ. Vectorized ICAO-9303 checksum math.' },
      fra_mrz:      { label: 'FR-CNI-MRZ',     nav: 'FR-MRZ',     desc: 'French CNI MRZ generator. Validates department code and CIN in real time.' },
      exif_cleaner: { label: 'EXIF-SNIPER',    nav: 'EXIF',       desc: 'Metadata injector for OnePlus 6. Spoof GPS coordinates via map selection.' },
      face_cut:     { label: 'FACE-VISION',    nav: 'Face-Cut',   desc: 'AI biometric extractor. 3×4 ratio. Adjust zoom and vertical offset for live preview.' },
      ai_bypass:    { label: 'AI-STEALTH',     nav: 'AI-Stealth', desc: 'Forensic AI evader. Chromatic aberration, noise, iPhone EXIF. Routes across 10 API nodes.' },
    },
  },

  ru: {
    brand: 'VER1FF_ROOM',
    selectModule: 'ВЫБОР_МОДУЛЯ',
    nodesOnline: (n: number) => `${n} НОДОВ ОНЛАЙН`,
    sysOnline: 'СИСТЕМА_ОНЛАЙН',
    scan: 'СКАН',
    execute: 'ВЫПОЛНИТЬ',
    testQuality: 'ТЕСТ_КАЧЕСТВА',
    autoCompress: 'АВТО_СЖАТИЕ',
    fileLocked: 'ФАЙЛ_ЗАГРУЖЕН',
    dropOrClick: 'ПЕРЕТАЩИ_ИЛИ_НАЖМИ',
    dropUpTo5: 'ДО_5_ФАЙЛОВ',
    processing: 'ОБРАБОТКА...',
    pending: 'ОЖИДАНИЕ',
    awaitingSource: 'ОЖИДАНИЕ_ИСТОЧНИКА',
    nodesDead: 'НОДЫ_МЕРТВЫ',

    groups: {
      IRELAND: 'ИРЛАНДИЯ',
      NETHERLANDS: 'НИДЕРЛАНДЫ',
      FRANCE: 'ФРАНЦИЯ',
      TOOLS: 'ИНСТРУМЕНТЫ',
      GLOBAL: 'ГЛОБАЛЬНЫЕ',
    },

    modules: {
      energia:      { label: 'IE-СЧЁТ-ГЕН',    nav: 'IE-Счёт',    desc: 'Генератор ирландского счёта за коммуналку. Авто-выравнивание. Скан-мод добавляет шум и аналоговые артефакты.' },
      ndls_mrz:     { label: 'IE-NDLS-MRZ',     nav: 'IE-MRZ',     desc: 'Двуядерный MRZ для ирландского NDLS в реальном времени. Синхронизирует контрольные суммы GEN1 и GEN2.' },
      revolut:      { label: 'REVOLUT-ВЫПИСКА', nav: 'Revolut BILL', desc: 'Генератор выписки Revolut EUR. Заполни данные держателя и одну транзакцию. Выводит чистый PDF.' },
      nld_mrz:      { label: 'NL-ID-MRZ',       nav: 'NL-MRZ',     desc: 'MRZ нидерландского ID (TD1). Векторизованная математика контрольных сумм ICAO-9303.' },
      fra_mrz:      { label: 'FR-CNI-MRZ',      nav: 'FR-MRZ',     desc: 'Генератор MRZ французского CNI. Валидирует код департамента и CIN в реальном времени.' },
      exif_cleaner: { label: 'EXIF-СНАЙПЕР',    nav: 'EXIF',       desc: 'Инжектор метаданных для OnePlus 6. Подменяй GPS-координаты через выбор на карте.' },
      face_cut:     { label: 'ФЕЙС-ВИЖН',       nav: 'Face-Cut',   desc: 'AI-экстрактор биометрии. Формат 3×4. Настрой зум и вертикальный сдвиг для предпросмотра.' },
      ai_bypass:    { label: 'AI-СТЕЛС',        nav: 'AI-Stealth', desc: 'Обход AI-детектора. Хроматические аберрации, шум, EXIF iPhone. Маршрутизация по 10 API-нодам.' },
    },
  },

  ua: {
    brand: 'VER1FF_ROOM',
    selectModule: 'ВИБІР_МОДУЛЯ',
    nodesOnline: (n: number) => `${n} НОДІВ ОНЛАЙН`,
    sysOnline: 'СИСТЕМА_ОНЛАЙН',
    scan: 'СКАН',
    execute: 'ВИКОНАТИ',
    testQuality: 'ТЕСТ_ЯКОСТІ',
    autoCompress: 'АВТО_СТИСНЕННЯ',
    fileLocked: 'ФАЙЛ_ЗАВАНТАЖЕНО',
    dropOrClick: 'ПЕРЕТЯГНИ_АБО_НАТИСНИ',
    dropUpTo5: 'ДО_5_ФАЙЛІВ',
    processing: 'ОБРОБКА...',
    pending: 'ОЧІКУВАННЯ',
    awaitingSource: 'ОЧІКУВАННЯ_ДЖЕРЕЛА',
    nodesDead: 'НОДИ_МЕРТВІ',

    groups: {
      IRELAND: 'ІРЛАНДІЯ',
      NETHERLANDS: 'НІДЕРЛАНДИ',
      FRANCE: 'ФРАНЦІЯ',
      TOOLS: 'ІНСТРУМЕНТИ',
      GLOBAL: 'ГЛОБАЛЬНІ',
    },

    modules: {
      energia:      { label: 'IE-РАХУНОК-ГЕН',  nav: 'IE-Рахунок',  desc: 'Генератор ірландського рахунку за комуналку. Авто-вирівнювання. Скан-мод додає шум і аналогові артефакти.' },
      ndls_mrz:     { label: 'IE-NDLS-MRZ',      nav: 'IE-MRZ',      desc: 'Двоядерний MRZ для ірландського NDLS у реальному часі. Синхронізує контрольні суми GEN1 і GEN2.' },
      revolut:      { label: 'REVOLUT-ВИПИСКА',  nav: 'Revolut BILL', desc: 'Генератор виписки Revolut EUR. Заповни дані власника і одну транзакцію. Виводить чистий PDF.' },
      nld_mrz:      { label: 'NL-ID-MRZ',        nav: 'NL-MRZ',      desc: 'MRZ нідерландського ID (TD1). Векторизована математика контрольних сум ICAO-9303.' },
      fra_mrz:      { label: 'FR-CNI-MRZ',       nav: 'FR-MRZ',      desc: 'Генератор MRZ французького CNI. Валідує код департаменту і CIN у реальному часі.' },
      exif_cleaner: { label: 'EXIF-СНАЙПЕР',     nav: 'EXIF',        desc: 'Інжектор метаданих для OnePlus 6. Підміняй GPS-координати через вибір на карті.' },
      face_cut:     { label: 'ФЕЙС-ВІЖН',        nav: 'Face-Cut',    desc: 'AI-екстрактор біометрії. Формат 3×4. Налаштуй зум і вертикальний зсув для попереднього перегляду.' },
      ai_bypass:    { label: 'AI-СТЕЛС',         nav: 'AI-Stealth',  desc: 'Обхід AI-детектора. Хроматичні аберації, шум, EXIF iPhone. Маршрутизація по 10 API-нодах.' },
    },
  },
};

export type ModuleId = keyof typeof T.en.modules;
export type Translations = typeof T.en;

@Injectable({ providedIn: 'root' })
export class I18nService {
  lang = signal<Lang>('en');

  t = computed(() => T[this.lang()]);

  module(id: string) {
    const mods = this.t().modules as Record<string, { label: string; nav: string; desc: string }>;
    return mods[id] ?? { label: id.toUpperCase(), nav: id, desc: '' };
  }

  group(key: string) {
    const groups = this.t().groups as Record<string, string>;
    return groups[key] ?? key;
  }

  setLang(l: Lang) {
    this.lang.set(l);
    localStorage.setItem('lang', l);
  }

  init() {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved && ['en', 'ru', 'ua'].includes(saved)) this.lang.set(saved);
  }
}
