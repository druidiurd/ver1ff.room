import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { MrzForgeComponent } from './mrz-forge';

interface Tool {
  id: string;
  icon: string;
  label: string;
  desc: string;
  color: string;
  tag: string;
  mrzDoc?: string;
}


interface Country {
  code: string;
  iso2: string;    // lowercase ISO 3166-1 alpha-2 for flagcdn
  mrzCode: string; // ISO 3166-1 alpha-3 as used in MRZ (usually same as code)
  name: string;
  tools: Tool[];
}

const MRZ_ID: Omit<Tool, 'id'> = {
  icon: '🪪', label: 'MRZ — ID CARD',  desc: 'Universal ICAO 9303 TD1/TD2 MRZ generator pre-set for this country. Weighted checksum engine.',  color: '#a855f7', tag: 'MRZ·ID', mrzDoc: 'ID Card',
};
const MRZ_PP: Omit<Tool, 'id'> = {
  icon: '📕', label: 'MRZ — PASSPORT', desc: 'Universal ICAO 9303 TD3 MRZ generator pre-set for this country. Passport (MRP) format, 2×44 chars.', color: '#c026d3', tag: 'MRZ·PP', mrzDoc: 'Passport',
};

const COUNTRIES: Country[] = [
  {
    code: 'IRL', iso2: 'ie', mrzCode: 'IRL', name: 'Ireland',
    tools: [
      { id: 'energia',  icon: '🧾', label: 'IE-BILL-GEN', desc: 'Irish utility bill generator. Auto-aligns fields. Scan mode adds noise and analog artifacts.', color: '#00ff41', tag: 'BILL' },
      { id: 'ndls_mrz', icon: '🚗', label: 'IE-DL-MRZ',   desc: 'Real-time dual-core MRZ for Irish NDLS. Sync checksums for GEN1 and GEN2 standards.',        color: '#34c759', tag: 'MRZ'  },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'GBR', iso2: 'gb', mrzCode: 'GBR', name: 'United Kingdom',
    tools: [
      { id: 'uk_dl_gen', icon: '🚗', label: 'UK-DL-GEN', desc: 'DVLA driving licence generator. 16-char format + issue number. Encodes surname, DOB, sex, initials per official DVLA spec.', color: '#ff3b30', tag: 'DL' },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'NLD', iso2: 'nl', mrzCode: 'NLD', name: 'Netherlands',
    tools: [
      { id: 'nl_bsn',  icon: '🆔', label: 'BSN',       desc: 'Dutch Burgerservicenummer. 9-digit national ID number, elfproef (Modulo 11) validation. First digit ≠ 0.', color: '#ff9500', tag: 'BSN' },
      { id: 'nld_mrz', icon: '🪪', label: 'NL-ID-MRZ', desc: 'Netherlands TD1 ID card MRZ. Vectorized ICAO-9303 checksum math.', color: '#ff9500', tag: 'MRZ' },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'FRA', iso2: 'fr', mrzCode: 'FRA', name: 'France',
    tools: [
      { id: 'fra_cin', icon: '🆔', label: 'FR-CNI-GEN',    desc: 'French CNI number. YY + MM + dept + service + serial → 13-char ICAO 7-3-1 check digit.', color: '#007aff', tag: 'CNI' },
      { id: 'fra_mrz', icon: '🪪', label: 'FR-ID-OLD-MRZ', desc: 'French CNI MRZ generator. Validates department code and CIN in real time.', color: '#4da6ff', tag: 'MRZ' },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'ITA', iso2: 'it', mrzCode: 'ITA', name: 'Italy',
    tools: [
      { id: 'ita_cf',  icon: '🆔', label: 'CODICE FISCALE', desc: 'Italian Codice Fiscale generator. Surname + name + DOB + gender + Belfiore municipality code. 16-char code + Code 39 barcode.', color: '#007aff', tag: 'CF' },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'PRT', iso2: 'pt', mrzCode: 'PRT', name: 'Portugal',
    tools: [
      { id: 'pt_id_mrz', icon: '🪪', label: 'PT-ID-MRZ', desc: 'Portuguese Bilhete de Identidade MRZ. NIC Modulo-11 check digit + composite line-2 checksum. TD1 format.', color: '#16c784', tag: 'ID·MRZ' },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'POL', iso2: 'pl', mrzCode: 'POL', name: 'Poland',
    tools: [
      { id: 'pl_documents', icon: '📋', label: 'POLISH DOCUMENTS', desc: 'Complete Polish document suite: PESEL, passport/ID card numbers, MRZ (TD1/TD3), issue/expiry dates with names.', color: '#d946ef', tag: 'DOCS' },
      { id: 'pl_phone',     icon: '📱', label: 'PL-PHONE',  desc: 'Polish mobile numbers (50-59 prefix). Local (0XX) and international (+48XX) formats. Landline support (21-25 area codes).', color: '#e74c3c', tag: 'TEL' },
      { id: 'pl_nip',       icon: '🆔', label: 'PL-NIP', desc: 'Polish Tax ID (Numer Identyfikacji Podatkowej) - 10-digit number with checksum validation.', color: '#3498db', tag: 'TAX' },
      { id: 'pl_iban',      icon: '🏦', label: 'PL-IBAN', desc: 'Polish IBAN generator - international bank account number with IBAN checksum.', color: '#2ecc71', tag: 'BANK' },
      { id: 'pl_regon',     icon: '🏢', label: 'PL-REGON', desc: 'Polish business registration number (REGON) - 9-digit company identifier with checksum.', color: '#f39c12', tag: 'BIZ' },
    ],
  },
  {
    code: 'CAN', iso2: 'ca', mrzCode: 'CAN', name: 'Canada',
    tools: [
      { id: 'can_passport', icon: '📕', label: 'PASSPORT', desc: 'Canadian passport number generator. Basic number (XX######) + vertical number (LLL#####). Bilingual dates (EN/FR), city of birth, 10-year validity, MRZ TD3 format.', color: '#e74c3c', tag: 'PP' },
      { id: 'can_ontario_dl', icon: '🚗', label: 'ONTARIO DL', desc: 'Ontario Driver\'s License number generator. Soundex encoding: LXXXX-FFFMY-YMMDD. Encodes surname, first name, middle initial, DOB, and gender.', color: '#ff1744', tag: 'DL' },
    ],
  },
  {
    code: 'LVA', iso2: 'lv', mrzCode: 'LVA', name: 'Latvia',
    tools: [
      { id: 'lv_kods', icon: '🆔', label: 'PERSONAS KODS', desc: 'Latvian personal ID code. Format: DDMMYY-NNNC. Weights [1,6,3,7,9,10,5,8,4,2], Mod-11 control digit.', color: '#8b1a1a', tag: 'PK' },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'EST', iso2: 'ee', mrzCode: 'EST', name: 'Estonia',
    tools: [
      { id: 'ee_isikukood', icon: '🆔', label: 'ISIKUKOOD', desc: 'Estonian personal ID code. 11 digits: G·YY·MM·DD·SSS·C. Century+gender first digit, two-round Mod-11 control digit.', color: '#0072ce', tag: 'IK' },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'DEU', iso2: 'de', mrzCode: 'DEU', name: 'Germany',
    tools: [
      { id: 'deu_tax', icon: '🧾', label: 'STEUER-ID', desc: 'German Steueridentifikationsnummer. 11 digits, ISO 7064 Mod-11,10 check digit. First digit ≠ 0, exactly one digit repeats 2–3×.', color: '#ffcc00', tag: 'TAX' },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
  {
    code: 'FIN', iso2: 'fi', mrzCode: 'FIN', name: 'Finland',
    tools: [
      { id: 'fin_hetu',     icon: '🆔', label: 'HETU',         desc: 'Finnish personal ID (Henkilötunnus). DDMMYY+SSSQ format. Century marker +/-/A. Control char via mod-31 → 31-char alphabet. Gender encoded in serial parity.', color: '#2979ff', tag: 'HETU' },
      { id: 'fin_passport', icon: '📕', label: 'FI-DOC-GEN',   desc: 'Finnish passport (FP+7 digits) and ID card (9 digits) numbers with calibrated sequential counters. Issue + expiry dates (5yr validity).', color: '#29b6f6', tag: 'DOCS' },
      { id: 'fin_iban',     icon: '🏦', label: 'FI-IBAN',      desc: 'Finnish IBAN. FI + 2 check digits (mod-97) + 6-digit bank code + 8–10 digit account number. 18 chars total.', color: '#00bcd4', tag: 'IBAN' },
      { id: 'fin_phone',    icon: '📱', label: 'FI-PHONE',     desc: 'Finnish mobile (04XX prefix, 12 digits) and landline (01X/029, 10 digits) generator. Outputs local and +358 international format.', color: '#43a047', tag: 'TEL' },
      { id: 'mrz_gen', ...MRZ_ID },
      { id: 'mrz_gen', ...MRZ_PP },
    ],
  },
];

const FAV_KEY = 'id_lab_favorites';

@Component({
  selector: 'app-id-lab',
  standalone: true,
  imports: [FormsModule, DatePipe, MrzForgeComponent],
  template: `
    <div class="lab fade-in">

      <div class="lab-header">
        <div class="lab-title mono">ID_LAB</div>
        <div class="lab-sub mono">// {{ total }} COUNTRIES · {{ toolCount }} GENERATORS</div>
      </div>

      <div class="lab-body">

        <!-- LEFT: country list -->
        <div class="country-panel">

          <!-- Search -->
          <div class="search-wrap">
            <span class="search-icon mono">⌕</span>
            <input class="search-input mono" [(ngModel)]="searchTerm"
              placeholder="SEARCH_COUNTRY" autocomplete="off" spellcheck="false">
            @if (searchTerm) {
              <button class="search-clear" (click)="searchTerm = ''">✕</button>
            }
          </div>

          @if (favorites().size > 0) {
            <div class="cc-group-label mono">★ FAVORITES</div>
            @for (c of favCountries(); track c.code) {
              <button class="country-card mono"
                [class.active]="selected()?.code === c.code"
                (click)="select(c)">
                <img class="cc-flag" [src]="flagUrl(c.iso2)" [alt]="c.code" loading="lazy">
                <div class="cc-info">
                  <span class="cc-name">{{ c.name }}</span>
                  <span class="cc-code">{{ c.code }}</span>
                </div>
                <button class="cc-star active" (click)="$event.stopPropagation(); toggleFav(c.code)" title="Remove from favorites">★</button>
                <span class="cc-arrow">›</span>
              </button>
            }
            <div class="cc-divider"></div>
          }

          @if (filteredCountries().length === 0) {
            <div class="cc-empty mono">NO_MATCH</div>
          }

          @for (c of filteredCountries(); track c.code) {
            <button class="country-card mono"
              [class.active]="selected()?.code === c.code"
              (click)="select(c)">
              <img class="cc-flag" [src]="flagUrl(c.iso2)" [alt]="c.code" loading="lazy">
              <div class="cc-info">
                <span class="cc-name">{{ c.name }}</span>
                <span class="cc-code">{{ c.code }}</span>
              </div>
              <button class="cc-star" [class.active]="favorites().has(c.code)"
                (click)="$event.stopPropagation(); toggleFav(c.code)"
                [title]="favorites().has(c.code) ? 'Remove from favorites' : 'Add to favorites'">
                {{ favorites().has(c.code) ? '★' : '☆' }}
              </button>
              <span class="cc-arrow">›</span>
            </button>
          }

        </div>

        <!-- RIGHT: tool cards -->
        <div class="tool-panel">

          @if (!selected()) {
            <div class="empty-state">
              <div class="empty-globe">⬡</div>
              <div class="mono empty-label">SELECT_COUNTRY</div>
              <div class="mono empty-hint">{{ total }} countries · {{ toolCount }} generators</div>
            </div>
          }

          @if (mrzActive(); as mrz) {
            <div class="tool-area fade-in">
              <div class="tool-header">
                <img class="th-flag" [src]="flagUrl(mrz.country.iso2)" [alt]="mrz.country.code">
                <div>
                  <div class="mono th-name">{{ mrz.country.name }}</div>
                  <div class="mono th-code">{{ mrz.tool.label }}</div>
                </div>
                <button class="th-fav" style="font-size:0.8rem;letter-spacing:1px" (click)="mrzActive.set(null)">← BACK</button>
              </div>
              <div class="mrz-embed-wrap">
                <app-mrz-forge
                  [embedded]="true"
                  [preDoc]="mrz.tool.mrzDoc!"
                  [preNat]="mrz.country.mrzCode"
                  [preIss]="mrz.country.mrzCode"
                ></app-mrz-forge>
              </div>
            </div>
          }

          @if (!mrzActive() && selected(); as country) {
            <div class="tool-area fade-in">

              <div class="tool-header">
                <img class="th-flag" [src]="flagUrl(country.iso2)" [alt]="country.code">
                <div>
                  <div class="mono th-name">{{ country.name }}</div>
                  <div class="mono th-code">{{ country.code }} · {{ country.tools.length }} GENERATOR{{ country.tools.length > 1 ? 'S' : '' }}</div>
                </div>
                <button class="th-fav" [class.active]="favorites().has(country.code)"
                  (click)="toggleFav(country.code)"
                  [title]="favorites().has(country.code) ? 'Remove from favorites' : 'Add to favorites'">
                  {{ favorites().has(country.code) ? '★' : '☆' }}
                </button>
              </div>

              <div class="tool-grid">
                @for (t of country.tools; track $index) {

                  @if (t.id === 'deu_tax') {
                    <!-- Inline DEU TAX card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (taxResult()) {
                        <div class="tax-result">
                          <code class="mono tax-id">{{ taxResult() }}</code>
                          <button class="tax-copy mono" (click)="copyTax()">{{ taxCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <button class="tax-btn mono" [class.loading]="taxLoading()" (click)="genTax()"
                        [style.background]="t.color">
                        @if (taxLoading()) { <span class="tax-spin"></span> } @else { ⚡ }
                        GENERATE
                      </button>
                    </div>

                  } @else if (t.id === 'nl_bsn') {
                    <!-- Inline NL BSN card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (bsnResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(255,149,0,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color">{{ bsnResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(255,149,0,0.4)'"
                            (click)="copyBsn()">{{ bsnCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <button class="tax-btn mono" (click)="genBsn()" [style.background]="t.color">
                        ⚡ GENERATE
                      </button>
                    </div>

                  } @else if (t.id === 'pl_documents') {
                    <!-- Polish Documents: Full Width -->
                    <div class="tool-card inline-card mono pl-docs-full-width" [style.--tc]="t.color" style="position:relative">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (plDocsResult()) {
                        <button class="pl-copy-all mono" (click)="copyPlDocs('all')" [style.--tc]="t.color"
                          title="Copy all fields (for parsing)">
                          {{ plDocsCopied() === 'all' ? '✓ COPIED' : '⧉ COPY ALL' }}
                        </button>
                      }

                      <!-- All inputs in one row -->
                      <div class="il-field-row">
                        <div class="il-field">
                          <label class="il-lbl">FIRST NAME</label>
                          <input class="il-inp" [ngModel]="plDocsFirstName()" (ngModelChange)="plDocsFirstName.set($event)"
                            placeholder="John" autocomplete="off">
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">LAST NAME</label>
                          <input class="il-inp" [ngModel]="plDocsLastName()" (ngModelChange)="plDocsLastName.set($event)"
                            placeholder="Smith" autocomplete="off">
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">DOB (DD-MM-YYYY)</label>
                          <input class="il-inp" [ngModel]="plDocsDob()" (ngModelChange)="plDocsDob.set($event)"
                            placeholder="01-01-1990" maxlength="10" autocomplete="off">
                        </div>
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">SEX</label>
                          <div class="il-sex">
                            <button class="il-sex-btn" [class.active]="plDocsGender() === 'M'"
                              [style.--sc]="t.color" (click)="plDocsGender.set('M')">♂️ M</button>
                            <button class="il-sex-btn" [class.active]="plDocsGender() === 'F'"
                              [style.--sc]="t.color" (click)="plDocsGender.set('F')">♀️ F</button>
                          </div>
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">ISSUE (OPT)</label>
                          <input class="il-inp" [ngModel]="plDocsIssueDate()" (ngModelChange)="plDocsIssueDate.set($event)"
                            placeholder="DD-MM-YYYY" maxlength="10" autocomplete="off">
                        </div>
                      </div>

                      <!-- Buttons -->
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genPlDocuments()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        @if (plDocsResult()) {
                          <button class="il-btn-sm mono" (click)="plDocsResult.set(null)" style="color:#ff3b30">✕</button>
                        }
                      </div>

                      <!-- RESULTS -->
                      @if (plDocsResult(); as r) {
                        <div class="pl-results">
                          <!-- Document Numbers + Validity + Issuing Authority -->
                          <div class="pl-stats-row">
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">PESEL</span>
                              <div class="pl-stat-val" style="color:var(--green)">{{ r.pesel }}</div>
                              <button class="cp-inline" (click)="copyPlDocs('pesel')" style="font-size:0.6rem;margin-top:2px">⎘</button>
                            </div>
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">PASSPORT</span>
                              <div class="pl-stat-val" style="color:#c084f3">{{ r.passportNum }}</div>
                              <button class="cp-inline" (click)="copyPlDocs('passport')" style="font-size:0.6rem;margin-top:2px">⎘</button>
                            </div>
                            <div class="pl-stat pl-stat-wide">
                              <span class="pl-stat-lbl">VALIDITY</span>
                              <div class="pl-validity-row">
                                <code style="color:var(--green);letter-spacing:0.5px">{{ r.issueDate }}</code>
                                <span style="color:var(--text-dim)">→</span>
                                <code style="color:#c084f3;letter-spacing:0.5px">{{ r.expiryDate }}</code>
                                <span style="color:#c084f3;opacity:0.8">({{ r.validity }}y)</span>
                              </div>
                            </div>
                            <div class="pl-stat pl-stat-wide">
                              <span class="pl-stat-lbl">ISSUED BY</span>
                              <div class="pl-validity-row">
                                <code style="color:var(--text-mid)">{{ r.wojewoda }}</code>
                              </div>
                            </div>
                            <div class="pl-stat pl-stat-wide">
                              <span class="pl-stat-lbl">CITY OF BIRTH</span>
                              <div class="pl-validity-row">
                                <code style="color:var(--text-mid)">{{ r.cityOfBirth }}</code>
                              </div>
                            </div>
                          </div>

                          <!-- MRZ Blocks (with line breaks) -->
                          <div class="pl-mrz-grid">
                            <div class="pl-mrz-block pl-mrz-td1">
                              <div class="pl-mrz-hdr" style="color:var(--green)">ID CARD (TD1)</div>
                              <code class="pl-mrz-code" style="color:rgba(0,255,65,0.7)">{{ r.mrzIdCard }}</code>
                              <button class="cp-inline" (click)="copyPlDocs('mrzId')" style="margin-top:3px;font-size:0.55rem">{{ plDocsCopied() === 'mrzId' ? '✓' : '⎘' }}</button>
                            </div>
                            <div class="pl-mrz-block pl-mrz-td3">
                              <div class="pl-mrz-hdr" style="color:#c084f3">PASSPORT (TD3)</div>
                              <code class="pl-mrz-code" style="color:rgba(192,132,243,0.7)">{{ r.mrzPassport }}</code>
                              <button class="cp-inline" (click)="copyPlDocs('mrzPp')" style="margin-top:3px;font-size:0.55rem">{{ plDocsCopied() === 'mrzPp' ? '✓' : '⎘' }}</button>
                            </div>
                          </div>
                        </div>
                      }
                    </div>

                  } @else if (t.id === 'pl_nip') {
                    <!-- PL NIP card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (plNipResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(52,152,219,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:2px">{{ plNipResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(52,152,219,0.4)'"
                            (click)="copyPlNip()">{{ plNipCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <button class="tax-btn mono" (click)="genPlNip()" [style.background]="t.color" style="color:#fff">⚡ GEN</button>
                    </div>

                  } @else if (t.id === 'pl_iban') {
                    <!-- PL IBAN card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (plIbanResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(46,204,113,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:1px;font-size:0.8rem">{{ plIbanResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(46,204,113,0.4)'"
                            (click)="copyPlIban()">{{ plIbanCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <button class="tax-btn mono" (click)="genPlIban()" [style.background]="t.color" style="color:#fff">⚡ GEN</button>
                    </div>

                  } @else if (t.id === 'pl_regon') {
                    <!-- PL REGON card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (plRegonResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(243,156,18,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:3px">{{ plRegonResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(243,156,18,0.4)'"
                            (click)="copyPlRegon()">{{ plRegonCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <button class="tax-btn mono" (click)="genPlRegon()" [style.background]="t.color" style="color:#fff">⚡ GEN</button>
                    </div>

                  } @else if (t.id === 'can_ontario_dl') {
                    <!-- Canada Ontario DL -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color" style="position:relative">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>

                      <!-- Input fields -->
                      <div class="il-field-row">
                        <div class="il-field">
                          <label class="il-lbl">LAST NAME</label>
                          <input class="il-inp" [ngModel]="canLastName()" (ngModelChange)="canLastName.set($event)"
                            placeholder="Smith" autocomplete="off">
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">FIRST NAME</label>
                          <input class="il-inp" [ngModel]="canFirstName()" (ngModelChange)="canFirstName.set($event)"
                            placeholder="John" autocomplete="off">
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">MID.INIT (OPT)</label>
                          <input class="il-inp" [ngModel]="canMiddleInitial()" (ngModelChange)="canMiddleInitial.set($event)"
                            placeholder="A" maxlength="1" autocomplete="off">
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">DOB (YYYY-MM-DD)</label>
                          <input class="il-inp" [ngModel]="canDob()" (ngModelChange)="canDob.set($event)"
                            placeholder="1990-01-15" maxlength="10" autocomplete="off">
                        </div>
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">SEX</label>
                          <div class="il-sex">
                            <button class="il-sex-btn" [class.active]="canGender() === 'M'"
                              [style.--sc]="t.color" (click)="canGender.set('M')">♂️ M</button>
                            <button class="il-sex-btn" [class.active]="canGender() === 'F'"
                              [style.--sc]="t.color" (click)="canGender.set('F')">♀️ F</button>
                          </div>
                        </div>
                      </div>

                      <!-- Buttons -->
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genCanOntarioDl()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        @if (canOntarioDlResult()) {
                          <button class="il-btn-sm mono" (click)="canOntarioDlResult.set(null)" style="color:#ff3b30">✕</button>
                        }
                      </div>

                      <!-- Result -->
                      @if (canOntarioDlResult(); as r) {
                        <div class="can-dl-result" [style.border-color]="'rgba(255,23,68,0.35)'">
                          <div style="margin-bottom:8px">
                            <div style="font-size:0.65rem;color:var(--text-dim);margin-bottom:3px;letter-spacing:1px">DL NUMBER</div>
                            <code class="mono" [style.color]="t.color" style="letter-spacing:2px;font-size:1.1rem">{{ r.dlNumber }}</code>
                          </div>
                          <div>
                            <div style="font-size:0.65rem;color:var(--text-dim);margin-bottom:3px;letter-spacing:1px">DD/REF</div>
                            <code class="mono" [style.color]="t.color" style="letter-spacing:2px;font-size:0.95rem">{{ r.ddRef }}</code>
                          </div>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(255,23,68,0.4)'"
                            (click)="copyCanOntarioDl()" style="position:absolute;top:8px;right:8px">{{ canOntarioDlCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                    </div>

                  } @else if (t.id === 'can_passport') {
                    <!-- Canada Passport: Full Width -->
                    <div class="tool-card inline-card mono pl-docs-full-width" [style.--tc]="t.color" style="position:relative">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>

                      <!-- Input fields -->
                      <div class="il-field-row">
                        <div class="il-field">
                          <label class="il-lbl">FIRST NAME</label>
                          <input class="il-inp" [ngModel]="canPassFirstName()" (ngModelChange)="canPassFirstName.set($event)"
                            placeholder="John" autocomplete="off">
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">LAST NAME</label>
                          <input class="il-inp" [ngModel]="canPassLastName()" (ngModelChange)="canPassLastName.set($event)"
                            placeholder="Smith" autocomplete="off">
                        </div>
                        <div class="il-field">
                          <label class="il-lbl">DOB (DD-MM-YYYY or DD.MM.YYYY)</label>
                          <input class="il-inp" [ngModel]="canPassDob()" (ngModelChange)="canPassDob.set($event)"
                            placeholder="15-01-1990 или 15.01.1990" maxlength="10" autocomplete="off">
                        </div>
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">SEX</label>
                          <div class="il-sex">
                            <button class="il-sex-btn" [class.active]="canPassGender() === 'M'"
                              [style.--sc]="t.color" (click)="canPassGender.set('M')">♂️ M</button>
                            <button class="il-sex-btn" [class.active]="canPassGender() === 'F'"
                              [style.--sc]="t.color" (click)="canPassGender.set('F')">♀️ F</button>
                          </div>
                        </div>
                      </div>

                      <!-- Buttons -->
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genCanPassport()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        @if (canPassResult()) {
                          <button class="il-btn-sm mono" (click)="canPassResult.set(null)" style="color:#ff3b30">✕</button>
                        }
                      </div>

                      <!-- RESULTS -->
                      @if (canPassResult(); as r) {
                        <div class="pl-results">
                          <!-- Stats row -->
                          <!-- Row 1 -->
                          <div class="pl-stats-row">
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">PASSPORT #</span>
                              <div class="pl-stat-val" style="color:var(--green);font-size:0.8rem">{{ r.passportNum }}</div>
                              <button class="cp-inline" (click)="copyCanPassport('passport')" style="font-size:0.6rem;margin-top:2px">⎘</button>
                            </div>
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">VERTICAL #</span>
                              <div class="pl-stat-val" style="color:#c084f3;font-size:0.8rem">{{ r.verticalNum }}</div>
                              <div style="display:flex;gap:3px;align-items:center;margin-top:2px">
                                <button class="cp-inline" (click)="copyCanPassport('vertical')" style="font-size:0.55rem">⎘</button>
                                <div style="font-size:0.45rem;color:#999">GEN</div>
                                <button class="cp-inline" (click)="genCanPassportBarcode(r.verticalNum)" style="font-size:0.55rem">🎫</button>
                              </div>
                            </div>
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">DOB</span>
                              <div class="pl-stat-val" style="color:var(--text-mid);font-size:0.7rem">{{ r.dob }}</div>
                            </div>
                          </div>

                          <!-- Row 2 -->
                          <div class="pl-stats-row">
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">VALIDITY</span>
                              <div style="display:flex;gap:3px;font-size:0.75rem;align-items:center">
                                <code style="color:var(--green)">{{ r.issueDate }}</code>
                                <span style="color:var(--text-dim)">→</span>
                                <code style="color:#c084f3">{{ r.expiryDate }}</code>
                              </div>
                            </div>
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">CITY</span>
                              <div class="pl-stat-val" style="color:var(--text-mid);font-size:0.8rem">{{ r.cityOfBirth }}</div>
                            </div>
                            <div class="pl-stat">
                              <span class="pl-stat-lbl">AUTHORITY</span>
                              <div class="pl-stat-val" style="color:var(--text-mid);font-size:0.75rem">{{ r.issuingAuthority }}</div>
                            </div>
                          </div>

                          <!-- MRZ Block -->
                          <div class="pl-mrz-grid">
                            <div class="pl-mrz-block pl-mrz-td1">
                              <div class="pl-mrz-hdr" style="color:var(--green)">PASSPORT MRZ</div>
                              <code class="pl-mrz-code" style="color:rgba(0,255,65,0.7)">{{ r.mrzPassport }}</code>
                              <button class="cp-inline" (click)="copyCanPassport('mrz')" style="margin-top:3px;font-size:0.55rem">{{ canPassCopied() === 'mrz' ? '✓' : '⎘' }}</button>
                            </div>
                          </div>

                          <!-- Barcode Modal -->
                          @if (canPassShowBarcode() && canPassBarcodeSvg()) {
                            <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:1000;cursor:pointer" (click)="canPassShowBarcode.set(false)">
                              <div style="background:white;padding:20px;border-radius:8px;max-width:400px;cursor:default" (click)="$event.stopPropagation()">
                                <div style="font-size:0.85rem;font-weight:700;margin-bottom:12px;color:#000">CODE39: VERTICAL NUMBER</div>
                                <div style="background:#f5f5f5;padding:12px;border-radius:4px;text-align:center;overflow:auto">
                                  <img [src]="canPassBarcodeSvg()" style="max-width:100%;max-height:600px;image-rendering:pixelated" alt="CODE39 Barcode">
                                </div>
                                <div style="font-size:0.7rem;color:#666;margin-top:8px;text-align:center">{{ canPassResult()?.verticalNum }}</div>
                                <button style="width:100%;margin-top:12px;padding:8px;background:#007aff;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:0.75rem" (click)="downloadCanPassportBarcode()">📥 DOWNLOAD</button>
                              </div>
                            </div>
                          }
                        </div>

                        <!-- HISTORY -->
                        @if (canPassHistory().length > 0) {
                          <div style="margin-top:16px;border-top:1px solid rgba(0,255,65,0.2);padding-top:12px">
                            <div style="font-size:0.7rem;color:var(--green);font-weight:600;margin-bottom:8px">GENERATION HISTORY</div>
                            <div style="display:flex;flex-direction:column;gap:6px;max-height:150px;overflow-y:auto">
                              @for (item of canPassHistory(); track item.timestamp) {
                                <button
                                  style="text-align:left;background:rgba(0,255,65,0.05);border:1px solid rgba(0,255,65,0.15);border-radius:4px;padding:6px 8px;cursor:pointer;font-size:0.65rem;font-family:monospace;transition:all 0.2s;display:block;width:100%"
                                  [style.background]="hoveredHistoryIndex === item.timestamp ? 'rgba(0,255,65,0.1)' : 'rgba(0,255,65,0.05)'"
                                  (click)="loadCanPassportFromHistory(item)"
                                  (mouseenter)="hoveredHistoryIndex = item.timestamp"
                                  (mouseleave)="hoveredHistoryIndex = null">
                                  <div style="color:var(--green);font-weight:600">{{ item.passportNum }} / {{ item.verticalNum }}</div>
                                  <div style="color:#999;font-size:0.6rem">{{ item.firstName }} {{ item.lastName }} • {{ (item.timestamp | date:'HH:mm:ss') }}</div>
                                </button>
                              }
                            </div>
                          </div>
                        }
                      }
                    </div>

                  } @else if (t.id === 'ee_isikukood') {
                    <!-- Inline EE ISIKUKOOD card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (ikResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(0,114,206,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:3px">{{ ikResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(0,114,206,0.4)'"
                            (click)="copyIk()">{{ ikCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <div class="il-field-row">
                        <div class="il-field">
                          <label class="il-lbl">DOB (DD-MM-YYYY)</label>
                          <input class="il-inp" [ngModel]="ikDob()" (ngModelChange)="ikDob.set($event)"
                            placeholder="01-01-1990" maxlength="10" autocomplete="off">
                        </div>
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">SEX</label>
                          <div class="il-sex">
                            @for (g of ['M','F']; track g) {
                              <button class="il-sex-btn" [class.active]="ikGender() === g"
                                [style.--sc]="t.color" (click)="ikGender.set(g === 'M' ? 'M' : 'F')">{{ g }}</button>
                            }
                          </div>
                        </div>
                      </div>
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genIsikukood()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        <button class="il-btn-sm mono" (click)="randomIsikukood()">⚄</button>
                        <button class="il-btn-sm mono" (click)="clearIk()" style="color:#ff3b30">✕</button>
                      </div>
                    </div>

                  } @else if (t.id === 'lv_kods') {
                    <!-- Inline LV PERSONAS KODS card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (lvResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(139,26,26,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:3px">{{ lvResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(139,26,26,0.4)'"
                            (click)="copyLv()">{{ lvCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <div class="il-field">
                        <label class="il-lbl">DOB (DD-MM-YYYY)</label>
                        <input class="il-inp" [ngModel]="lvDob()" (ngModelChange)="lvDob.set($event)"
                          placeholder="01-01-1990" maxlength="10" autocomplete="off">
                      </div>
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genLvKods()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        <button class="il-btn-sm mono" (click)="randomLvKods()">⚄</button>
                        <button class="il-btn-sm mono" (click)="clearLv()" style="color:#ff3b30">✕</button>
                      </div>
                    </div>


                  } @else if (t.id === 'fin_hetu') {
                    <!-- Inline FIN HETU card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (hetuResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(41,121,255,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:3px">{{ hetuResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(41,121,255,0.4)'"
                            (click)="copyHetu()">{{ hetuCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <div class="il-field-row">
                        <div class="il-field">
                          <label class="il-lbl">DOB (DD-MM-YYYY)</label>
                          <input class="il-inp" [ngModel]="hetuDob()" (ngModelChange)="hetuDob.set($event)"
                            placeholder="01-01-1990" maxlength="10" autocomplete="off">
                        </div>
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">SEX</label>
                          <div class="il-sex">
                            @for (g of ['M','F']; track g) {
                              <button class="il-sex-btn" [class.active]="hetuGender() === g"
                                [style.--sc]="t.color" (click)="hetuGender.set(g === 'M' ? 'M' : 'F')">{{ g }}</button>
                            }
                          </div>
                        </div>
                      </div>
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genHetu()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        <button class="il-btn-sm mono" (click)="randomHetu()">⚄</button>
                        <button class="il-btn-sm mono" (click)="clearHetu()" style="color:#ff3b30">✕</button>
                      </div>
                    </div>

                  } @else if (t.id === 'fin_passport') {
                    <!-- Inline FIN PASSPORT / ID card card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (finDocResult(); as r) {
                        <div class="doc-dates-block">
                          <div class="doc-row">
                            <span class="doc-type">📕 PP</span>
                            <span class="doc-date" style="letter-spacing:1.5px;flex:1">{{ r.pp }}</span>
                            <button class="cp-inline" (click)="copyFinDoc('pp')">{{ finDocCopied() === 'pp' ? '✓' : '⎘' }}</button>
                          </div>
                          <div class="doc-row">
                            <span class="doc-type">🪪 ID</span>
                            <span class="doc-date" style="letter-spacing:1.5px;flex:1">{{ r.id }}</span>
                            <button class="cp-inline" (click)="copyFinDoc('id')">{{ finDocCopied() === 'id' ? '✓' : '⎘' }}</button>
                          </div>
                          <div class="doc-row">
                            <span class="doc-type">📅 ISS</span>
                            <span class="doc-date" style="flex:1">{{ r.issued }} → <strong>{{ r.expiry }}</strong></span>
                            <button class="cp-inline" (click)="copyFinDoc('issued')">{{ finDocCopied() === 'issued' ? '✓' : '⎘' }}</button>
                          </div>
                          <div class="doc-row">
                            <span class="doc-type">📍 CITY</span>
                            <span class="doc-date" style="flex:1">{{ r.city }}</span>
                            <button class="cp-inline" (click)="copyFinDoc('city')">{{ finDocCopied() === 'city' ? '✓' : '⎘' }}</button>
                          </div>
                        </div>
                      }
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genFinDoc()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                      </div>
                    </div>

                  } @else if (t.id === 'fin_iban') {
                    <!-- Inline FIN IBAN card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (finIbanResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(0,188,212,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:2px;font-size:0.72rem">{{ finIbanResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(0,188,212,0.4)'"
                            (click)="copyFinIban()">{{ finIbanCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genFinIban()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        <button class="il-btn-sm mono" (click)="finIbanResult.set(null)">✕</button>
                      </div>
                    </div>

                  } @else if (t.id === 'fin_phone') {
                    <!-- Inline FIN PHONE card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (finPhoneResult(); as r) {
                        <div class="doc-dates-block">
                          <div class="doc-row">
                            <span class="doc-type">LOCAL</span>
                            <span class="doc-date" style="letter-spacing:1.5px;color:var(--text-mid)">{{ r.local }}</span>
                          </div>
                          <div class="doc-row">
                            <span class="doc-type">INTERNATIONAL</span>
                            <span class="doc-date" [style.color]="t.color" style="letter-spacing:1px">{{ r.intl }}</span>
                          </div>
                        </div>
                      }
                      <div class="il-field-row" style="gap:6px">
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">TYPE</label>
                          <div class="il-sex">
                            @for (tp of ['MOB','LINE']; track tp) {
                              <button class="il-sex-btn" [class.active]="finPhoneType() === tp"
                                [style.--sc]="t.color" (click)="finPhoneType.set(tp === 'MOB' ? 'MOB' : 'LINE')">{{ tp }}</button>
                            }
                          </div>
                        </div>
                      </div>
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genFinPhone()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        @if (finPhoneResult()) {
                          <button class="il-btn-sm mono" style="font-size:0.42rem;min-width:38px" (click)="copyFinPhone('local')">{{ finPhoneCopied() === 'local' ? '✓' : 'LOC' }}</button>
                          <button class="il-btn-sm mono" style="font-size:0.42rem;min-width:38px" (click)="copyFinPhone('intl')">{{ finPhoneCopied() === 'intl' ? '✓' : '+358' }}</button>
                        }
                        <button class="il-btn-sm mono" (click)="finPhoneResult.set(null)" style="color:#ff3b30">✕</button>
                      </div>
                    </div>

                  } @else if (t.id === 'pl_phone') {
                    <!-- Polish Phone Generator -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>

                      <!-- TYPE SELECTOR -->
                      <div class="il-field-row">
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">TYPE</label>
                          <div class="il-sex">
                            @for (tp of ['MOB','LINE']; track tp) {
                              <button class="il-sex-btn" [class.active]="plPhoneType() === tp"
                                [style.--sc]="t.color" (click)="plPhoneType.set(tp === 'MOB' ? 'MOB' : 'LINE')">{{ tp }}</button>
                            }
                          </div>
                        </div>
                      </div>

                      <!-- BUTTON -->
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genPlPhone()" [style.background]="t.color" style="flex:2;color:#fff">⚡ GEN</button>
                        @if (plPhoneResult()) {
                          <button class="il-btn-sm mono" (click)="plPhoneResult.set(null)" style="color:#ff3b30">✕</button>
                        }
                      </div>

                      <!-- RESULT -->
                      @if (plPhoneResult(); as r) {
                        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:0.8rem;display:flex;flex-direction:column;gap:6px">
                          <div style="display:flex;justify-content:space-between;align-items:center">
                            <span style="color:var(--text-dim)">LOCAL</span>
                            <code style="letter-spacing:1px;color:var(--text)">{{ r.local }}</code>
                            <button class="cp-inline" (click)="copyPlPhone('local')" style="font-size:0.6rem">{{ plPhoneCopied() === 'local' ? '✓' : '⎘' }}</button>
                          </div>
                          <div style="display:flex;justify-content:space-between;align-items:center">
                            <span style="color:var(--text-dim)">INTL</span>
                            <code [style.color]="t.color" style="letter-spacing:1px">{{ r.intl }}</code>
                            <button class="cp-inline" (click)="copyPlPhone('intl')" style="font-size:0.6rem">{{ plPhoneCopied() === 'intl' ? '✓' : '⎘' }}</button>
                          </div>
                        </div>
                      }
                    </div>

                  } @else if (t.id === 'pl_passport') {
                  } @else {
                    <button class="tool-card mono" [style.--tc]="t.color" (click)="open(t, country)">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      <div class="tc-desc">{{ t.desc }}</div>
                      <div class="tc-launch mono">LAUNCH →</div>
                    </button>
                  }

                }
              </div>

            </div>
          }

        </div>
      </div>
    </div>
  `,
  styles: [`
    .lab {
      max-width: 1100px; margin: 0 auto;
      display: flex; flex-direction: column; gap: 24px;
    }

    .lab-header { padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .lab-title {
      font-size: clamp(1.1rem, 3vw, 1.6rem);
      font-weight: 800; color: var(--green); letter-spacing: 6px;
      text-shadow: 0 0 20px var(--green-glow);
    }
    .lab-sub { font-size: 0.55rem; color: var(--text-dim); letter-spacing: 2px; margin-top: 6px; }

    .lab-body { display: flex; gap: 16px; min-height: 500px; }

    /* Country panel */
    .country-panel {
      width: 200px; flex-shrink: 0;
      display: flex; flex-direction: column; gap: 5px;
    }

    /* Search */
    .search-wrap {
      position: relative; display: flex; align-items: center;
      margin-bottom: 4px;
    }
    .search-icon {
      position: absolute; left: 10px;
      font-size: 1rem; color: var(--text-dim); pointer-events: none;
      line-height: 1;
    }
    .search-input {
      width: 100%; padding: 8px 28px 8px 28px;
      background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--green);
      font-size: 0.55rem; font-weight: 700; letter-spacing: 1px;
      outline: none; box-sizing: border-box; transition: border-color 0.15s;
    }
    .search-input:focus { border-color: var(--border-green); }
    .search-input::placeholder { color: rgba(255,255,255,0.2); }
    .search-clear {
      position: absolute; right: 8px;
      background: none; border: none; color: var(--text-dim);
      cursor: pointer; font-size: 0.6rem; padding: 2px;
      line-height: 1;
    }
    .search-clear:hover { color: var(--text); }

    .cc-group-label {
      font-size: 0.45rem; font-weight: 700; color: var(--green);
      letter-spacing: 2px; padding: 6px 4px 2px;
    }
    .cc-divider {
      height: 1px; background: var(--border); margin: 4px 0;
    }
    .cc-empty {
      font-size: 0.55rem; color: var(--text-dim); letter-spacing: 2px;
      padding: 16px 8px; text-align: center; opacity: 0.5;
    }

    .country-card {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 12px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: var(--radius); cursor: pointer; text-align: left;
      transition: border-color 0.15s, background 0.15s; width: 100%;
      flex-shrink: 0;
    }
    .country-card:hover { border-color: var(--border-green); background: rgba(0,255,65,0.02); }
    .country-card.active { border-color: var(--green); background: var(--green-dim); }

    .cc-flag {
      width: 24px; height: 16px; object-fit: cover;
      border-radius: 2px; flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .cc-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .cc-name { font-size: 0.58rem; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cc-code { font-size: 0.45rem; color: var(--text-dim); letter-spacing: 2px; }

    .cc-star {
      background: none; border: none; cursor: pointer;
      font-size: 0.75rem; color: var(--text-dim); padding: 0 2px;
      flex-shrink: 0; transition: color 0.15s; line-height: 1;
    }
    .cc-star:hover { color: #ffcc00; }
    .cc-star.active { color: #ffcc00; }

    .cc-arrow { font-size: 0.85rem; color: var(--text-dim); transition: color 0.15s; flex-shrink: 0; }
    .country-card.active .cc-arrow,
    .country-card:hover .cc-arrow { color: var(--green); }

    /* Tool panel */
    .tool-panel {
      flex: 1; min-width: 0;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex; flex-direction: column; overflow: hidden;
    }

    .empty-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 10px;
    }
    .empty-globe { font-size: 2.5rem; opacity: 0.12; }
    .empty-label { font-size: 0.65rem; letter-spacing: 4px; color: var(--text-dim); opacity: 0.3; }
    .empty-hint { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 2px; opacity: 0.2; }

    .tool-area { display: flex; flex-direction: column; height: 100%; }
    .mrz-embed-wrap { flex: 1; overflow-y: auto; }

    .tool-header {
      display: flex; align-items: center; gap: 14px;
      padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .th-flag { width: 40px; height: 27px; object-fit: cover; border-radius: 3px; border: 1px solid rgba(255,255,255,0.1); }
    .th-name { font-size: 0.72rem; font-weight: 800; color: var(--text); letter-spacing: 1.5px; }
    .th-code { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 2px; margin-top: 3px; }
    .th-fav {
      margin-left: auto; background: none; border: none; cursor: pointer;
      font-size: 1.2rem; color: var(--text-dim); padding: 4px 8px;
      transition: color 0.15s;
    }
    .th-fav:hover { color: #ffcc00; }
    .th-fav.active { color: #ffcc00; }

    /* Tool cards grid */
    .tool-grid {
      padding: 20px; display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px; overflow-y: auto;
    }

    .tool-card {
      display: flex; flex-direction: column; gap: 12px;
      padding: 24px;
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      cursor: pointer; text-align: left;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
      position: relative; overflow: hidden;
    }
    .tool-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--tc) 40%), transparent);
      opacity: 0.4;
    }
    .tool-card:hover {
      border-color: color-mix(in srgb, var(--tc) 30%, rgba(255,255,255,0.08));
      background: rgba(0,0,0,0.2);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--tc) 10%, transparent);
      transform: translateY(-2px);
    }

    .tc-top { display: flex; align-items: center; justify-content: space-between; }
    .tc-icon { font-size: 1.5rem; line-height: 1; }
    .tc-tag {
      font-size: 0.45rem; font-weight: 800; letter-spacing: 1.5px;
      padding: 3px 8px; border-radius: 3px;
      background: color-mix(in srgb, var(--tc) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--tc) 30%, transparent);
    }
    .tc-label { font-size: 0.8rem; font-weight: 800; letter-spacing: 2px; line-height: 1.2; }
    .tc-desc { font-size: 0.52rem; color: var(--text-dim); line-height: 1.6; flex: 1; }
    .tc-launch {
      font-size: 0.5rem; font-weight: 700; letter-spacing: 2px;
      color: var(--text-dim); transition: color 0.15s;
      padding-top: 6px; border-top: 1px solid var(--border);
    }
    .tool-card:hover .tc-launch { color: var(--tc); }

    /* Inline tax card */
    .inline-card { cursor: default; }
    .inline-card:hover { transform: none; }

    /* Polish Documents - full width */
    .pl-docs-full-width {
      grid-column: 1 / -1;
    }

    .pl-copy-all {
      position: absolute; top: 12px; right: 12px;
      background: rgba(0,0,0,0.6); border: 1px solid var(--tc, var(--green));
      color: var(--tc, var(--green)); font-size: 0.48rem; font-weight: 800;
      letter-spacing: 0.5px; padding: 4px 8px; border-radius: var(--radius-sm);
      cursor: pointer; transition: 0.15s; font-family: inherit;
      z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .pl-copy-all:hover { background: var(--tc, var(--green)); color: #000; }

    .pl-results {
      margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border);
      display: flex; flex-direction: column; gap: 10px; font-size: 0.8rem;
    }
    .pl-stats-row {
      display: flex; gap: 10px; flex-wrap: nowrap; overflow-x: auto;
    }
    .pl-stat {
      background: rgba(0,0,0,0.35); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 8px 10px;
      display: flex; flex-direction: column; gap: 3px;
      min-width: 180px; flex-shrink: 0;
    }
    .pl-stat-wide { min-width: 240px; }
    .pl-stat-lbl { color: var(--text-dim); font-size: 0.6rem; letter-spacing: 1px; }
    .pl-stat-val { letter-spacing: 1px; font-size: 0.85rem; font-weight: 700; }
    .pl-validity-row {
      display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
      font-size: 0.7rem; margin-top: 1px;
    }

    .pl-mrz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .pl-mrz-block {
      border-radius: var(--radius-sm); padding: 8px 10px;
    }
    .pl-mrz-td1 { border: 1px solid rgba(0,255,65,0.22); background: rgba(0,255,65,0.045); }
    .pl-mrz-td3 { border: 1px solid rgba(192,132,243,0.22); background: rgba(192,132,243,0.045); }
    .pl-mrz-hdr { font-weight: 700; margin-bottom: 4px; font-size: 0.65rem; letter-spacing: 0.5px; }
    .pl-mrz-code {
      letter-spacing: 0.4px; line-height: 1.7; white-space: pre-wrap;
      word-break: break-all; display: block; font-size: 0.58rem;
    }

    @media (max-width: 767px) {
      .pl-stats-row { flex-wrap: wrap; }
      .pl-stat { min-width: 150px; }
      .pl-stat-wide { min-width: 150px; }
      .pl-mrz-grid { grid-template-columns: 1fr; }
      .pl-copy-all { position: static; margin-top: 6px; width: 100%; }
    }

    .tax-result {
      display: flex; align-items: center; gap: 8px;
      background: rgba(0,0,0,0.5); border: 1px solid rgba(255,204,0,0.3);
      border-radius: var(--radius-sm); padding: 8px 12px;
    }
    .tax-id {
      flex: 1; font-size: 0.9rem; color: #ffcc00;
      letter-spacing: 4px; font-weight: 700;
    }
    .tax-copy {
      background: rgba(255,204,0,0.1); border: 1px solid rgba(255,204,0,0.3);
      color: #ffcc00; font-size: 0.48rem; font-weight: 700;
      padding: 3px 8px; border-radius: 4px; cursor: pointer;
      letter-spacing: 1px; transition: 0.15s; flex-shrink: 0;
    }
    .tax-copy:hover { background: rgba(255,204,0,0.2); }

    .can-dl-result {
      position: relative;
      background: rgba(0,0,0,0.5); border: 1px solid rgba(255,23,68,0.3);
      border-radius: var(--radius-sm); padding: 12px 12px 12px 12px;
      margin-top: 8px;
    }

    .tax-btn {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 9px 16px; background: #ffcc00; color: #000;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.6rem; font-weight: 800; letter-spacing: 2px;
      cursor: pointer; transition: 0.15s; width: 100%;
    }
    .tax-btn:hover:not(.loading) { filter: brightness(1.1); }
    .tax-btn.loading { opacity: 0.6; cursor: not-allowed; }
    .tax-spin {
      width: 10px; height: 10px;
      border: 2px solid rgba(0,0,0,0.3); border-top-color: #000;
      border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Inline field helpers */
    .il-field { display: flex; flex-direction: column; gap: 4px; }
    .il-field-sm { flex-shrink: 0; }
    .il-field-row { display: flex; gap: 8px; align-items: flex-end; }
    .il-lbl { font-size: 0.44rem; font-weight: 700; color: var(--text-dim); letter-spacing: 1px; }
    .il-inp {
      width: 100%; box-sizing: border-box;
      background: rgba(0,0,0,0.5); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 7px 10px;
      color: var(--text); font-size: 0.75rem; font-weight: 700;
      outline: none; transition: border-color 0.15s;
    }
    .il-inp:focus { border-color: var(--tc); }
    .il-inp::placeholder { color: rgba(255,255,255,0.5); font-family: inherit; }
    .il-sex { display: flex; gap: 4px; }
    .il-sex-btn {
      padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm);
      background: rgba(0,0,0,0.4); color: var(--text-dim); font-size: 0.65rem; font-weight: 800;
      cursor: pointer; transition: 0.15s;
    }
    .il-sex-btn.active { border-color: var(--sc, var(--green)); color: var(--sc, var(--green)); background: rgba(0,0,0,0.6); }
    .il-btn-row { display: flex; gap: 6px; align-items: stretch; }
    .il-btn-sm {
      padding: 0 12px; background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim); font-size: 0.75rem;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .il-btn-sm:hover { border-color: var(--border-green); color: var(--green); }
    .il-hist { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
    .il-hist-row {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 8px; background: rgba(0,0,0,0.3);
      border: 1px solid var(--border); border-radius: 4px;
    }
    .il-hist-code { flex: 1; font-size: 0.6rem; color: var(--text-dim); letter-spacing: 2px; }
    .il-hist-cpy {
      background: none; border: 1px solid var(--border); color: var(--text-dim);
      font-size: 0.42rem; padding: 2px 6px; border-radius: 3px; cursor: pointer;
    }
    .il-hist-cpy:hover { border-color: var(--border-green); color: var(--green); }

    /* PL doc dates */
    .doc-dates-block {
      display: flex; flex-direction: column; gap: 6px;
      background: rgba(0,0,0,0.4); border: 1px solid rgba(255,107,53,0.25);
      border-radius: var(--radius-sm); padding: 10px 12px;
    }
    .doc-row { display: flex; align-items: center; gap: 6px; }
    .doc-type { font-size: 0.45rem; color: var(--text-dim); letter-spacing: 1px; white-space: nowrap; }
    .doc-date { font-size: 0.65rem; color: var(--text-mid); letter-spacing: 1px; }
    .cp-inline {
      flex-shrink: 0; background: none; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 4px; color: var(--text-dim); font-size: 0.55rem;
      padding: 1px 5px; cursor: pointer; line-height: 1.4;
      transition: color .15s, border-color .15s;
    }
    .cp-inline:hover { color: var(--text-mid); border-color: rgba(255,255,255,0.35); }
    .doc-date strong { color: #ff6b35; }

    @media (max-width: 767px) {
      .lab-body { flex-direction: column; }
      .country-panel { width: 100%; }
      .tool-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class IdLabComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  countries = COUNTRIES;
  total = COUNTRIES.length;
  toolCount = COUNTRIES.reduce((s, c) => s + c.tools.length, 0);

  selected = signal<Country | null>(null);
  searchTerm = '';

  favorites = signal<Set<string>>(this.loadFavs());

  taxResult = signal<string | null>(null);
  taxLoading = signal(false);
  taxCopied = signal(false);

  // NL BSN
  bsnResult = signal<string | null>(null);
  bsnCopied = signal(false);

  // PL PESEL
  peselDob    = signal('');
  peselGender = signal<'M' | 'F'>('M');
  peselResult = signal<string | null>(null);
  peselCopied = signal(false);
  peselHist   = signal<{ code: string; ts: number }[]>(this.loadPeselHist());

  // EE ISIKUKOOD
  ikDob    = signal('');
  ikGender = signal<'M' | 'F'>('M');
  ikResult = signal<string | null>(null);
  ikCopied = signal(false);

  // LV PERSONAS KODS
  lvDob    = signal('');
  lvResult = signal<string | null>(null);
  lvCopied = signal(false);


  // PL DOC DATES
  docDob     = signal('');
  docResult  = signal<{ idIssue: string; idExpiry: string; idYrs: number; ppIssue: string; ppExpiry: string; ppYrs: number } | null>(null);
  docCopied  = signal(false);

  // FIN HETU
  hetuDob    = signal('');
  hetuGender = signal<'M' | 'F'>('M');
  hetuResult = signal<string | null>(null);
  hetuCopied = signal(false);

  // FIN PASSPORT / ID CARD
  finDocResult  = signal<{ pp: string; id: string; issued: string; expiry: string; city: string } | null>(null);
  finDocCopied  = signal<'pp'|'id'|'issued'|'city'|null>(null);

  // FIN IBAN
  finIbanResult = signal<string | null>(null);
  finIbanCopied = signal(false);

  // FIN PHONE
  finPhoneType        = signal<'MOB' | 'LINE'>('MOB');
  finPhoneResult      = signal<{ local: string; intl: string } | null>(null);
  finPhoneCopied      = signal<'local' | 'intl' | null>(null);

  // PL PHONE
  plPhoneType         = signal<'MOB' | 'LINE'>('MOB');
  plPhoneResult       = signal<{ local: string; intl: string } | null>(null);
  plPhoneCopied       = signal<'local' | 'intl' | null>(null);

  // PL DOCUMENTS (unified)
  plDocsFirstName     = signal('');
  plDocsLastName      = signal('');
  plDocsDob           = signal('');
  plDocsIssueDate     = signal('');
  plDocsGender        = signal<'M' | 'F'>('M');
  plDocsResult        = signal<{ pesel: string; passportNum: string; wojewoda: string; cityOfBirth: string; issueDate: string; expiryDate: string; issueDateISO: string; expiryDateISO: string; validity: number; mrzIdCard: string; mrzPassport: string; firstName: string; lastName: string; dob: string; gender: 'M' | 'F' } | null>(null);
  plDocsCopied        = signal<'pesel' | 'passport' | 'mrzId' | 'mrzPp' | 'all' | null>(null);

  // PL NIP (Tax ID)
  plNipResult         = signal<string | null>(null);
  plNipCopied         = signal(false);

  // PL IBAN
  plIbanResult        = signal<string | null>(null);
  plIbanCopied        = signal(false);

  // PL REGON (Company Registration)
  plRegonResult       = signal<string | null>(null);
  plRegonCopied       = signal(false);

  // CAN ONTARIO DL
  canLastName         = signal('');
  canFirstName        = signal('');
  canMiddleInitial    = signal('');
  canDob              = signal('');  // YYYY-MM-DD
  canGender           = signal<'M' | 'F'>('M');
  canOntarioDlResult  = signal<{ dlNumber: string; ddRef: string } | null>(null);
  canOntarioDlCopied  = signal(false);

  // CAN PASSPORT
  canPassFirstName    = signal('');
  canPassLastName     = signal('');
  canPassDob          = signal('');  // DD-MM-YYYY
  canPassGender       = signal<'M' | 'F'>('M');
  canPassResult       = signal<{ passportNum: string; verticalNum: string; issueDate: string; expiryDate: string; issueDateISO: string; expiryDateISO: string; cityOfBirth: string; firstName: string; lastName: string; dob: string; gender: 'M' | 'F'; mrzPassport: string; issuingAuthority: string } | null>(null);
  canPassCopied       = signal<'passport' | 'vertical' | 'mrz' | 'all' | null>(null);
  canPassBarcodeSvg   = signal<string | null>(null);
  canPassShowBarcode  = signal(false);
  canPassHistory      = signal<Array<{ passportNum: string; verticalNum: string; firstName: string; lastName: string; timestamp: number }>>([]);
  hoveredHistoryIndex: number | null = null;

  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('country');
    if (code) {
      const c = COUNTRIES.find(x => x.code === code);
      if (c) this.selected.set(c);
    }

    // Load CAN passport history from localStorage
    try {
      const stored = localStorage.getItem('can_passport_history');
      if (stored) {
        const history = JSON.parse(stored);
        if (Array.isArray(history)) {
          this.canPassHistory.set(history.slice(-10)); // Keep last 10
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  filteredCountries = computed(() => {
    const q = this.searchTerm.toLowerCase().trim();
    return COUNTRIES.filter(c =>
      !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  favCountries = computed(() =>
    COUNTRIES.filter(c => this.favorites().has(c.code))
  );

  flagUrl(iso2: string): string {
    return `https://flagcdn.com/32x24/${iso2}.png`;
  }

  mrzActive = signal<{ country: Country; tool: Tool } | null>(null);

  select(c: Country) {
    this.selected.set(c);
    this.mrzActive.set(null);
    this.router.navigate([], { queryParams: { country: c.code }, replaceUrl: true });
  }

  open(tool: Tool, country: Country) {
    if (tool.mrzDoc) {
      this.mrzActive.set({ country, tool });
      return;
    }
    const base = { from: 'id_lab', country: country.code, iso2: country.iso2, cname: country.name };
    this.router.navigate(['/tool', tool.id], { queryParams: base });
  }

  toggleFav(code: string) {
    const s = new Set(this.favorites());
    s.has(code) ? s.delete(code) : s.add(code);
    this.favorites.set(s);
    localStorage.setItem(FAV_KEY, JSON.stringify([...s]));
  }

  genTax() {
    this.taxLoading.set(true);
    const fd = new FormData();
    fd.append('type', 'deu_tax');
    fd.append('lines', '[]');
    this.http.post<{ STATUS: string; TAX_ID: string }>('/api/execute', fd).subscribe({
      next: r => { this.taxResult.set(r.TAX_ID); this.taxLoading.set(false); },
      error: () => this.taxLoading.set(false),
    });
  }

  copyTax() {
    const v = this.taxResult();
    if (!v) return;
    navigator.clipboard.writeText(v);
    this.taxCopied.set(true);
    setTimeout(() => this.taxCopied.set(false), 1500);
  }

  // ── NL BSN ──────────────────────────────────────────────────────
  genBsn() {
    let bsn = '';
    while (true) {
      const d = Array.from({ length: 8 }, (_, i) =>
        i === 0 ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 10)
      );
      const weights = [9, 8, 7, 6, 5, 4, 3, 2];
      const s = d.reduce((acc, v, i) => acc + v * weights[i], 0);
      const last = s % 11;
      if (last <= 9) { bsn = d.join('') + last; break; }
    }
    this.bsnResult.set(bsn);
  }
  copyStr(s: string) {
    navigator.clipboard.writeText(s);
  }
  copyBsn() {
    const v = this.bsnResult(); if (!v) return;
    navigator.clipboard.writeText(v);
    this.bsnCopied.set(true); setTimeout(() => this.bsnCopied.set(false), 1500);
  }

  // ── EE ISIKUKOOD ──────────────────────────────────────────────────
  genIsikukood() {
    const dob = this.ikDob();
    const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return;
    const [, dd, mm, yyyy] = m;
    const year = parseInt(yyyy), month = parseInt(mm), day = parseInt(dd);
    if (!day || !month || !year) return;
    const gender = this.ikGender() === 'M' ? 1 : 2;
    let g: number;
    if (year >= 1800 && year <= 1899) g = gender === 1 ? 1 : 2;
    else if (year >= 1900 && year <= 1999) g = gender === 1 ? 3 : 4;
    else if (year >= 2000 && year <= 2099) g = gender === 1 ? 5 : 6;
    else return;
    const yy = String(year).slice(2);
    const mo = mm;
    const dy = dd;
    const serial = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const base = `${g}${yy}${mo}${dy}${serial}`;
    const cd = this.isikukoodCd(base);
    this.ikResult.set(base + cd);
  }
  private isikukoodCd(base10: string): string {
    const W1 = [1,2,3,4,5,6,7,8,9,1];
    const W2 = [3,4,5,6,7,8,9,1,2,3];
    const s1 = base10.split('').reduce((acc, c, i) => acc + parseInt(c) * W1[i], 0);
    const r1 = s1 % 11;
    if (r1 < 10) return String(r1);
    const s2 = base10.split('').reduce((acc, c, i) => acc + parseInt(c) * W2[i], 0);
    const r2 = s2 % 11;
    return r2 < 10 ? String(r2) : '0';
  }
  randomIsikukood() {
    const yr = 1960 + Math.floor(Math.random() * 45);
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const dy = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    this.ikDob.set(`${dy}-${mo}-${yr}`);
    this.ikGender.set(Math.random() > 0.5 ? 'M' : 'F');
    this.genIsikukood();
  }
  clearIk() { this.ikDob.set(''); this.ikResult.set(null); }
  copyIk() {
    const v = this.ikResult(); if (!v) return;
    navigator.clipboard.writeText(v);
    this.ikCopied.set(true); setTimeout(() => this.ikCopied.set(false), 1500);
  }

  // ── LV PERSONAS KODS ──────────────────────────────────────────────
  // Format: DDMMYY-NNNC (10 digits), control = (1 - sum(d*w)) mod 10 with weights [1,6,3,7,9,10,5,8,4,2]
  genLvKods() {
    const dob = this.lvDob();
    const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return;
    const [, dd, mm, yyyy] = m;
    const yy = String(parseInt(yyyy)).slice(2).padStart(2, '0');
    const serial = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const base9 = `${dd}${mm}${yy}${serial}`;  // 9 chars before check
    const cd = this.lvKodsCd(base9);
    if (cd === null) { this.genLvKods(); return; }  // regenerate on invalid
    this.lvResult.set(`${dd}${mm}${yy}-${serial}${cd}`);
  }
  private lvKodsCd(base9: string): string | null {
    const W = [1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const sum = base9.split('').reduce((acc, c, i) => acc + parseInt(c) * W[i], 0);
    const cd = (1 - (sum % 11) + 11) % 11;
    return cd === 10 ? null : String(cd % 10);
  }
  randomLvKods() {
    const yr = 1960 + Math.floor(Math.random() * 45);
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const dy = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    this.lvDob.set(`${dy}-${mo}-${yr}`);
    this.genLvKods();
  }
  clearLv() { this.lvDob.set(''); this.lvResult.set(null); }
  copyLv() {
    const v = this.lvResult(); if (!v) return;
    navigator.clipboard.writeText(v);
    this.lvCopied.set(true); setTimeout(() => this.lvCopied.set(false), 1500);
  }

  // ── PL PESEL ─────────────────────────────────────────────────────
  genPesel() {
    const dob = this.peselDob();
    const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return;
    const [, dd, mm, yyyy] = m;
    const year = parseInt(yyyy), month = parseInt(mm), day = parseInt(dd);
    if (!day || !month || !year) return;
    const yy = year % 100;
    let mp = month;
    if (year >= 1800 && year <= 1899) mp += 80;
    else if (year >= 2000 && year <= 2099) mp += 20;
    else if (year >= 2100 && year <= 2199) mp += 40;
    else if (year >= 2200 && year <= 2299) mp += 60;
    const datePart = `${String(yy).padStart(2, '0')}${String(mp).padStart(2, '0')}${dd}`;
    const s1 = Math.floor(Math.random() * 10);
    const s2 = Math.floor(Math.random() * 10);
    const s3 = Math.floor(Math.random() * 10);
    const pool = this.peselGender() === 'M' ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];
    const s4 = pool[Math.floor(Math.random() * 5)];
    const serial = `${s1}${s2}${s3}${s4}`;
    const base = datePart + serial;
    const W = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const sum = base.split('').reduce((acc, c, i) => acc + parseInt(c) * W[i], 0);
    const cd = (10 - sum % 10) % 10;
    const result = base + cd;
    this.peselResult.set(result);
    this.savePeselHist(result);
  }
  randomPesel() {
    const yr = 1960 + Math.floor(Math.random() * 45);
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const dy = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    this.peselDob.set(`${dy}-${mo}-${yr}`);
    this.peselGender.set(Math.random() > 0.5 ? 'M' : 'F');
    this.genPesel();
  }
  clearPesel() { this.peselDob.set(''); this.peselResult.set(null); }
  copyPesel() {
    const v = this.peselResult(); if (!v) return;
    navigator.clipboard.writeText(v);
    this.peselCopied.set(true); setTimeout(() => this.peselCopied.set(false), 1500);
  }
  private savePeselHist(code: string) {
    const next = [{ code, ts: Date.now() }, ...this.peselHist().filter(h => h.code !== code)].slice(0, 5);
    this.peselHist.set(next);
    localStorage.setItem('pl_pesel_history', JSON.stringify(next));
  }
  private loadPeselHist(): { code: string; ts: number }[] {
    try { return JSON.parse(localStorage.getItem('pl_pesel_history') || '[]'); } catch { return []; }
  }

  // ── PL DOC DATES ─────────────────────────────────────────────────
  genDocDates() {
    const dob = this.docDob();
    const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return;
    const [, dd, mm, yyyy] = m;
    const birth = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    const today = new Date();
    const age = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 86400000));
    if (age < 0 || age > 120) return;
    const maxYrsAgo = Math.min(9, age);
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    const rndIssue = () => {
      const ago = Math.random() * maxYrsAgo * 365.25 * 86400000;
      return new Date(today.getTime() - ago);
    };
    const idIss = rndIssue();
    const idAgeAtIss = Math.floor((idIss.getTime() - birth.getTime()) / (365.25 * 86400000));
    const idYrs = idAgeAtIss < 12 ? 5 : 10;
    const idExp = new Date(idIss.getFullYear() + idYrs, idIss.getMonth(), idIss.getDate());
    const ppIss = rndIssue();
    const ppAgeAtIss = Math.floor((ppIss.getTime() - birth.getTime()) / (365.25 * 86400000));
    const ppYrs = ppAgeAtIss < 12 ? 5 : 10;
    const ppExp = new Date(ppIss.getFullYear() + ppYrs, ppIss.getMonth(), ppIss.getDate());
    this.docResult.set({ idIssue: fmt(idIss), idExpiry: fmt(idExp), idYrs, ppIssue: fmt(ppIss), ppExpiry: fmt(ppExp), ppYrs });
  }
  randomDocDob() {
    const yr = 1960 + Math.floor(Math.random() * 45);
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const dy = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    this.docDob.set(`${dy}-${mo}-${yr}`);
    this.genDocDates();
  }
  copyDoc() {
    const r = this.docResult(); if (!r) return;
    const text = `ID: ${r.idIssue} → ${r.idExpiry}\nPP: ${r.ppIssue} → ${r.ppExpiry}`;
    navigator.clipboard.writeText(text);
    this.docCopied.set(true); setTimeout(() => this.docCopied.set(false), 1500);
  }


  // ── FIN HETU (Henkilötunnus) ─────────────────────────────────────
  // Format: DDMMYY[+/-/A]SSSQ
  // Control char: (DDMMYY+SSS as integer) mod 31 → CHECKSUM_LETTERS[index]
  private readonly HETU_LETTERS = '0123456789ABCDEFHJKLMNPRSTUVWXY';

  private hetuCd(ddmmyy: string, serial: string): string {
    const num = parseInt(ddmmyy + serial, 10);
    return this.HETU_LETTERS[num % 31];
  }

  genHetu() {
    const m = this.hetuDob().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return;
    const [, dd, mm, yyyy] = m;
    const year = parseInt(yyyy);
    let century: string;
    if (year >= 1800 && year <= 1899) century = '+';
    else if (year >= 1900 && year <= 1999) century = '-';
    else century = 'A';
    const yy = String(year % 100).padStart(2, '0');
    const ddmmyy = `${dd}${mm}${yy}`;
    // Serial: 3 digits, last digit odd=M even=F
    const base = Math.floor(Math.random() * 100);
    const parity = this.hetuGender() === 'M'
      ? (Math.floor(Math.random() * 5) * 2 + 1)  // odd: 1,3,5,7,9
      : (Math.floor(Math.random() * 5) * 2);       // even: 0,2,4,6,8
    const serial = String(base).padStart(2, '0') + parity;
    const cd = this.hetuCd(ddmmyy, serial);
    this.hetuResult.set(`${ddmmyy}${century}${serial}${cd}`);
  }
  randomHetu() {
    const yr = 1960 + Math.floor(Math.random() * 45);
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const dy = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    this.hetuDob.set(`${dy}-${mo}-${yr}`);
    this.hetuGender.set(Math.random() > 0.5 ? 'M' : 'F');
    this.genHetu();
  }
  clearHetu() { this.hetuDob.set(''); this.hetuResult.set(null); }
  copyHetu() {
    const v = this.hetuResult(); if (!v) return;
    navigator.clipboard.writeText(v);
    this.hetuCopied.set(true); setTimeout(() => this.hetuCopied.set(false), 1500);
  }

  private readonly FIN_CITIES = [
    'Helsinki','Espoo','Vantaa','Tampere','Turku','Oulu','Jyväskylä','Kuopio',
    'Lahti','Pori','Vaasa','Seinäjoki','Rovaniemi','Savonlinna','Joensuu',
    'Hämeenlinna','Lappeenranta','Hyvinkää','Mikkeli','Porvoo','Kouvola',
    'Raisio','Loimaa','Naantali','Kajaani','Kemi','Tornio','Ivalo','Kuhmo',
    'Pello','Kemijärvi','Kitee','Kontiolahti','Lieksa','Nurmes','Outokumpu',
    'Aura','Laitila','Lieto','Paimio','Salo','Uusikaupunki','Kirkkonummi',
    'Kauniainen','Kerava','Järvenpää','Tuusula','Nurmijärvi','Raasepori',
    'Akaa','Kangasala','Lempäälä','Nokia','Pirkkala','Ylöjärvi','Valkeakoski',
    'Pietarsaari','Kristiinankaupunki','Närpiö','Äänekoski','Jämsä','Keuruu',
    'Saarijärvi','Viitasaari','Raahe','Ylivieska','Haapajärvi','Nivala',
    'Oulainen','Inari','Sodankylä','Imatra','Rauma','Eura','Harjavalta',
  ];

  // ── FIN PASSPORT + ID CARD ───────────────────────────────────────
  // Passport: FP + 7 digits (sequential from base 1342193 at 2017-09-18, +2000/day)
  // ID card:  9 digits       (sequential from base 530100000 at 2017-09-18, +10000/day)
  // Validity: 5 years exactly
  genFinDoc() {
    const baseDate  = new Date(2017, 8, 18); // 2017-09-18
    const today     = new Date();
    // Random issue date between 2022-12-31 and today
    const minIssue  = new Date(2022, 11, 31);
    const rangeMs   = today.getTime() - minIssue.getTime();
    const issueDate = new Date(minIssue.getTime() + Math.random() * rangeMs);
    const days      = Math.floor((issueDate.getTime() - baseDate.getTime()) / 86400000);

    const ppNum  = (1342193 + days * 2000 + Math.floor(Math.random() * 200 - 100));
    const idNum  = (530100000 + days * 10000 + Math.floor(Math.random() * 400 - 200));

    const expiry = new Date(issueDate.getFullYear() + 5, issueDate.getMonth(), issueDate.getDate());
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

    const city = this.FIN_CITIES[Math.floor(Math.random() * this.FIN_CITIES.length)];
    this.finDocResult.set({
      pp:     `FP${Math.max(1000000, ppNum % 10000000)}`,
      id:     String(Math.max(100000000, idNum % 1000000000)),
      issued: fmt(issueDate),
      expiry: fmt(expiry),
      city,
    });
  }
  copyFinDoc(field: 'pp'|'id'|'issued'|'city') {
    const r = this.finDocResult(); if (!r) return;
    const text = field === 'issued' ? `${r.issued} → ${r.expiry}` : r[field];
    navigator.clipboard.writeText(text);
    this.finDocCopied.set(field); setTimeout(() => this.finDocCopied.set(null), 1500);
  }

  // ── FIN IBAN ─────────────────────────────────────────────────────
  // FI + 2CD + 6-digit bank code + 8-10 digit account
  // CD via mod-97: move first 4 chars to end, letters→digits, 98 - (numeric mod 97)
  genFinIban() {
    const bankCode  = String(Math.floor(Math.random() * 900000) + 100000);
    const accLen    = 8 + Math.floor(Math.random() * 3); // 8, 9 or 10
    const accNum    = Array.from({ length: accLen }, () => Math.floor(Math.random() * 10)).join('');
    const base      = `FI00${bankCode}${accNum}`;
    // Move first 4 to end, replace letters: F=15, I=18
    const rearr     = base.slice(4) + base.slice(0, 4);
    const numeric   = rearr.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    const rem       = BigInt(numeric) % 97n;
    const cd        = String(98n - rem).padStart(2, '0');
    this.finIbanResult.set(`FI${cd}${bankCode}${accNum}`);
  }
  copyFinIban() {
    const v = this.finIbanResult(); if (!v) return;
    navigator.clipboard.writeText(v);
    this.finIbanCopied.set(true); setTimeout(() => this.finIbanCopied.set(false), 1500);
  }

  // ── FIN PHONE ────────────────────────────────────────────────────
  // Mobile:   '0' + ('4'|'5') + zfill(2, 0-99) + 6 digits = 10 digits total
  // Landline: '01' + random(0-9) (80%) | '029' (20%) + 7 digits = 10 digits
  // Format local mobile:    XXXX XXX XXX  (4+3+3)
  // Format local landline:  XXX XXX XXXX  (3+3+4)
  // Format intl mobile:     +358 XX XXX XXXX
  // Format intl landline:   +358 XX XXX XXXX
  genFinPhone() {
    let raw: string;
    if (this.finPhoneType() === 'MOB') {
      const op  = Math.random() < 0.5 ? '4' : '5';
      const mid = String(Math.floor(Math.random() * 100)).padStart(2, '0');
      const rest = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
      raw = `0${op}${mid}${rest}`;                           // 10 digits
    } else {
      const prefix = Math.random() < 0.8
        ? `01${Math.floor(Math.random() * 10)}`
        : '029';
      const rest = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
      raw = prefix + rest;                                   // 10 digits
    }
    this.finPhoneResult.set({
      local: this.formatFinPhone(raw, 'local'),
      intl:  this.formatFinPhone(raw, 'international'),
    });
  }
  private formatFinPhone(raw: string, fmt: 'local' | 'international'): string {
    if (fmt === 'local') {
      // mobile (04X / 05X): XXXX XXX XXX; landline (01X / 029): XXX XXX XXXX
      return raw[1] === '4' || raw[1] === '5'
        ? `${raw.slice(0,4)} ${raw.slice(4,7)} ${raw.slice(7)}`
        : `${raw.slice(0,3)} ${raw.slice(3,6)} ${raw.slice(6)}`;
    } else {
      const digits = raw.slice(1);          // strip leading 0
      return raw[1] === '4' || raw[1] === '5'
        ? `+358 ${digits.slice(0,2)} ${digits.slice(2,5)} ${digits.slice(5)}`
        : `+358 ${digits.slice(0,2)} ${digits.slice(2,5)} ${digits.slice(5)}`;
    }
  }
  copyFinPhone(which: 'local' | 'intl') {
    const r = this.finPhoneResult(); if (!r) return;
    const text = which === 'local'
      ? r.local.replace(/\s/g, '')
      : r.intl.replace(/\s/g, '');
    navigator.clipboard.writeText(text);
    this.finPhoneCopied.set(which);
    setTimeout(() => this.finPhoneCopied.set(null), 1500);
  }

  // ── PL PHONE ────────────────────────────────────────────────────
  // Mobile:   '0' + ('5X' where X=0-9) + 7 digits = 10 digits total
  // Landline: '0' + ('2X'-'25' area code) + 7 digits = 10 digits
  genPlPhone() {
    let raw: string;
    if (this.plPhoneType() === 'MOB') {
      const prefix = `5${Math.floor(Math.random() * 10)}`; // 50-59
      const rest = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
      raw = `0${prefix}${rest}`;
    } else {
      // Landline: 21-25 (Warsaw area codes)
      const areaCode = 21 + Math.floor(Math.random() * 5); // 21-25
      const rest = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
      raw = `0${areaCode}${rest}`;
    }
    this.plPhoneResult.set({
      local: this.formatPlPhone(raw, 'local'),
      intl:  this.formatPlPhone(raw, 'international'),
    });
  }
  private formatPlPhone(raw: string, fmt: 'local' | 'international'): string {
    if (fmt === 'local') {
      // без лидирующего 0: 5X XXX XXX XX
      return `${raw.slice(1,3)} ${raw.slice(3,6)} ${raw.slice(6,9)} ${raw.slice(9)}`;
    } else {
      const digits = raw.slice(1); // strip leading 0 → 48XXXXXXXXX
      return `+48 ${digits.slice(0,2)} ${digits.slice(2,5)} ${digits.slice(5,8)} ${digits.slice(8)}`;
    }
  }
  copyPlPhone(which: 'local' | 'intl') {
    const r = this.plPhoneResult(); if (!r) return;
    const text = which === 'local'
      ? r.local.replace(/\s/g, '')
      : r.intl.replace(/\s/g, '');
    navigator.clipboard.writeText(text);
    this.plPhoneCopied.set(which);
    setTimeout(() => this.plPhoneCopied.set(null), 1500);
  }

  // ── PL PASSPORT ──────────────────────────────────────────────────
  // ICAO 9303 format: AA + 7 digits + check digit (MOD-10)
  // Series timeline based on Guard's passport dumps (2001-2027)

  // Canadian issuing authorities
  private readonly CAN_ISSUING_AUTHORITIES: string[] = [
    'GATINEAU', 'MISSISSAUGA', 'SYDNEY', 'OTTAWA', 'EDMONTON', 'TORONTO', 'SCARBOROUGH',
    'NORTH YORK', 'HAMILTON', 'LONDON', 'KITCHENER', 'WINDSOR', 'BRAMPTON', 'MONTREAL',
    'POINTE-CLAIRE', 'VANCOUVER', 'SURREY', 'VICTORIA', 'KELOWNA', 'CALGARY', 'WINNIPEG',
    'SASKATOON', 'CHARLOTTETOWN', 'HALIFAX', 'ST. JOHN\'S',
    'PASSPORT CANADA', 'IRCC',
  ];

  // 16 Polish voivodes (wojewodowie)
  private readonly PL_WOJEWODOWIE: string[] = [
    'WOJEWODA DOLNOŚLĄSKI',
    'WOJEWODA KUJAWSKO-POMORSKI',
    'WOJEWODA LUBELSKI',
    'WOJEWODA LUBUSKI',
    'WOJEWODA ŁÓDZKI',
    'WOJEWODA MAŁOPOLSKI',
    'WOJEWODA MAZOWIECKI',
    'WOJEWODA OPOLSKI',
    'WOJEWODA PODKARPACKI',
    'WOJEWODA PODLASKI',
    'WOJEWODA POMORSKI',
    'WOJEWODA ŚLĄSKI',
    'WOJEWODA ŚWIĘTOKRZYSKI',
    'WOJEWODA WARMIŃSKO-MAZURSKI',
    'WOJEWODA WIELKOPOLSKI',
    'WOJEWODA ZACHODNIOPOMORSKI',
  ];

  // ~120 real Polish cities (sorted by voivodeship)
  private readonly PL_ALL_CITIES: string[] = [
    // Lower Silesia
    'Wrocław', 'Wałbrzych', 'Legnica', 'Jawor', 'Świdnica', 'Dzierżoniów', 'Lubin', 'Polkowice', 'Złotoryja', 'Chojnów',
    'Jelenia Góra', 'Bolesławiec', 'Żary', 'Zgorzelec', 'Kamienna Góra', 'Pieńsk', 'Nowogrodziec', 'Lubań',
    // Greater Poland
    'Poznań', 'Kalisz', 'Konin', 'Leszno', 'Piła', 'Gniezno', 'Września', 'Żnin', 'Ostrów Wielkopolski', 'Jarocin',
    'Chodzież', 'Chwalisz', 'Slupca', 'Środa Wielkopolska', 'Wrzesnia', 'Nowy Tomyśl',
    // Pomerania
    'Gdańsk', 'Gdynia', 'Sopot', 'Tczew', 'Elbląg', 'Słupsk', 'Rummelsburg', 'Wejherowo', 'Starogard Gdański', 'Kwidzyn',
    'Kartuzy', 'Pucki', 'Tczew', 'Preußisch Stargard',
    // Silesia / Małopolska region
    'Katowice', 'Kraków', 'Sosnowiec', 'Dąbrowa Górnicza', 'Zabrze', 'Bytom', 'Gliwice', 'Chorzów', 'Ruda Śląska',
    'Tychy', 'Myślenice', 'Jaworzno', 'Pszów', 'Tarnowskie Góry', 'Mikołów', 'Knurów', 'Wodzisław Śląski', 'Cieszyn',
    'Bielsko-Biała', 'Żywiec', 'Sucha Beskidzka', 'Nowy Sącz', 'Tarnów', 'Mielec',
    // Subcarpathia
    'Rzeszów', 'Tarnobrzeg', 'Krosno', 'Sanok', 'Łańcut', 'Jasło', 'Kolbuszowa', 'Strzyżów', 'Stalowa Wola', 'Przeworsk',
    // Lublin
    'Lublin', 'Biała Podlaska', 'Chełm', 'Tomaszów Lubelski', 'Radzyń Podlaski', 'Zamość', 'Parczew', 'Hrubieszów',
    // Łódź region
    'Łódź', 'Piotrków Trybunalski', 'Sieradz', 'Skierniewice', 'Zduńska Wola', 'Aleksandrów Łódzki', 'Brzeziny',
    'Wieliczka', 'Koniecpol', 'Żarnowiec', 'Radomsko', 'Pabianice', 'Tuszyn', 'Zgierz',
    // Holy Cross / Świętokrzyskie
    'Kielce', 'Ostrowiec Świętokrzyski', 'Konskie', 'Skarżysko-Kamienna', 'Starachowice', 'Łagów', 'Staszów',
    'Wiśniewski', 'Jędrzejów', 'Opatów', 'Ćmielów',
    // Masovia (Mazovian)
    'Warszawa', 'Radom', 'Siedlce', 'Ostrołęka', 'Piaseczno', 'Żoliborz', 'Mokotów', 'Praga', 'Piastów', 'Pruszków',
    'Marki', 'Milanówek', 'Żyrardów', 'Skierniewice', 'Ostrów Mazowiecka', 'Przysucha', 'Szydłowiec', 'Grójec', 'Kozienice',
    // Warmia-Masuria
    'Olsztyn', 'Grudziądz', 'Iława', 'Mława', 'Elbląg', 'Kętrzyn', 'Mrągowo', 'Nidzica', 'Suwałki', 'Giżycko',
    // West Pomerania
    'Szczecin', 'Świnoujście', 'Stargard', 'Kamień Pomorski', 'Police', 'Gryfino', 'Myślibórz', 'Gorzów Wielkopolski',
    // Podlaskie (Northeast)
    'Białystok', 'Suwałki', 'Grajewo', 'Łomża', 'Sokółka', 'Dąbrowa Białostocka', 'Siemiatycze', 'Krynki',
  ];

  private readonly PL_CITIES: { [k: string]: string[] } = {
    'Lower Silesia': ['Wrocław', 'Wałbrzych', 'Legnica', 'Jawor', 'Świdnica'],
    'Greater Poland': ['Poznań', 'Kalisz', 'Konin', 'Leszno', 'Piła'],
    'Pomerania': ['Gdańsk', 'Gdynia', 'Sopot', 'Tczew', 'Elbląg'],
    'Silesia': ['Katowice', 'Kraków', 'Sosnowiec', 'Dąbrowa Górnicza', 'Zabrze'],
    'Subcarpathia': ['Rzeszów', 'Tarnobrzeg', 'Krosno', 'Sanok', 'Łańcut'],
    'Lublin': ['Lublin', 'Biała Podlaska', 'Chełm', 'Tomaszów Lubelski', 'Radzyń Podlaski'],
    'Łódź': ['Łódź', 'Piotrków Trybunalski', 'Sieradz', 'Skierniewice', 'Zduńska Wola'],
    'Holy Cross': ['Kielce', 'Ostrowiec Świętokrzyski', 'Konskie', 'Skarżysko-Kamienna', 'Starachowice'],
    'Masovia': ['Warszawa', 'Radom', 'Siedlce', 'Ostrołęka', 'Piaseczno'],
    'Warmia-Masuria': ['Olsztyn', 'Elbląg', 'Grudziądz', 'Iława', 'Mława'],
    'West Pomerania': ['Szczecin', 'Świnoujście', 'Stargard', 'Kamień Pomorski', 'Police'],
    'Podlaskie': ['Białystok', 'Suwałki', 'Grajewo', 'Łomża', 'Sokółka'],
    'Opole': ['Opole', 'Nysa', 'Brzeg', 'Kluczbork', 'Ozimek'],
    'Małopolska': ['Kraków', 'Tarnów', 'Nowy Sącz', 'Proszowice', 'Niepołomice'],
  };

  private readonly PL_SERIES: { startDate: Date; endDate: Date; series: string }[] = [
    // E-эпоха (2001-2022)
    { startDate: new Date(2001, 0, 1), endDate: new Date(2008, 11, 31), series: 'EA' },
    { startDate: new Date(2009, 0, 1), endDate: new Date(2009, 11, 31), series: 'EB' },
    { startDate: new Date(2010, 0, 1), endDate: new Date(2010, 11, 31), series: 'EC' },
    { startDate: new Date(2011, 0, 1), endDate: new Date(2011, 11, 31), series: 'ED' },
    { startDate: new Date(2012, 0, 1), endDate: new Date(2012, 11, 31), series: 'EE' },
    { startDate: new Date(2013, 0, 1), endDate: new Date(2013, 11, 31), series: 'EF' },
    { startDate: new Date(2014, 0, 1), endDate: new Date(2014, 11, 31), series: 'EG' },
    { startDate: new Date(2015, 0, 1), endDate: new Date(2015, 11, 31), series: 'EH' },
    { startDate: new Date(2016, 0, 1), endDate: new Date(2016, 11, 31), series: 'EI' },
    { startDate: new Date(2017, 0, 1), endDate: new Date(2017, 11, 31), series: 'EJ' },
    { startDate: new Date(2018, 0, 1), endDate: new Date(2018, 11, 31), series: 'EK' },
    { startDate: new Date(2019, 0, 1), endDate: new Date(2019, 4, 14), series: 'EL' },
    { startDate: new Date(2019, 4, 15), endDate: new Date(2021, 11, 31), series: 'ES' }, // guard dump
    // NOTE: EM overlapped with ES in original data, removed to avoid collision
    { startDate: new Date(2020, 0, 1), endDate: new Date(2020, 11, 31), series: 'EN' },
    { startDate: new Date(2021, 0, 1), endDate: new Date(2021, 11, 31), series: 'EP' },
    { startDate: new Date(2022, 0, 1), endDate: new Date(2022, 3, 30), series: 'ER' },
    // F-эпоха (2022-2025+)
    { startDate: new Date(2022, 4, 1), endDate: new Date(2022, 11, 31), series: 'FA' },
    { startDate: new Date(2023, 0, 1), endDate: new Date(2023, 0, 15), series: 'FB' },
    { startDate: new Date(2023, 0, 16), endDate: new Date(2023, 7, 30), series: 'FC' },
    { startDate: new Date(2023, 7, 31), endDate: new Date(2023, 11, 31), series: 'FD' },
    { startDate: new Date(2024, 0, 1), endDate: new Date(2024, 7, 31), series: 'FE' },
    { startDate: new Date(2024, 8, 1), endDate: new Date(2025, 3, 30), series: 'FG' },
    { startDate: new Date(2025, 4, 1), endDate: new Date(2025, 11, 31), series: 'FH' },
    { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31), series: 'FI' },
    { startDate: new Date(2027, 0, 1), endDate: new Date(2027, 11, 31), series: 'FJ' },
  ];

  // ── PL DOCUMENTS (unified) ──────────────────────────────────────
  genPlDocuments() {
    const dob = this.plDocsDob();
    const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return;

    const [, dd, mm, yyyy] = m;
    const dobDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();

    // 1. Generate PESEL from DOB
    const yy = parseInt(yyyy) % 100;
    let mp = parseInt(mm);
    const year = parseInt(yyyy);
    if (year >= 1800 && year <= 1899) mp += 80;
    else if (year >= 2000 && year <= 2099) mp += 20;
    else if (year >= 2100 && year <= 2199) mp += 40;
    else if (year >= 2200 && year <= 2299) mp += 60;

    const datePart = `${String(yy).padStart(2, '0')}${String(mp).padStart(2, '0')}${dd}`;
    const s1 = Math.floor(Math.random() * 10);
    const s2 = Math.floor(Math.random() * 10);
    const s3 = Math.floor(Math.random() * 10);
    const pool = this.plDocsGender() === 'M' ? [1, 3, 5, 7, 9] : [0, 2, 4, 6, 8];
    const s4 = pool[Math.floor(Math.random() * 5)];
    const serial = `${s1}${s2}${s3}${s4}`;
    const base = datePart + serial;
    const W = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const sum = base.split('').reduce((acc, c, i) => acc + parseInt(c) * W[i], 0);
    const peselCheck = (10 - sum % 10) % 10;
    const pesel = base + peselCheck;

    // 2. Validity term (5 years for kids < 12, 10 years for adults) - needed before date range calc
    const validity = age < 12 ? 5 : 10;

    // 3. Get or generate issue date
    //    Constraints: min 18 years after DOB, max end of 2025, AND expiry (issue+validity) must be >= end of 2027
    const issueStr = this.plDocsIssueDate();
    let issueDate: Date;

    if (issueStr) {
      const im = issueStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (!im) return;
      const [, idd, imm, iyyyy] = im;
      issueDate = new Date(parseInt(iyyyy), parseInt(imm) - 1, parseInt(idd));
    } else {
      const minIssueByAge = new Date(dobDate);
      minIssueByAge.setFullYear(minIssueByAge.getFullYear() + 18);

      // Issue date must be old enough that issue+validity reaches at least end of 2027
      const minIssueByExpiry = new Date(2027, 11, 31);
      minIssueByExpiry.setFullYear(minIssueByExpiry.getFullYear() - validity);

      const maxIssueDate = new Date(2025, 11, 31);

      let minIssueDate = minIssueByAge > minIssueByExpiry ? minIssueByAge : minIssueByExpiry;
      if (minIssueDate > maxIssueDate) minIssueDate = maxIssueDate; // edge case: too young for both constraints

      const minTime = minIssueDate.getTime();
      const maxTime = maxIssueDate.getTime();
      const randomTime = minTime + Math.random() * (maxTime - minTime);
      issueDate = new Date(randomTime);
    }

    // 4. Generate passport number
    const seriesObj = this.PL_SERIES.find(s => issueDate >= s.startDate && issueDate <= s.endDate);
    if (!seriesObj) return;

    const series = seriesObj.series;
    const serial2 = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
    const base2 = series + serial2;
    const checkDigit = this.computePlPassportCheck(base2);
    const passportNum = series + checkDigit + serial2;

    // 5. Get random wojewoda (issuing authority) and city of birth
    const wojewoda = this.PL_WOJEWODOWIE[Math.floor(Math.random() * this.PL_WOJEWODOWIE.length)];

    // Random city of birth from all Polish cities
    const cityOfBirth = this.PL_ALL_CITIES[Math.floor(Math.random() * this.PL_ALL_CITIES.length)];

    // 6. Calculate expiry
    const expiryDate = new Date(issueDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + validity);
    const issueDateFormatted = this.formatPlPassportDate(issueDate);
    const expiryDateFormatted = this.formatPlPassportDate(expiryDate);

    // 7. Generate MRZ (TD1 and TD3)
    const firstName = this.plDocsFirstName().toUpperCase();
    const lastName = this.plDocsLastName().toUpperCase();
    const mrzIdCard = this.generateMrzIdCard(lastName, firstName, passportNum, dobDate, this.plDocsGender(), expiryDate, pesel);
    const mrzPassport = this.generateMrzPassport(lastName, firstName, passportNum, dobDate, this.plDocsGender(), expiryDate, pesel);

    const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    this.plDocsResult.set({
      pesel,
      passportNum,
      wojewoda,
      cityOfBirth,
      issueDate: issueDateFormatted,
      expiryDate: expiryDateFormatted,
      issueDateISO: isoDate(issueDate),
      expiryDateISO: isoDate(expiryDate),
      validity,
      mrzIdCard,
      mrzPassport,
      firstName,
      lastName,
      dob,
      gender: this.plDocsGender(),
    });
  }

  // ── PL NIP (Tax ID) ────────────────────────────────────────────────
  genPlNip() {
    const nip = String(Math.floor(Math.random() * 10000000000)).padStart(10, '0');
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(nip[i]) * weights[i];
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    const fullNip = nip + checkDigit;
    this.plNipResult.set(fullNip);
  }
  copyPlNip() {
    const v = this.plNipResult();
    if (!v) return;
    navigator.clipboard.writeText(v);
    this.plNipCopied.set(true);
    setTimeout(() => this.plNipCopied.set(false), 1500);
  }

  // ── PL IBAN ──────────────────────────────────────────────────────────
  genPlIban() {
    // Format: PL + 2 check digits + 8-digit bank code + 16-digit account
    const bankCode = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    const accountNum = String(Math.floor(Math.random() * 10000000000000000)).padStart(16, '0');
    const base = `PL00${bankCode}${accountNum}`;

    // IBAN check digit (mod 97)
    const rearranged = base.slice(4) + base.slice(0, 4);
    const numeric = rearranged.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
    const remainder = BigInt(numeric) % 97n;
    const checkDigits = String(98n - remainder).padStart(2, '0');

    const iban = `PL${checkDigits}${bankCode}${accountNum}`;
    this.plIbanResult.set(iban);
  }
  copyPlIban() {
    const v = this.plIbanResult();
    if (!v) return;
    navigator.clipboard.writeText(v);
    this.plIbanCopied.set(true);
    setTimeout(() => this.plIbanCopied.set(false), 1500);
  }

  // ── PL REGON (Company Registration) ────────────────────────────────────
  genPlRegon() {
    // 9-digit REGON
    const regon = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    const weights = [8, 9, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(regon[i]) * weights[i];
    }
    const checkDigit = (11 - (sum % 11)) % 10;
    const fullRegon = regon + checkDigit;
    this.plRegonResult.set(fullRegon);
  }
  copyPlRegon() {
    const v = this.plRegonResult();
    if (!v) return;
    navigator.clipboard.writeText(v);
    this.plRegonCopied.set(true);
    setTimeout(() => this.plRegonCopied.set(false), 1500);
  }

  // ── CAN ONTARIO DL ────────────────────────────────────────────────────────
  private readonly CHART_1_MAPPING: Record<string, string> = {
    'A': '0',
    'B': '1', 'C': '1', 'D': '1',
    'E': '2',
    'F': '3', 'G': '3', 'H': '3',
    'I': '4', 'J': '4', 'K': '4',
    'L': '5', 'M': '5', 'N': '5',
    'O': '6',
    'P': '7', 'Q': '7', 'R': '7',
    'S': '8', 'T': '8',
    'U': '9', 'V': '9', 'W': '9', 'X': '9', 'Y': '9', 'Z': '9'
  };

  private readonly CHART_2_MAPPING: Record<string, string> = {
    'A': '1', 'B': '1',
    'C': '2', 'D': '2',
    'E': '3', 'F': '3',
    'G': '4', 'H': '4', 'I': '4',
    'J': '5', 'K': '5',
    'L': '6', 'M': '6', 'N': '6',
    'O': '7',
    'P': '7', 'Q': '7', 'R': '7',
    'S': '8', 'T': '8', 'U': '8', 'V': '8',
    'X': '9',
    'Y': '9', 'Z': '9'
  };

  private readonly LAST_NAME_CODES: Record<string, string> = {
    'avis': '921', 'eals': '2024', 'olff': '6247', 'orello': '6581', 'smith': '778',
    'chen': '3344', 'zhen': '3344', 'chan': '3175', 'wang': '0418', 'yang': '0418',
    'tang': '0418', 'zhang': '3187', 'ou': '9001', 'ma': '0001', 'ha': '0001',
    'li': '4001', 'yu': '9001', 'moss': '6726', 'sabourin': '0019', 'maltais': '0320',
    'johnson': '6173', 'knuff': '5994', 'mcgannety': '2217', 'shaikh': '3145', 'woodley': '6472',
    'cleland': '5250', 'didow': '4139', 'moore': '6509', 'sad': '0089', 'sunderalingam': '9266',
    'raisig': '0200', 'mellett': '2396', 'paterson': '0803', 'rutherford': '9480', 'sherborn': '3365',
    'malowany': '0315', 'elnaggar': '5495', 'andrews': '5886', 'bhagrattie': '3142', 'beausoleil': '2062',
    'almeida': '5486', 'feddema': '2125', 'moed': '6102', 'devine': '2931', 'clelland': '5365'
  };

  private readonly FIRST_NAME_CODES: Record<string, string> = {
    'alexander': '019', 'andrew': '042', 'gabriel': '270', 'lena': '456', 'lovepreet': '000',
    'jian': '401', 'meng': '539', 'yuan': '490', 'ming': '556', 'kingsley': '435',
    'kimberly': '435', 'xuan': '789', 'zhenfei': '796', 'jiasheng': '401', 'jiwei': '204',
    'shuyu': '709', 'min': '555', 'wen': '780', 'somang': '718', 'brandon': '096',
    'christopher': '124', 'melissa': '537', 'ian': '353', 'lyn': '500', 'neal': '583',
    'shakeel': '703', 'kevin': '433', 'tara': '732', 'steven': '723', 'samih': '687',
    'navid': '583', 'colin': '134', 'judy': '418', 'robert': '658', 'geremiah': '280',
    'katie': '428', 'kelly': '430', 'nicholas': '590', 'marlene': '522', 'krista': '437',
    'caedmon': '106', 'benjamin': '082', 'ellis': '605', 'romain': '421'
  };

  // Canadian passport - ~100 cities
  private readonly CAN_CITIES: string[] = [
    'TORONTO', 'VANCOUVER', 'CALGARY', 'EDMONTON', 'WINNIPEG', 'QUEBEC CITY', 'MONTREAL',
    'OTTAWA', 'MISSISSAUGA', 'BRAMPTON', 'HAMILTON', 'LONDON', 'KITCHENER', 'WATERLOO',
    'CAMBRIDGE', 'GUELPH', 'OSHAWA', 'DURHAM', 'AJAX', 'WHITBY', 'BOWMANVILLE',
    'PETERBOROUGH', 'BELLEVILLE', 'KINGSTON', 'CORNWALL', 'OTTAWA', 'BARRIE', 'ORILLIA',
    'SUDBURY', 'THUNDER BAY', 'FORT WILLIAM', 'KENORA', 'DRYDEN', 'TIMMINS', 'NORTH BAY',
    'SAULT STE. MARIE', 'WINDSOR', 'LONDON', 'SARNIA', 'CHATHAM', 'STRATFORD',
    'QUEBEC', 'SHERBROOKE', 'TROIS-RIVIÈRES', 'GATINEAU', 'HULL', 'LAVAL', 'LONGUEUIL',
    'SAINT-JEAN', 'SAINT-HYACINTHE', 'DRUMMONDVILLE', 'GRANBY', 'JOLIETTE', 'SAINT-JÉRÔME',
    'SAGUENAY', 'BAIE-COMEAU', 'SEPT-ÎLES', 'RIMOUSKI', 'MATANE', 'GASPÉ', 'NEW BRUNSWICK',
    'FREDERICTON', 'SAINT JOHN', 'MONCTON', 'BATHURST', 'CAMPBELLTON', 'EDMUNDSTON',
    'NOVA SCOTIA', 'HALIFAX', 'DARTMOUTH', 'SYDNEY', 'GLACE BAY', 'CAPE BRETON',
    'PRINCE EDWARD ISLAND', 'CHARLOTTETOWN', 'SUMMERSIDE', 'NEWFOUNDLAND', "ST. JOHN'S",
    'CORNER BROOK', 'GANDER', 'GRAND FALLS-WINDSOR', 'MANITOBA', 'BRANDON', 'WINNIPEG BEACH',
    'PORTAGE LA PRAIRIE', 'SELKIRK', 'SASKATCHEWAN', 'REGINA', 'SASKATOON', 'SWIFT CURRENT',
    'PRINCE ALBERT', 'MOOSE JAW', 'YORKTON', 'LLOYDMINSTER', 'ALBERTA', 'LETHBRIDGE',
    'RED DEER', 'MEDICINE HAT', 'GRANDE PRAIRIE', 'FORT MCMURRAY', 'COLD LAKE',
    'BRITISH COLUMBIA', 'VICTORIA', 'KELOWNA', 'ABBOTSFORD', 'VERNON', 'KAMLOOPS',
    'NANAIMO', 'PRINCE GEORGE', 'DAWSON CREEK', 'FORT ST. JOHN', 'CRESTON', 'PENTICTON'
  ];

  // Canadian passport months (English/French)
  private readonly CAN_MONTHS: Array<{en: string; fr: string}> = [
    { en: 'JAN', fr: 'JAN' },
    { en: 'FEB', fr: 'FÉV' },
    { en: 'MAR', fr: 'MARS' },
    { en: 'APR', fr: 'AVR' },
    { en: 'MAY', fr: 'MAI' },
    { en: 'JUNE', fr: 'JUIN' },
    { en: 'JULY', fr: 'JUIL' },
    { en: 'AUG', fr: 'AOÛT' },
    { en: 'SEPT', fr: 'SEPT' },
    { en: 'OCT', fr: 'OCT' },
    { en: 'NOV', fr: 'NOV' },
    { en: 'DEC', fr: 'DEC' }
  ];

  // Canadian passport - main number prefixes by year
  private readonly CAN_MAIN_PREFIXES: Record<number, string[]> = {
    2015: ['HC', 'HG'],
    2016: ['HB', 'HD', 'HH', 'HK', 'HL', 'HN'],
    2017: ['AA', 'AB', 'AC', 'AD', 'AE', 'HM', 'HN', 'HP'],
    2018: ['AE', 'AH'],
    2019: ['AE', 'AJ', 'AK', 'AM'],
    2020: ['AL', 'AM', 'AN'],
    2021: ['AL', 'AN', 'AR'],
    2022: ['AM', 'AR', 'AS', 'AW'],
    2023: ['AS', 'PA'],
    2024: ['PG'],
  };

  // Canadian passport - vertical number pools by month
  private readonly CAN_VERTICAL_POOLS: Record<number, string[]> = {
    1: ['FH', 'GO', 'HF', 'HH', 'LS'],
    2: ['FN', 'FO', 'HI', 'HL', 'NT', 'PH'],
    3: ['HO', 'JG'],
    4: [],
    5: ['LC'],
    6: ['IE', 'LY'],
    7: ['EK', 'EL', 'GG', 'GH', 'IH', 'ON'],
    8: ['EQ', 'GH'],
    9: ['EU', 'IK', 'KI', 'NA'],
    10: ['GI', 'LG', 'LJ'],
    11: ['LN', 'NJ'],
    12: ['GO', 'JC', 'JD', 'KO', 'LP', 'NO'],
  };

  // Canadian passport - vertical number pools by year/month
  private readonly CAN_YEAR_MONTH_POOLS: Record<number, Record<number, string[]>> = {
    2015: { 7: ['EK', 'EL'], 8: ['EQ'], 9: ['EU'] },
    2016: { 1: ['FH'], 2: ['FN', 'FO'], 7: ['GG', 'GH'], 8: ['GH'], 12: ['GO'] },
    2017: { 1: ['GO', 'HF', 'HH'], 2: ['HI', 'HL'], 3: ['HO'], 6: ['IE'], 7: ['IH'], 12: ['JC', 'JD'] },
    2018: { 3: ['JG'], 9: ['KI'], 12: ['KO'] },
    2019: { 5: ['LC'], 10: ['LG', 'LJ'], 11: ['LN'], 12: ['LP'] },
    2020: { 1: ['LS'], 6: ['LY'] },
    2021: { },
    2022: { 9: ['NA'], 11: ['NJ'], 12: ['NO'] },
    2023: { 2: ['NT'], 7: ['ON'] },
    2024: { 2: ['PH'] },
  };

  private getLastNameSoundex(lastName: string): string {
    lastName = lastName.toUpperCase().trim();
    if (!lastName) return '0000';

    const firstDigit = this.CHART_1_MAPPING[lastName[0]] || '0';
    let remaining = this.LAST_NAME_CODES[lastName.toLowerCase()];

    if (!remaining) {
      remaining = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    } else {
      remaining = remaining.substring(0, 3);
    }

    return firstDigit + remaining;
  }

  private getFirstNameSoundex(firstName: string): string {
    firstName = firstName.toUpperCase().trim();
    if (!firstName) return '000';

    const code = this.FIRST_NAME_CODES[firstName.toLowerCase()];
    return code || String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  }

  private getMiddleEncoding(middleInitial: string = ''): string {
    if (!middleInitial) return '0';
    middleInitial = middleInitial.toUpperCase().trim();
    return this.CHART_2_MAPPING[middleInitial[0]] || '0';
  }

  private generateDdRef(issueYear: number = 2024): string {
    // Первая буква зависит от года выдачи
    let firstLetter: string;
    if (issueYear <= 2015) {
      firstLetter = 'C';
    } else if (issueYear <= 2018) {
      firstLetter = 'D';
    } else if (issueYear <= 2020) {
      firstLetter = 'G';
    } else if (issueYear === 2021) {
      firstLetter = Math.random() > 0.5 ? 'G' : 'H';
    } else if (issueYear >= 2022) {
      firstLetter = 'D';
    } else {
      firstLetter = 'G';
    }

    // Вторая буква случайная
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const secondLetter = letters[Math.floor(Math.random() * letters.length)];

    // 7 цифр - серийный номер
    const digits = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');

    return firstLetter + secondLetter + digits;
  }

  genCanOntarioDl() {
    const lastName = this.canLastName().trim();
    const firstName = this.canFirstName().trim();
    const middleInit = this.canMiddleInitial().trim();
    const dobStr = this.canDob().trim();
    const gender = this.canGender();

    if (!lastName || !firstName || !dobStr) {
      alert('Please fill: Last Name, First Name, DOB (YYYY-MM-DD)');
      return;
    }

    // Parse DOB
    const dobParts = dobStr.split('-');
    if (dobParts.length !== 3) {
      alert('DOB must be in format YYYY-MM-DD');
      return;
    }

    const year = parseInt(dobParts[0]);
    let month = parseInt(dobParts[1]);
    const day = parseInt(dobParts[2]);

    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      alert('Invalid date');
      return;
    }

    // First letter of last name
    const firstLetter = lastName.substring(0, 1).toUpperCase();

    // Soundex encodings
    const lastNameSoundex = this.getLastNameSoundex(lastName);
    const firstNameSoundex = this.getFirstNameSoundex(firstName);
    const middleCode = this.getMiddleEncoding(middleInit);

    // Gender encoding: +50 to month if female
    if (gender === 'F') {
      month = month + 50;
    }

    // Format: LXXXX-FFFMY-YMMDD
    const yy = String(year).slice(-2).padStart(2, '0');
    const mmStr = String(month).padStart(2, '0');
    const ddStr = String(day).padStart(2, '0');

    const part1 = firstLetter + lastNameSoundex;           // L + XXXX = 5 chars
    const part2 = firstNameSoundex + middleCode + yy[0];  // FFF + M + Y = 5 chars
    const part3 = yy[1] + mmStr + ddStr;                   // Y + MM + DD = 5 chars

    const dlNumber = `${part1}-${part2}-${part3}`;
    const ddRef = this.generateDdRef(year);

    this.canOntarioDlResult.set({ dlNumber, ddRef });
  }

  copyCanOntarioDl() {
    const v = this.canOntarioDlResult();
    if (!v) return;
    const text = `${v.dlNumber}\n${v.ddRef}`;
    navigator.clipboard.writeText(text);
    this.canOntarioDlCopied.set(true);
    setTimeout(() => this.canOntarioDlCopied.set(false), 1500);
  }

  private icaoChecksum(str: string): string {
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      let val = 0;
      if (char >= '0' && char <= '9') {
        val = parseInt(char);
      } else if (char >= 'A' && char <= 'Z') {
        val = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else if (char === '<') {
        val = 0;
      }
      sum += val * weights[i % 3];
    }
    return String(sum % 10);
  }

  private generateMrzIdCard(surname: string, given: string, docNum: string, dob: Date, gender: string, expiry: Date, pesel: string): string {
    // TD1 format (3 lines x 30 chars each) - ICAO 9303
    // Verified against labeltools.nl/mrzgen.js reference implementation
    const docNumClean = docNum.replace(/[^A-Z0-9]/g, '').substring(0, 9).padEnd(9, '0');
    const surnameClean = surname.replace(/[^A-Z]/g, '').substring(0, 30);
    const givenClean = given.replace(/[^A-Z]/g, '').substring(0, 30);

    const yy = String(dob.getFullYear() % 100).padStart(2, '0');
    const mm = String(dob.getMonth() + 1).padStart(2, '0');
    const dd = String(dob.getDate()).padStart(2, '0');
    const dobStr = `${yy}${mm}${dd}`;

    const expYy = String(expiry.getFullYear() % 100).padStart(2, '0');
    const expMm = String(expiry.getMonth() + 1).padStart(2, '0');
    const expDd = String(expiry.getDate()).padStart(2, '0');
    const expStr = `${expYy}${expMm}${expDd}`;

    const sexChar = gender === 'M' ? 'M' : 'F';
    const docCheck = this.icaoChecksum(docNumClean);
    const dobCheck = this.icaoChecksum(dobStr);
    const expCheck = this.icaoChecksum(expStr);

    // Optional data on line 1 (positions after doc+check), clamped to 15 chars - empty here
    const optData = '<'.repeat(15);
    const persField = pesel.substring(0, 11).padEnd(11, '<');

    // Line 1: I<[Country(3)][Doc number(9)][Check(1)][Optional data(15)] = 30
    const line1 = `I<POL${docNumClean}${docCheck}${optData}`;

    // Composite check for line 2's final digit covers: doc+docCheck+optData+birth+birthCheck+expiry+expiryCheck+persField
    const tdFinal = `${docNumClean}${docCheck}${optData}${dobStr}${dobCheck}${expStr}${expCheck}${persField}`;
    const finalCheck = this.icaoChecksum(tdFinal);

    // Line 2: [DOB(6)][Check(1)][Sex(1)][Expiry(6)][Check(1)][Nationality(3)][Personal#(11)][Composite check(1)] = 30
    const line2 = `${dobStr}${dobCheck}${sexChar}${expStr}${expCheck}POL${persField}${finalCheck}`;

    // Line 3: [Surname][<<][Firstname][Padding to 30]
    const nameField = `${surnameClean}<<${givenClean}`.substring(0, 29);
    const line3 = nameField.padEnd(30, '<');

    return `${line1}\n${line2}\n${line3}`;
  }

  private generateMrzPassport(surname: string, given: string, docNum: string, dob: Date, gender: string, expiry: Date, pesel: string): string {
    // TD3 format (2 lines x 44 chars each) - ICAO 9303
    // Verified against labeltools.nl/mrzgen.js reference implementation
    const docNumClean = docNum.replace(/[^A-Z0-9]/g, '').substring(0, 9).padEnd(9, '0');
    const surnameClean = surname.replace(/[^A-Z]/g, '');
    const givenClean = given.replace(/[^A-Z]/g, '');

    const yy = String(dob.getFullYear() % 100).padStart(2, '0');
    const mm = String(dob.getMonth() + 1).padStart(2, '0');
    const dd = String(dob.getDate()).padStart(2, '0');
    const dobStr = `${yy}${mm}${dd}`;

    const expYy = String(expiry.getFullYear() % 100).padStart(2, '0');
    const expMm = String(expiry.getMonth() + 1).padStart(2, '0');
    const expDd = String(expiry.getDate()).padStart(2, '0');
    const expStr = `${expYy}${expMm}${expDd}`;

    const sexChar = gender === 'M' ? 'M' : 'F';

    // Line 1: P<[Country(3)][Surname<<Firstname, clamped to 39]
    const nameField = `${surnameClean}<<${givenClean}`.substring(0, 39).padEnd(39, '<');
    const line1 = `P<POL${nameField}`;

    const docCheck = this.icaoChecksum(docNumClean);
    const dobCheck = this.icaoChecksum(dobStr);
    const expCheck = this.icaoChecksum(expStr);

    // Personal number field is clamped to 14 chars (PESEL + padding) and has its OWN check digit
    const persField = pesel.substring(0, 14).padEnd(14, '<');
    const persCheck = this.icaoChecksum(persField);

    // Composite final check covers: doc+docCheck+birth+birthCheck+expiry+expiryCheck+persField+persCheck
    const mrpFinal = `${docNumClean}${docCheck}${dobStr}${dobCheck}${expStr}${expCheck}${persField}${persCheck}`;
    const finalCheck = this.icaoChecksum(mrpFinal);

    // Line 2: [Doc#(9)][Check(1)][Nationality(3)][DOB(6)][Check(1)][Sex(1)][Expiry(6)][Check(1)][Personal#(14)][PersCheck(1)][Composite check(1)] = 44
    const line2 = `${docNumClean}${docCheck}POL${dobStr}${dobCheck}${sexChar}${expStr}${expCheck}${persField}${persCheck}${finalCheck}`;

    return `${line1}\n${line2}`;
  }

  copyPlDocs(which: 'pesel' | 'passport' | 'mrzId' | 'mrzPp' | 'all') {
    const r = this.plDocsResult();
    if (!r) return;
    let text = '';
    switch (which) {
      case 'pesel': text = r.pesel; break;
      case 'passport': text = r.passportNum; break;
      case 'mrzId': text = r.mrzIdCard.replace(/\n/g, ''); break;
      case 'mrzPp': text = r.mrzPassport.replace(/\n/g, ''); break;
      case 'all': {
        const td1Lines = r.mrzIdCard.split('\n');
        const td3Lines = r.mrzPassport.split('\n');
        text = [
          `FIRST_NAME: ${r.firstName}`,
          `LAST_NAME: ${r.lastName}`,
          `DOB: ${r.dob}`,
          `SEX: ${r.gender}`,
          `CITY_OF_BIRTH: ${r.cityOfBirth}`,
          `PESEL: ${r.pesel}`,
          `PASSPORT_NUM: ${r.passportNum}`,
          `ISSUE_DATE: ${r.issueDate}`,
          `EXPIRY_DATE: ${r.expiryDate}`,
          `ISSUE_DATE_ISO: ${r.issueDateISO}`,
          `EXPIRY_DATE_ISO: ${r.expiryDateISO}`,
          `VALIDITY_YEARS: ${r.validity}`,
          `ISSUED_BY: ${r.wojewoda}`,
          `MRZ_TD1_LINE1: ${td1Lines[0]}`,
          `MRZ_TD1_LINE2: ${td1Lines[1]}`,
          `MRZ_TD1_LINE3: ${td1Lines[2]}`,
          `MRZ_TD3_LINE1: ${td3Lines[0]}`,
          `MRZ_TD3_LINE2: ${td3Lines[1]}`,
        ].join('\n');
        break;
      }
    }
    navigator.clipboard.writeText(text);
    this.plDocsCopied.set(which);
    setTimeout(() => this.plDocsCopied.set(null), 1500);
  }

  private formatPlPassportDate(date: Date): string {
    const monthsEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthsPl = ['STY', 'LUT', 'MAR', 'KWI', 'MAJ', 'CZE', 'LIP', 'SIE', 'WRZ', 'PAŹ', 'LIS', 'GRU'];

    const day = String(date.getDate()).padStart(2, '0');
    const month = date.getMonth();
    const year = date.getFullYear();

    return `${day} ${monthsPl[month]}/${monthsEn[month]} ${year}`;
  }

  private computePlPassportCheck(base: string): string {
    // ICAO 9303 MOD-10 checksum: 2 letters + 6 digits = 8 chars
    const W = [7, 3, 1, 7, 3, 1, 7, 3];  // 8 weights for 8 symbols
    let sum = 0;
    for (let i = 0; i < base.length && i < W.length; i++) {
      const ch = base[i];
      let val = 0;
      if (ch >= '0' && ch <= '9') {
        val = parseInt(ch);
      } else if (ch >= 'A' && ch <= 'Z') {
        val = ch.charCodeAt(0) - 55; // A=10, B=11, ..., Z=35
      }
      sum += val * W[i];
    }
    return String(sum % 10);
  }

  // ── CAN PASSPORT ──────────────────────────────────────────────────
  genCanPassport() {
    const firstName = this.canPassFirstName().trim().toUpperCase();
    const lastName = this.canPassLastName().trim().toUpperCase();
    const dobStr = this.canPassDob().trim();
    const gender = this.canPassGender();

    if (!firstName || !lastName || !dobStr) {
      alert('Please fill: First Name, Last Name, DOB (DD-MM-YYYY)');
      return;
    }

    // Parse DOB - support both DD-MM-YYYY and DD.MM.YYYY formats
    let dobParts = dobStr.includes('.') ? dobStr.split('.') : dobStr.split('-');
    if (dobParts.length !== 3) {
      alert('DOB must be in format DD-MM-YYYY or DD.MM.YYYY');
      return;
    }

    const day = parseInt(dobParts[0]);
    const month = parseInt(dobParts[1]);
    const year = parseInt(dobParts[2]);

    if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
      alert('Invalid date');
      return;
    }

    const dobDate = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - dobDate.getFullYear();

    if (age < 18) {
      alert('Must be at least 18 years old');
      return;
    }

    // Generate issue date: min 2017, min 18 years after DOB, exactly 10 years validity
    const minIssueByAge = new Date(dobDate);
    minIssueByAge.setFullYear(minIssueByAge.getFullYear() + 18);
    const minIssueDate = new Date(2017, 0, 1); // Min 2017
    const startDate = minIssueByAge > minIssueDate ? minIssueByAge : minIssueDate;

    // Max issue date: today (so we can generate any valid passport up to now)
    const maxIssueDate = new Date(today);

    // Ensure startDate is not after maxIssueDate
    if (startDate > maxIssueDate) {
      alert('Person is too young to have a valid passport');
      return;
    }

    const randomTime = startDate.getTime() + Math.random() * (maxIssueDate.getTime() - startDate.getTime());
    const issueDate = new Date(randomTime);

    // Expiry date = EXACTLY issue date + 10 years
    const expiryDate = new Date(issueDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 10);

    // Passport number: XX###### (2 letters + 6 digits) based on issue year
    const issueYear = issueDate.getFullYear();
    let validPrefixes = this.CAN_MAIN_PREFIXES[issueYear];
    if (!validPrefixes) {
      // Fallback for unknown years
      if (issueYear < 2017) {
        validPrefixes = ['H' + String.fromCharCode(65 + Math.floor(Math.random() * 26))];
      } else if (issueYear < 2024) {
        validPrefixes = ['A' + String.fromCharCode(65 + Math.floor(Math.random() * 26))];
      } else {
        validPrefixes = ['P' + String.fromCharCode(65 + Math.floor(Math.random() * 26))];
      }
    }
    const prefix = validPrefixes[Math.floor(Math.random() * validPrefixes.length)];
    const sequence = Math.floor(Math.random() * 1000000);
    const passportNum = prefix + String(sequence).padStart(6, '0');

    // Vertical number: ELLL##### (E + 2 letters + 5 digits) based on issue month/year
    const issueMonth = issueDate.getMonth() + 1;
    let validPools = this.CAN_YEAR_MONTH_POOLS[issueYear]?.[issueMonth];
    if (!validPools || validPools.length === 0) {
      validPools = this.CAN_VERTICAL_POOLS[issueMonth];
    }
    if (!validPools || validPools.length === 0) {
      // Fallback: generate random letters
      validPools = ['EK'];
    }
    const letters = validPools[Math.floor(Math.random() * validPools.length)];
    const vertSeq = Math.floor(Math.random() * 100000);
    const verticalNum = 'E' + letters + String(vertSeq).padStart(5, '0');

    // Format dates with bilingual months
    const issueDateFormatted = this.formatCanPassportDate(issueDate);
    const expiryDateFormatted = this.formatCanPassportDate(expiryDate);
    const dobFormatted = this.formatCanPassportDate(dobDate);

    // Random city of birth
    const cityOfBirth = this.CAN_CITIES[Math.floor(Math.random() * this.CAN_CITIES.length)];

    // Random issuing authority
    const issuingAuthority = this.CAN_ISSUING_AUTHORITIES[Math.floor(Math.random() * this.CAN_ISSUING_AUTHORITIES.length)];

    // Generate MRZ
    const mrzPassport = this.generateCanMrzPassport(lastName, firstName, passportNum, dobDate, gender, expiryDate);

    const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    this.canPassResult.set({
      passportNum,
      verticalNum,
      issueDate: issueDateFormatted,
      expiryDate: expiryDateFormatted,
      issueDateISO: isoDate(issueDate),
      expiryDateISO: isoDate(expiryDate),
      cityOfBirth,
      issuingAuthority,
      firstName,
      lastName,
      dob: dobFormatted,
      gender,
      mrzPassport,
    });

    // Save to history (last 10)
    const historyItem = { passportNum, verticalNum, firstName, lastName, timestamp: Date.now() };
    const history = [historyItem, ...this.canPassHistory().slice(0, 9)];
    this.canPassHistory.set(history);

    try {
      localStorage.setItem('can_passport_history', JSON.stringify(history));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  loadCanPassportFromHistory(item: { passportNum: string; verticalNum: string; firstName: string; lastName: string; timestamp: number }) {
    // Load historical passport data back into form
    this.canPassFirstName.set(item.firstName);
    this.canPassLastName.set(item.lastName);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private formatCanPassportDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.getMonth();
    const yearFull = date.getFullYear();
    const year = String(yearFull % 100).padStart(2, '0');
    const monthEn = this.CAN_MONTHS[month].en;
    const monthFr = this.CAN_MONTHS[month].fr;
    // Format: DD MMM[space]/MMM[space] YY (each month part pads to 4 chars total)
    const enPart = monthEn.length === 3 ? monthEn + ' ' : monthEn;
    const frPart = monthFr.length === 3 ? monthFr + ' ' : monthFr;
    return `${day} ${enPart}/${frPart} ${year}`;
  }

  private generateCanMrzPassport(lastName: string, firstName: string, passportNum: string, dob: Date, gender: 'M' | 'F', expiry: Date): string {
    // TD3 format (2 lines x 44 chars each) - ICAO 9303 for Passport
    // Verified against ICAO 9303 standard
    const docNumClean = passportNum.replace(/[^A-Z0-9]/g, '').substring(0, 9).padEnd(9, '<');
    const surnameClean = lastName.replace(/[^A-Z]/g, '');
    const givenClean = firstName.replace(/[^A-Z]/g, '');

    const yy = String(dob.getFullYear() % 100).padStart(2, '0');
    const mm = String(dob.getMonth() + 1).padStart(2, '0');
    const dd = String(dob.getDate()).padStart(2, '0');
    const dobStr = `${yy}${mm}${dd}`;

    const expYy = String(expiry.getFullYear() % 100).padStart(2, '0');
    const expMm = String(expiry.getMonth() + 1).padStart(2, '0');
    const expDd = String(expiry.getDate()).padStart(2, '0');
    const expStr = `${expYy}${expMm}${expDd}`;

    const sexChar = gender === 'M' ? 'M' : 'F';

    // Line 1: P<[Country(3)][Surname<<Firstname, clamped to 39]
    const nameField = `${surnameClean}<<${givenClean}`.substring(0, 39).padEnd(39, '<');
    const line1 = `P<CAN${nameField}`;

    const docCheck = this.icaoChecksum(docNumClean);
    const dobCheck = this.icaoChecksum(dobStr);
    const expCheck = this.icaoChecksum(expStr);

    // Personal number field (filler) - must be exactly 14 chars
    const persField = ''.padEnd(14, '<');
    const persCheck = '0';

    // Composite final check covers: doc+docCheck+birth+birthCheck+expiry+expiryCheck+persField+persCheck
    const mrpFinal = `${docNumClean}${docCheck}${dobStr}${dobCheck}${expStr}${expCheck}${persField}${persCheck}`;
    const finalCheck = this.icaoChecksum(mrpFinal);

    // Line 2: [Doc#(9)][Check(1)][Nationality(3)][DOB(6)][Check(1)][Sex(1)][Expiry(6)][Check(1)][Personal#(14)][PersCheck(1)][Composite check(1)] = 44
    const line2 = `${docNumClean}${docCheck}CAN${dobStr}${dobCheck}${sexChar}${expStr}${expCheck}${persField}${persCheck}${finalCheck}`;

    return `${line1}\n${line2}`;
  }

  genCanPassportBarcode(verticalNum: string) {
    // Generate CODE39 barcode as PNG with transparent background (256x1441 vertical)
    const canvas = this.generateCode39Canvas(verticalNum, 256, 1441);
    const dataUrl = canvas.toDataURL('image/png');
    this.canPassBarcodeSvg.set(dataUrl); // Reuse signal for data URL
    this.canPassShowBarcode.set(true);
  }

  private generateCode39Canvas(text: string, targetWidth: number = 256, targetHeight: number = 1441): HTMLCanvasElement {
    // CODE39 - генерирање барко́да с пиксельного растра (детерминированный)
    const patterns: Record<string, string> = {
      '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
      '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
      '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
      'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
      'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
      'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
      'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
      'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
      'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
      '-': '010000011', '.': '110000010', ' ': '011000010', '*': '010010100'
    };

    const encoded = `*${text.toUpperCase()}*`;
    let bits = '';
    for (let i = 0; i < encoded.length; i++) {
      const ch = encoded[i];
      if (patterns[ch]) {
        bits += patterns[ch];
        // Додаємо separator (0) після кожного символу, КРІМ останнього (STOP *)
        if (i < encoded.length - 1) {
          bits += '0';
        }
      }
    }

    const MW = 3, MH = 300; // module width/height (narrow=1, wide=3)

    // Расчитаем реальную ширину - каждый бит 0=1пиксель, 1=3пикселя
    let hW = 0;
    for (const bit of bits) {
      hW += bit === '1' ? MW : 1;
    }

    // Генерируем прямо в пиксели - горизонтальный барко́д
    const hPixels = new Uint8ClampedArray(hW * MH * 4);
    hPixels.fill(255); // белый фон

    let pixelX = 0;
    for (let i = 0; i < bits.length; i++) {
      const bit = bits[i];
      const width = bit === '1' ? MW : 1;
      const isBlack = (i % 2) === 0; // чередуем чёрный/белый

      if (isBlack) {
        for (let y = 0; y < MH; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * hW + pixelX + x) * 4;
            hPixels[idx] = 0;       // R
            hPixels[idx + 1] = 0;   // G
            hPixels[idx + 2] = 0;   // B
            hPixels[idx + 3] = 255; // A
          }
        }
      }
      pixelX += width;
    }

    // Ротирование 90° вручную на пикселях
    const vW = MH, vH = hW;
    const vPixels = new Uint8ClampedArray(vW * vH * 4);
    vPixels.fill(255); // белый

    for (let y = 0; y < vH; y++) {
      for (let x = 0; x < vW; x++) {
        // Ротация 90° clockwise: (hX, hY) -> (hY, hW-1-hX)
        // Обратная: (vX=x, vY=y) -> (hX=hW-1-y, hY=x)
        const hX = hW - 1 - y;
        const hY = x;
        const srcIdx = (hY * hW + hX) * 4;
        const dstIdx = (y * vW + x) * 4;

        vPixels[dstIdx] = hPixels[srcIdx];
        vPixels[dstIdx + 1] = hPixels[srcIdx + 1];
        vPixels[dstIdx + 2] = hPixels[srcIdx + 2];
        vPixels[dstIdx + 3] = hPixels[srcIdx + 3];
      }
    }

    // Масштабирование в целевые размеры (256x1441) с ближайшей соседней
    const fPixels = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    fPixels.fill(255);

    const scaleX = vW / targetWidth;
    const scaleY = vH / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIdx = (srcY * vW + srcX) * 4;
        const dstIdx = (y * targetWidth + x) * 4;

        fPixels[dstIdx] = vPixels[srcIdx];
        fPixels[dstIdx + 1] = vPixels[srcIdx + 1];
        fPixels[dstIdx + 2] = vPixels[srcIdx + 2];
        fPixels[dstIdx + 3] = vPixels[srcIdx + 3];
      }
    }

    // Белый фон прозрачный
    for (let i = 0; i < fPixels.length; i += 4) {
      if (fPixels[i] > 240 && fPixels[i + 1] > 240 && fPixels[i + 2] > 240) {
        fPixels[i + 3] = 0;
      }
    }

    // Создаём canvas и вставляем пиксели
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(targetWidth, targetHeight);
    imageData.data.set(fPixels);
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  downloadCanPassportBarcode() {
    const dataUrl = this.canPassBarcodeSvg();
    const verticalNum = this.canPassResult()?.verticalNum;
    if (!dataUrl || !verticalNum) return;

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${verticalNum}_code39.png`;
    a.click();
  }

  copyCanPassport(which: 'passport' | 'vertical' | 'mrz' | 'all') {
    const r = this.canPassResult();
    if (!r) return;

    let text = '';
    switch (which) {
      case 'passport':
        text = r.passportNum;
        break;
      case 'vertical':
        text = r.verticalNum;
        break;
      case 'mrz':
        text = r.mrzPassport.replace(/\n/g, '');
        break;
      case 'all': {
        const mrzLines = r.mrzPassport.split('\n');
        text = [
          `FIRST_NAME: ${r.firstName}`,
          `LAST_NAME: ${r.lastName}`,
          `DOB: ${r.dob}`,
          `SEX: ${r.gender}`,
          `CITY_OF_BIRTH: ${r.cityOfBirth}`,
          `PASSPORT_NUM: ${r.passportNum}`,
          `VERTICAL_NUM: ${r.verticalNum}`,
          `ISSUE_DATE: ${r.issueDate}`,
          `EXPIRY_DATE: ${r.expiryDate}`,
          `ISSUE_DATE_ISO: ${r.issueDateISO}`,
          `EXPIRY_DATE_ISO: ${r.expiryDateISO}`,
          `MRZ_LINE1: ${mrzLines[0]}`,
          `MRZ_LINE2: ${mrzLines[1]}`,
        ].join('\n');
        break;
      }
    }

    navigator.clipboard.writeText(text);
    this.canPassCopied.set(which);
    setTimeout(() => this.canPassCopied.set(null), 1500);
  }

  private loadFavs(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }
    catch { return new Set(); }
  }
}
