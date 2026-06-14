import { Injectable } from '@angular/core';

export const T = {
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
    '🧪 ID LAB':  'ID LAB',
    '⬡ GLOBAL':   'GLOBAL',
    '⚙ TOOLS':    'TOOLS',
    'ID LAB':     'ID LAB',
    'GLOBAL':     'GLOBAL',
    'TOOLS':      'TOOLS',
  } as Record<string, string>,

  modules: {
    energia:      { label: 'IE-BILL-GEN',   nav: 'IE-Bill',     desc: 'Irish utility bill generator. Auto-aligns fields. Scan mode adds noise and analog artifacts.' },
    ndls_mrz:     { label: 'IE-DL-MRZ',     nav: 'IE-DL-MRZ',   desc: 'Real-time dual-core MRZ for Irish NDLS. Sync checksums for GEN1 and GEN2 standards.' },
    revolut:      { label: 'REVOLUT-BILL',  nav: 'Revolut BILL', desc: 'Revolut EUR statement generator. Fill holder data and one transaction. Outputs clean PDF.' },
    nld_mrz:      { label: 'NL-ID-MRZ',     nav: 'NL-ID-MRZ',   desc: 'Netherlands TD1 ID card MRZ. Vectorized ICAO-9303 checksum math.' },
    fra_mrz:      { label: 'FR-ID-OLD-MRZ', nav: 'FR-ID-OLD-MRZ', desc: 'French CNI MRZ generator. Validates department code and CIN in real time.' },
    exif_cleaner: { label: 'EXIF-SNIPER',   nav: 'EXIF',        desc: 'Metadata injector for OnePlus 6. Spoof GPS coordinates via map selection.' },
    face_cut:     { label: 'FACE-VISION',   nav: 'Face-Cut',    desc: 'AI biometric extractor. 3×4 ratio. Adjust zoom and vertical offset for live preview.' },
    ai_bypass:    { label: 'AI-STEALTH',    nav: 'AI-Stealth',  desc: 'Camera pipeline emulator. Radial chromatic aberration, PRNU sensor noise, double JPEG, frequency domain break. Physically plausible — passes forensic AI detectors.' },
    mrz_gen:      { label: 'MRZ-FORGE',    nav: 'MRZ Forge',   desc: 'Universal ICAO 9303 MRZ generator. Passport (MRP/TD3), ID Card (TD1, TD2), Visa (MRV-A), eDL. Weighted checksum engine. All 4 formats simultaneously.' },
    uk_dl_gen:    { label: 'UK-DL-GEN',   nav: 'UK DL Gen',   desc: 'DVLA driving licence number generator. 16-char format + issue number. Encodes surname, DOB, sex, initials per official DVLA spec. Breakdown view.' },
    ita_cf:       { label: 'ITA-CF-GEN',  nav: 'ITA CF Gen',  desc: 'Italian Codice Fiscale generator. Encodes surname, name, DOB, gender and Belfiore municipality code. Outputs 16-char code + Code 39 barcode (transparent PNG, 2740×383).' },
    id_lab:       { label: 'ID-LAB',      nav: 'ID Lab',      desc: 'Country-based identity generator hub. Select country → choose generator. ITA: Codice Fiscale. DEU: Steuer-ID.' },
    fra_cin:      { label: 'FR-CNI-GEN',  nav: 'FR-CNI',      desc: 'French CNI number generator. YY + MM + dept(2) + service(1) + serial(5) → 13-char code. ICAO 9303 weighted checksum 7-3-1.' },
    deu_tax:      { label: 'DEU-STEUER',  nav: 'DEU Tax',     desc: 'German Steueridentifikationsnummer generator. 11-digit, ISO 7064 Mod-11,10 check digit.' },
    nl_bsn:       { label: 'NL-BSN',      nav: 'NL BSN',      desc: 'Dutch Burgerservicenummer. 9-digit national ID, elfproef (Modulo 11) validation.' },
    pt_id_mrz:    { label: 'PT-ID-MRZ',   nav: 'PT ID MRZ',   desc: 'Portuguese Bilhete de Identidade MRZ. NIC Modulo-11 check digit, TD1 3-line format.' },
    pl_pesel:     { label: 'PL-PESEL',    nav: 'PL PESEL',    desc: 'Polish PESEL number. 11 digits: YYMMDD + serial (gender-encoded) + check digit.' },
    pl_doc_dates:   { label: 'PL-DOC-DATES',  nav: 'PL Doc Dates',  desc: 'Polish ID card and passport validity dates based on date of birth.' },
    ee_isikukood:   { label: 'EE-ISIKUKOOD',  nav: 'EE Isikukood',  desc: 'Estonian personal ID code. 11 digits: G·YY·MM·DD·SSS·C. Two-round Mod-11 control digit.' },
    lv_kods:        { label: 'LV-PERSONAS-KODS', nav: 'LV Kods',    desc: 'Latvian personas kods. Format DDMMYY-NNNC. Weights [1,6,3,7,9,10,5,8,4,2], Mod-11 control.' },
  } as Record<string, { label: string; nav: string; desc: string }>,
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  t() { return T; }
  module(id: string) { return T.modules[id] ?? { label: id.toUpperCase(), nav: id, desc: '' }; }
  group(key: string) { return T.groups[key] ?? key; }
}
