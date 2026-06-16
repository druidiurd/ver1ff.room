import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
      { id: 'irl_ndls', icon: '🪪', label: 'NDLS-GEN',    desc: 'Irish NDLS driving licence field generator. Field 4d (front ctrl #), Field 5 (back lic #), 16-char horizontal code. Age-group validity for B/BE categories.', color: '#06b6d4', tag: 'CARD·DL' },
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
      { id: 'pl_pesel',     icon: '🆔', label: 'PESEL',     desc: 'Polish PESEL number. 11 digits: YYMMDD + 4-digit serial (gender-encoded) + check digit. Weights [1,3,7,9,...].', color: '#e02e2e', tag: 'PESEL' },
      { id: 'pl_doc_dates', icon: '📅', label: 'DOC DATES', desc: 'Generates valid Polish ID card and passport issue/expiry dates. Validity: 5yr (under 12), 10yr (adult).', color: '#ff6b35', tag: 'DOCS' },
      { id: 'mrz_gen', ...MRZ_PP },
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
];

const FAV_KEY = 'id_lab_favorites';

@Component({
  selector: 'app-id-lab',
  standalone: true,
  imports: [FormsModule, MrzForgeComponent],
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

                  } @else if (t.id === 'pl_pesel') {
                    <!-- Inline PL PESEL card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (peselResult()) {
                        <div class="tax-result" [style.border-color]="'rgba(224,46,46,0.35)'">
                          <code class="mono tax-id" [style.color]="t.color" style="letter-spacing:3px">{{ peselResult() }}</code>
                          <button class="tax-copy mono" [style.color]="t.color"
                            [style.border-color]="'rgba(224,46,46,0.4)'"
                            (click)="copyPesel()">{{ peselCopied() ? '✓' : 'CPY' }}</button>
                        </div>
                      }
                      <div class="il-field-row">
                        <div class="il-field">
                          <label class="il-lbl">DOB (DD-MM-YYYY)</label>
                          <input class="il-inp" [ngModel]="peselDob()" (ngModelChange)="peselDob.set($event)"
                            placeholder="01-01-1990" maxlength="10" autocomplete="off">
                        </div>
                        <div class="il-field il-field-sm">
                          <label class="il-lbl">SEX</label>
                          <div class="il-sex">
                            @for (g of ['M','F']; track g) {
                              <button class="il-sex-btn" [class.active]="peselGender() === g"
                                [style.--sc]="t.color" (click)="peselGender.set(g === 'M' ? 'M' : 'F')">{{ g }}</button>
                            }
                          </div>
                        </div>
                      </div>
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genPesel()" [style.background]="t.color" style="flex:2">⚡ GEN</button>
                        <button class="il-btn-sm mono" (click)="randomPesel()">⚄</button>
                        <button class="il-btn-sm mono" (click)="clearPesel()" style="color:#ff3b30">✕</button>
                      </div>
                    </div>

                  } @else if (t.id === 'pl_doc_dates') {
                    <!-- Inline PL DOC DATES card -->
                    <div class="tool-card inline-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>
                      @if (docResult(); as r) {
                        <div class="doc-dates-block">
                          <div class="doc-row">
                            <span class="doc-type">🪪 ID CARD ({{ r.idYrs }}yr)</span>
                            <span class="doc-date">{{ r.idIssue }} → <strong>{{ r.idExpiry }}</strong></span>
                          </div>
                          <div class="doc-row">
                            <span class="doc-type">📕 PASSPORT ({{ r.ppYrs }}yr)</span>
                            <span class="doc-date">{{ r.ppIssue }} → <strong>{{ r.ppExpiry }}</strong></span>
                          </div>
                        </div>
                      }
                      <div class="il-field">
                        <label class="il-lbl">DOB (DD-MM-YYYY)</label>
                        <input class="il-inp" [ngModel]="docDob()" (ngModelChange)="docDob.set($event)"
                          placeholder="01-01-1990" maxlength="10" autocomplete="off">
                      </div>
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genDocDates()" [style.background]="t.color" style="flex:2">⚡ GEN</button>
                        <button class="il-btn-sm mono" (click)="randomDocDob()">⚄</button>
                        @if (docResult()) {
                          <button class="il-btn-sm mono" (click)="copyDoc()">{{ docCopied() ? '✓' : '⎘' }}</button>
                        }
                      </div>
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

                  } @else if (t.id === 'irl_ndls') {
                    <!-- Inline IRL NDLS card -->
                    <div class="tool-card inline-card ndls-card mono" [style.--tc]="t.color">
                      <div class="tc-top">
                        <span class="tc-icon">{{ t.icon }}</span>
                        <span class="tc-tag" [style.color]="t.color">{{ t.tag }}</span>
                      </div>
                      <div class="tc-label" [style.color]="t.color">{{ t.label }}</div>

                      @if (ndlsResult(); as r) {
                        <div class="ndls-result">
                          <div class="ndls-section-label mono">FRONT</div>
                          <div class="ndls-row">
                            <span class="ndls-key">CTRL #</span>
                            <code class="ndls-val">{{ r.frontNum }}</code>
                            <button class="ndls-cpy" [style.color]="t.color" (click)="copyNdls('front')">{{ ndlsCopied() === 'front' ? '✓' : '⎘' }}</button>
                          </div>
                          <div class="ndls-row">
                            <span class="ndls-key">HORIZ</span>
                            <code class="ndls-val ndls-horiz">{{ r.horizCode }}</code>
                            <button class="ndls-cpy" [style.color]="t.color" (click)="copyNdls('horiz')">{{ ndlsCopied() === 'horiz' ? '✓' : '⎘' }}</button>
                          </div>
                          <div class="ndls-divider"></div>
                          <div class="ndls-section-label mono">BACK</div>
                          <div class="ndls-row">
                            <span class="ndls-key">LIC #</span>
                            <code class="ndls-val ndls-lic">{{ r.licNum }}</code>
                            <button class="ndls-cpy" [style.color]="t.color" (click)="copyNdls('lic')">{{ ndlsCopied() === 'lic' ? '✓' : '⎘' }}</button>
                          </div>
                          <div class="ndls-divider"></div>
                          <div class="ndls-row ndls-meta">
                            <span class="ndls-key">ISSUED</span>
                            <span class="ndls-date">{{ r.issueDate }}</span>
                          </div>
                          <div class="ndls-row ndls-meta">
                            <span class="ndls-key">EXPIRES</span>
                            <span class="ndls-date ndls-exp" [style.color]="t.color">{{ r.expiryDate }}</span>
                            <span class="ndls-badge" [style.background]="'rgba(6,182,212,0.12)'" [style.color]="t.color">{{ r.validityYrs }}yr · age {{ r.ageAtIssue }}</span>
                          </div>
                          @if (r.catB) {
                            <div class="ndls-divider"></div>
                            <div class="ndls-cats">
                              <div class="ndls-cat-row">
                                <span class="ndls-cat-label" [style.color]="t.color">B</span>
                                <span class="ndls-cat-range">{{ r.catB.start }} → {{ r.catB.end }}</span>
                              </div>
                              <div class="ndls-cat-row">
                                <span class="ndls-cat-label" [style.color]="t.color">BE</span>
                                <span class="ndls-cat-range">{{ r.catB.start }} → {{ r.catB.end }}</span>
                              </div>
                            </div>
                          }
                          <button class="ndls-copy-all mono" [style.border-color]="'rgba(6,182,212,0.3)'" [style.color]="t.color"
                            (click)="copyNdls('all')">{{ ndlsCopied() === 'all' ? '✓ COPIED' : '⎘ CPY ALL' }}</button>
                        </div>
                      }

                      <div class="il-field">
                        <label class="il-lbl">DOB (DD-MM-YYYY)</label>
                        <input class="il-inp" [ngModel]="ndlsDob()" (ngModelChange)="ndlsDob.set($event)"
                          placeholder="01-01-1990" maxlength="10" autocomplete="off">
                      </div>
                      <div class="il-field">
                        <label class="il-lbl">ISSUE DATE <span style="opacity:.5">(DD-MM-YYYY, blank = today)</span></label>
                        <input class="il-inp" [ngModel]="ndlsIssue()" (ngModelChange)="ndlsIssue.set($event)"
                          placeholder="auto" maxlength="10" autocomplete="off">
                      </div>
                      <div class="il-btn-row">
                        <button class="tax-btn mono" (click)="genNdls()" [style.background]="t.color" style="flex:2">⚡ GEN</button>
                        <button class="il-btn-sm mono" (click)="randomNdls()" title="Random DOB">⚄</button>
                        <button class="il-btn-sm mono" (click)="clearNdls()" style="color:#ff3b30">✕</button>
                      </div>
                    </div>

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
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 14px; overflow-y: auto;
    }

    .tool-card {
      display: flex; flex-direction: column; gap: 10px;
      padding: 18px 20px;
      background: rgba(0,0,0,0.4);
      border: 1px solid color-mix(in srgb, var(--tc) 20%, var(--border));
      border-radius: var(--radius);
      cursor: pointer; text-align: left;
      transition: border-color 0.15s, background 0.15s, transform 0.1s;
      position: relative; overflow: hidden;
    }
    .tool-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--tc), transparent);
      opacity: 0.5;
    }
    .tool-card:hover {
      border-color: var(--tc);
      background: color-mix(in srgb, var(--tc) 6%, rgba(0,0,0,0.4));
      transform: translateY(-1px);
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
    .il-inp::placeholder { color: rgba(255,255,255,0.1); font-family: inherit; }
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
    .doc-row { display: flex; flex-direction: column; gap: 2px; }
    .doc-type { font-size: 0.45rem; color: var(--text-dim); letter-spacing: 1px; }
    .doc-date { font-size: 0.65rem; color: var(--text-mid); letter-spacing: 1px; }
    .doc-date strong { color: #ff6b35; }

    /* IRL NDLS card */
    .ndls-card { grid-column: 1 / -1; }
    .ndls-result {
      display: flex; flex-direction: column; gap: 5px;
      background: rgba(6,182,212,0.04);
      border: 1px solid rgba(6,182,212,0.2);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      position: relative; overflow: hidden;
    }
    .ndls-result::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, #06b6d4, transparent);
      opacity: 0.5;
    }
    .ndls-section-label {
      font-size: 0.42rem; letter-spacing: 3px; color: #06b6d4;
      opacity: 0.6; margin-top: 2px;
    }
    .ndls-row {
      display: flex; align-items: center; gap: 10px;
    }
    .ndls-key {
      font-size: 0.45rem; color: var(--text-dim); letter-spacing: 1px;
      width: 42px; flex-shrink: 0;
    }
    .ndls-val {
      flex: 1; font-size: 0.68rem; letter-spacing: 2px; color: var(--text);
    }
    .ndls-horiz { letter-spacing: 1.5px; font-size: 0.62rem; }
    .ndls-lic { color: #06b6d4; }
    .ndls-cpy {
      background: none; border: none; cursor: pointer;
      font-size: 0.7rem; color: var(--text-dim); padding: 2px 4px;
      transition: color 0.15s; flex-shrink: 0;
    }
    .ndls-cpy:hover { color: #06b6d4; }
    .ndls-divider {
      height: 1px; background: rgba(6,182,212,0.12); margin: 3px 0;
    }
    .ndls-meta { gap: 8px; }
    .ndls-date { font-size: 0.6rem; color: var(--text-mid); letter-spacing: 1px; }
    .ndls-exp { font-weight: 700; }
    .ndls-badge {
      font-size: 0.4rem; letter-spacing: 1px; padding: 2px 6px;
      border-radius: 3px; margin-left: auto;
    }
    .ndls-cats { display: flex; flex-direction: column; gap: 4px; }
    .ndls-cat-row { display: flex; align-items: center; gap: 10px; }
    .ndls-cat-label {
      font-size: 0.55rem; font-weight: 800; letter-spacing: 2px; width: 20px;
    }
    .ndls-cat-range { font-size: 0.55rem; color: var(--text-mid); letter-spacing: 1px; }
    .ndls-copy-all {
      margin-top: 6px; padding: 5px 10px; border-radius: var(--radius-sm);
      background: rgba(6,182,212,0.06); border: 1px solid;
      font-size: 0.5rem; font-weight: 800; letter-spacing: 2px;
      cursor: pointer; transition: background 0.15s; align-self: flex-start;
    }
    .ndls-copy-all:hover { background: rgba(6,182,212,0.14); }

    @media (max-width: 767px) {
      .lab-body { flex-direction: column; }
      .country-panel { width: 100%; }
      .tool-grid { grid-template-columns: 1fr; }
      .ndls-card { grid-column: auto; }
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

  // IRL NDLS
  ndlsDob    = signal('');
  ndlsIssue  = signal('');
  ndlsResult = signal<{
    frontNum: string; licNum: string; horizCode: string;
    issueDate: string; expiryDate: string; validityYrs: number;
    ageAtIssue: number; catB: { start: string; end: string } | null;
  } | null>(null);
  ndlsCopied = signal<string | null>(null);

  // PL DOC DATES
  docDob     = signal('');
  docResult  = signal<{ idIssue: string; idExpiry: string; idYrs: number; ppIssue: string; ppExpiry: string; ppYrs: number } | null>(null);
  docCopied  = signal(false);


  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('country');
    if (code) {
      const c = COUNTRIES.find(x => x.code === code);
      if (c) this.selected.set(c);
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

  // ── IRL NDLS ─────────────────────────────────────────────────────
  private readonly ndlsB36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  private ndlsToB36(n: number, len: number): string {
    let s = ''; let x = Math.max(0, Math.round(n));
    for (let i = 0; i < len; i++) { s = this.ndlsB36[x % 36] + s; x = Math.floor(x / 36); }
    return s;
  }

  // Field 5 = "0001" + 6-char base-36 sequential counter (ascending with issue date).
  // Anchors from 7 real NDLS cards (Apr 2016 – Jan 2017).
  private ndlsField5(issueDate: Date): string {
    const A: [number, number][] = [
      [Date.UTC(2016, 3, 23), 257_035_546],
      [Date.UTC(2016, 5, 22), 388_770_597],
      [Date.UTC(2016, 11,  3), 744_392_411],
      [Date.UTC(2016, 11, 17), 771_366_667],
      [Date.UTC(2017,  0,  5), 795_134_008],
      [Date.UTC(2017,  0, 14), 816_700_003],
    ];
    const t = issueDate.getTime();
    let val: number;
    if (t <= A[0][0]) {
      const r = (A[1][1] - A[0][1]) / (A[1][0] - A[0][0]);
      val = A[0][1] + r * (t - A[0][0]);
    } else if (t >= A[A.length - 1][0]) {
      const n = A.length - 1;
      const r = (A[n][1] - A[n-1][1]) / (A[n][0] - A[n-1][0]);
      val = A[n][1] + r * (t - A[n][0]);
    } else {
      let lo = 0;
      for (let i = 0; i < A.length - 1; i++) { if (A[i][0] <= t && t < A[i+1][0]) { lo = i; break; } }
      const frac = (t - A[lo][0]) / (A[lo+1][0] - A[lo][0]);
      val = A[lo][1] + frac * (A[lo+1][1] - A[lo][1]);
    }
    val = Math.round(val) + Math.floor((Math.random() - 0.5) * 500_000);
    const maxB36 = 36**6;
    val = ((val % maxB36) + maxB36) % maxB36; // wrap instead of clamp
    return '0001' + this.ndlsToB36(val, 6);
  }

  // Horizontal code (field 12 back) — PP + CCCCCCCCCCCC + SS (16 chars total)
  // PP: 60=H1-2016(Jan-Jun), 62=H2-2016(Jul-Dec)+H1-2017
  // CC: 12-char uppercase hex sequential counter interpolated from real samples
  // SS: 'AD' for H1-2016; decimal (23 + 11×months_since_Dec2016) for H2+
  private ndlsHorizNum(issueDate: Date): string {
    const m = issueDate.getMonth() + 1;
    const y = issueDate.getFullYear();
    const h1_2016 = y === 2016 && m <= 6;
    const prefix = h1_2016 ? '60' : '62';

    let suffix: string;
    if (h1_2016) {
      suffix = 'AD';
    } else {
      const msd = (y - 2016) * 12 + (m - 12);
      suffix = ((23 + 11 * Math.max(0, msd)) % 100).toString().padStart(2, '0');
    }

    const t = BigInt(issueDate.getTime());
    let counter: bigint;
    if (h1_2016) {
      const a1t = BigInt(Date.UTC(2016, 3, 23));
      const rate = (BigInt('0x313E081D1325') - BigInt('0x233F03313225')) / BigInt(60 * 86400 * 1000);
      counter = BigInt('0x233F03313225') + rate * (t - a1t);
    } else {
      const a1t = BigInt(Date.UTC(2016, 11, 3));
      const rate = (BigInt('0x56C312151325') - BigInt('0x56C30C131025')) / BigInt(14 * 86400 * 1000);
      counter = BigInt('0x56C30C131025') + rate * (t - a1t);
    }
    const maxH = BigInt('0xFFFFFFFFFFFF');
    const vr = BigInt(Math.floor((Math.random() - 0.5) * 10_000_000));
    counter = counter < 0n ? 0n : counter > maxH ? maxH : counter + vr;

    return prefix + counter.toString(16).padStart(12, '0').slice(-12).toUpperCase() + suffix;
  }

  private ndlsFmt(d: Date): string {
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
  }

  genNdls() {
    const dobM = this.ndlsDob().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!dobM) return;
    const [, dd, mm, yyyy] = dobM.map(Number);
    if (!dd || !mm || !yyyy) return;

    let issueDate: Date;
    const issM = this.ndlsIssue().match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (issM) {
      const [, id, im, iy] = issM.map(Number);
      issueDate = new Date(iy, im - 1, id);
    } else {
      issueDate = new Date();
    }

    const birthDate = new Date(yyyy, mm - 1, dd);
    const ageAtIssue = Math.floor((issueDate.getTime() - birthDate.getTime()) / (365.25 * 86400000));
    if (ageAtIssue < 0) return;

    let validityYrs: number;
    let expiryDate: Date;
    if (ageAtIssue < 65) {
      validityYrs = 10;
      expiryDate = new Date(issueDate.getFullYear() + 10, issueDate.getMonth(), issueDate.getDate());
    } else if (ageAtIssue < 72) {
      validityYrs = 75 - ageAtIssue;
      expiryDate = new Date(yyyy + 75, mm - 1, dd);
    } else {
      validityYrs = 3;
      expiryDate = new Date(issueDate.getFullYear() + 3, issueDate.getMonth(), issueDate.getDate());
    }

    const rndDigits = (n: number) => Array.from({length: n}, () => Math.floor(Math.random() * 10)).join('');

    // Field 4d: office prefix (known NDLS batches) + sequential 6-digit suffix
    const prefixes = ['050', '110', '280', '290', '292', '550'];
    const officePrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const frontNum = officePrefix + rndDigits(6);
    const licNum = this.ndlsField5(issueDate);
    const horizCode = this.ndlsHorizNum(issueDate);
    const catB = ageAtIssue >= 17 ? { start: this.ndlsFmt(issueDate), end: this.ndlsFmt(expiryDate) } : null;

    this.ndlsResult.set({ frontNum, licNum, horizCode, issueDate: this.ndlsFmt(issueDate), expiryDate: this.ndlsFmt(expiryDate), validityYrs, ageAtIssue, catB });
  }

  randomNdls() {
    const yr = 1965 + Math.floor(Math.random() * 40);
    const mo = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const dy = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    this.ndlsDob.set(`${dy}-${mo}-${yr}`);
    // Random issue date in 2015–2024 range so Field 5 counter stays in realistic range
    const issYr = 2015 + Math.floor(Math.random() * 10);
    const issMo = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const issDy = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    this.ndlsIssue.set(`${issDy}-${issMo}-${issYr}`);
    this.genNdls();
  }

  clearNdls() { this.ndlsDob.set(''); this.ndlsIssue.set(''); this.ndlsResult.set(null); }

  copyNdls(field: string) {
    const r = this.ndlsResult(); if (!r) return;
    const texts: Record<string, string> = {
      front: r.frontNum,
      lic: r.licNum,
      horiz: r.horizCode,
      all: `FRONT #  ${r.frontNum}\nLIC #    ${r.licNum}\nHORIZ    ${r.horizCode}\nISSUED   ${r.issueDate}\nEXPIRES  ${r.expiryDate}`,
    };
    navigator.clipboard.writeText(texts[field] ?? '');
    this.ndlsCopied.set(field);
    setTimeout(() => this.ndlsCopied.set(null), 1500);
  }

  private loadFavs(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }
    catch { return new Set(); }
  }
}
