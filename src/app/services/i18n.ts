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
    IRELAND:     'IRELAND',
    NETHERLANDS: 'NETHERLANDS',
    FRANCE:      'FRANCE',
    TOOLS:       'TOOLS',
    GLOBAL:      'GLOBAL',
  } as Record<string, string>,

  modules: {
    energia:      { label: 'IE-BILL-GEN',   nav: 'IE-Bill',     desc: 'Irish utility bill generator. Auto-aligns fields. Scan mode adds noise and analog artifacts.' },
    ndls_mrz:     { label: 'IE-NDLS-MRZ',   nav: 'IE-MRZ',      desc: 'Real-time dual-core MRZ for Irish NDLS. Sync checksums for GEN1 and GEN2 standards.' },
    revolut:      { label: 'REVOLUT-BILL',  nav: 'Revolut BILL', desc: 'Revolut EUR statement generator. Fill holder data and one transaction. Outputs clean PDF.' },
    nld_mrz:      { label: 'NL-ID-MRZ',     nav: 'NL-MRZ',      desc: 'Netherlands TD1 ID card MRZ. Vectorized ICAO-9303 checksum math.' },
    fra_mrz:      { label: 'FR-CNI-MRZ',    nav: 'FR-MRZ',      desc: 'French CNI MRZ generator. Validates department code and CIN in real time.' },
    exif_cleaner: { label: 'EXIF-SNIPER',   nav: 'EXIF',        desc: 'Metadata injector for OnePlus 6. Spoof GPS coordinates via map selection.' },
    face_cut:     { label: 'FACE-VISION',   nav: 'Face-Cut',    desc: 'AI biometric extractor. 3×4 ratio. Adjust zoom and vertical offset for live preview.' },
    ai_bypass:    { label: 'AI-STEALTH',    nav: 'AI-Stealth',  desc: 'Camera pipeline emulator. Radial chromatic aberration, PRNU sensor noise, double JPEG, frequency domain break. Physically plausible — passes forensic AI detectors.' },
    mrz_gen:      { label: 'MRZ-FORGE',    nav: 'MRZ Forge',   desc: 'Universal ICAO 9303 MRZ generator. Passport (MRP/TD3), ID Card (TD1, TD2), Visa (MRV-A), eDL. Weighted checksum engine. All 4 formats simultaneously.' },
  } as Record<string, { label: string; nav: string; desc: string }>,
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  t() { return T; }
  module(id: string) { return T.modules[id] ?? { label: id.toUpperCase(), nav: id, desc: '' }; }
  group(key: string) { return T.groups[key] ?? key; }
}
