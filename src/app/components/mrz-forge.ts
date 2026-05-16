import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../store';

interface Country { code: string; name: string; }

const COUNTRIES: Country[] = [
  { code: 'AFG', name: 'Afghanistan' }, { code: 'ALB', name: 'Albania' },
  { code: 'DZA', name: 'Algeria' }, { code: 'AND', name: 'Andorra' },
  { code: 'AGO', name: 'Angola' }, { code: 'ARG', name: 'Argentina' },
  { code: 'ARM', name: 'Armenia' }, { code: 'AUS', name: 'Australia' },
  { code: 'AUT', name: 'Austria' }, { code: 'AZE', name: 'Azerbaijan' },
  { code: 'BHS', name: 'Bahamas' }, { code: 'BHR', name: 'Bahrain' },
  { code: 'BGD', name: 'Bangladesh' }, { code: 'BLR', name: 'Belarus' },
  { code: 'BEL', name: 'Belgium' }, { code: 'BLZ', name: 'Belize' },
  { code: 'BEN', name: 'Benin' }, { code: 'BTN', name: 'Bhutan' },
  { code: 'BOL', name: 'Bolivia' }, { code: 'BIH', name: 'Bosnia & Herz.' },
  { code: 'BWA', name: 'Botswana' }, { code: 'BRA', name: 'Brazil' },
  { code: 'BRN', name: 'Brunei' }, { code: 'BGR', name: 'Bulgaria' },
  { code: 'BFA', name: 'Burkina Faso' }, { code: 'BDI', name: 'Burundi' },
  { code: 'CPV', name: 'Cabo Verde' }, { code: 'KHM', name: 'Cambodia' },
  { code: 'CMR', name: 'Cameroon' }, { code: 'CAN', name: 'Canada' },
  { code: 'CAF', name: 'C. African Rep.' }, { code: 'TCD', name: 'Chad' },
  { code: 'CHL', name: 'Chile' }, { code: 'CHN', name: 'China' },
  { code: 'COL', name: 'Colombia' }, { code: 'COM', name: 'Comoros' },
  { code: 'COD', name: 'Congo DR' }, { code: 'COG', name: 'Congo Rep.' },
  { code: 'CRI', name: 'Costa Rica' }, { code: 'CIV', name: "Côte d'Ivoire" },
  { code: 'HRV', name: 'Croatia' }, { code: 'CUB', name: 'Cuba' },
  { code: 'CYP', name: 'Cyprus' }, { code: 'CZE', name: 'Czech Republic' },
  { code: 'DNK', name: 'Denmark' }, { code: 'DJI', name: 'Djibouti' },
  { code: 'DOM', name: 'Dominican Rep.' }, { code: 'ECU', name: 'Ecuador' },
  { code: 'EGY', name: 'Egypt' }, { code: 'SLV', name: 'El Salvador' },
  { code: 'GNQ', name: 'Equatorial Guinea' }, { code: 'ERI', name: 'Eritrea' },
  { code: 'EST', name: 'Estonia' }, { code: 'SWZ', name: 'Eswatini' },
  { code: 'ETH', name: 'Ethiopia' }, { code: 'FJI', name: 'Fiji' },
  { code: 'FIN', name: 'Finland' }, { code: 'FRA', name: 'France' },
  { code: 'GAB', name: 'Gabon' }, { code: 'GMB', name: 'Gambia' },
  { code: 'GEO', name: 'Georgia' }, { code: 'DEU', name: 'Germany' },
  { code: 'GHA', name: 'Ghana' }, { code: 'GRC', name: 'Greece' },
  { code: 'GTM', name: 'Guatemala' }, { code: 'GIN', name: 'Guinea' },
  { code: 'GNB', name: 'Guinea-Bissau' }, { code: 'GUY', name: 'Guyana' },
  { code: 'HTI', name: 'Haiti' }, { code: 'HND', name: 'Honduras' },
  { code: 'HUN', name: 'Hungary' }, { code: 'ISL', name: 'Iceland' },
  { code: 'IND', name: 'India' }, { code: 'IDN', name: 'Indonesia' },
  { code: 'IRN', name: 'Iran' }, { code: 'IRQ', name: 'Iraq' },
  { code: 'IRL', name: 'Ireland' }, { code: 'ISR', name: 'Israel' },
  { code: 'ITA', name: 'Italy' }, { code: 'JAM', name: 'Jamaica' },
  { code: 'JPN', name: 'Japan' }, { code: 'JOR', name: 'Jordan' },
  { code: 'KAZ', name: 'Kazakhstan' }, { code: 'KEN', name: 'Kenya' },
  { code: 'PRK', name: 'Korea (North)' }, { code: 'KOR', name: 'Korea (South)' },
  { code: 'XKX', name: 'Kosovo' }, { code: 'KWT', name: 'Kuwait' },
  { code: 'KGZ', name: 'Kyrgyzstan' }, { code: 'LAO', name: 'Laos' },
  { code: 'LVA', name: 'Latvia' }, { code: 'LBN', name: 'Lebanon' },
  { code: 'LSO', name: 'Lesotho' }, { code: 'LBR', name: 'Liberia' },
  { code: 'LBY', name: 'Libya' }, { code: 'LIE', name: 'Liechtenstein' },
  { code: 'LTU', name: 'Lithuania' }, { code: 'LUX', name: 'Luxembourg' },
  { code: 'MDG', name: 'Madagascar' }, { code: 'MWI', name: 'Malawi' },
  { code: 'MYS', name: 'Malaysia' }, { code: 'MDV', name: 'Maldives' },
  { code: 'MLI', name: 'Mali' }, { code: 'MLT', name: 'Malta' },
  { code: 'MRT', name: 'Mauritania' }, { code: 'MUS', name: 'Mauritius' },
  { code: 'MEX', name: 'Mexico' }, { code: 'MDA', name: 'Moldova' },
  { code: 'MCO', name: 'Monaco' }, { code: 'MNG', name: 'Mongolia' },
  { code: 'MNE', name: 'Montenegro' }, { code: 'MAR', name: 'Morocco' },
  { code: 'MOZ', name: 'Mozambique' }, { code: 'MMR', name: 'Myanmar' },
  { code: 'NAM', name: 'Namibia' }, { code: 'NPL', name: 'Nepal' },
  { code: 'NLD', name: 'Netherlands' }, { code: 'NZL', name: 'New Zealand' },
  { code: 'NIC', name: 'Nicaragua' }, { code: 'NER', name: 'Niger' },
  { code: 'NGA', name: 'Nigeria' }, { code: 'MKD', name: 'North Macedonia' },
  { code: 'NOR', name: 'Norway' }, { code: 'OMN', name: 'Oman' },
  { code: 'PAK', name: 'Pakistan' }, { code: 'PAN', name: 'Panama' },
  { code: 'PNG', name: 'Papua New Guinea' }, { code: 'PRY', name: 'Paraguay' },
  { code: 'PER', name: 'Peru' }, { code: 'PHL', name: 'Philippines' },
  { code: 'POL', name: 'Poland' }, { code: 'PRT', name: 'Portugal' },
  { code: 'QAT', name: 'Qatar' }, { code: 'ROU', name: 'Romania' },
  { code: 'RUS', name: 'Russia' }, { code: 'RWA', name: 'Rwanda' },
  { code: 'SAU', name: 'Saudi Arabia' }, { code: 'SEN', name: 'Senegal' },
  { code: 'SRB', name: 'Serbia' }, { code: 'SLE', name: 'Sierra Leone' },
  { code: 'SGP', name: 'Singapore' }, { code: 'SVK', name: 'Slovakia' },
  { code: 'SVN', name: 'Slovenia' }, { code: 'SOM', name: 'Somalia' },
  { code: 'ZAF', name: 'South Africa' }, { code: 'SSD', name: 'South Sudan' },
  { code: 'ESP', name: 'Spain' }, { code: 'LKA', name: 'Sri Lanka' },
  { code: 'SDN', name: 'Sudan' }, { code: 'SUR', name: 'Suriname' },
  { code: 'SWE', name: 'Sweden' }, { code: 'CHE', name: 'Switzerland' },
  { code: 'SYR', name: 'Syria' }, { code: 'TWN', name: 'Taiwan' },
  { code: 'TJK', name: 'Tajikistan' }, { code: 'TZA', name: 'Tanzania' },
  { code: 'THA', name: 'Thailand' }, { code: 'TLS', name: 'Timor-Leste' },
  { code: 'TGO', name: 'Togo' }, { code: 'TTO', name: 'Trinidad & Tobago' },
  { code: 'TUN', name: 'Tunisia' }, { code: 'TUR', name: 'Turkey' },
  { code: 'TKM', name: 'Turkmenistan' }, { code: 'UGA', name: 'Uganda' },
  { code: 'UKR', name: 'Ukraine' }, { code: 'ARE', name: 'UAE' },
  { code: 'GBR', name: 'United Kingdom' }, { code: 'USA', name: 'United States' },
  { code: 'URY', name: 'Uruguay' }, { code: 'UZB', name: 'Uzbekistan' },
  { code: 'VEN', name: 'Venezuela' }, { code: 'VNM', name: 'Vietnam' },
  { code: 'YEM', name: 'Yemen' }, { code: 'ZMB', name: 'Zambia' },
  { code: 'ZWE', name: 'Zimbabwe' },
].sort((a, b) => a.name.localeCompare(b.name));

interface ForgeFields {
  docType: string;
  nationality: string;
  issuer: string;
  lastname: string;
  firstname: string;
  birthDate: string;
  sex: string;
  docNum: string;
  expiryDate: string;
  subType: string;
  persNum: string;
  optional: string;
}

@Component({
  selector: 'app-mrz-forge',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="forge">
      <!-- Step indicator -->
      <div class="steps">
        @for (s of [1,2,3]; track s) {
          <div class="step" [class.active]="step() === s" [class.done]="step() > s" (click)="goStep(s)">
            <div class="step-num mono">{{ s }}</div>
            <div class="step-label mono">{{ stepLabel(s) }}</div>
          </div>
          @if (s < 3) { <div class="step-line" [class.done]="step() > s"></div> }
        }
      </div>

      <!-- STEP 1: Document type -->
      @if (step() === 1) {
        <div class="step-body fade-in">
          <div class="doc-grid">
            @for (dt of docTypes; track dt.id) {
              <button type="button" class="doc-card" [class.selected]="fields().docType === dt.id" (click)="selectDocType(dt.id)">
                <span class="doc-icon">{{ dt.icon }}</span>
                <span class="mono doc-name">{{ dt.name }}</span>
                <span class="mono doc-fmt">{{ dt.fmt }}</span>
              </button>
            }
          </div>
          <button type="button" class="btn-next mono" [disabled]="!fields().docType" (click)="step.set(2)">
            NEXT → SELECT COUNTRY
          </button>
        </div>
      }

      <!-- STEP 2: Nationality + Issuer -->
      @if (step() === 2) {
        <div class="step-body fade-in">
          <div class="country-grid">
            <div class="country-col">
              <label class="col-label mono">NATIONALITY</label>
              <div class="search-wrap">
                <input class="search-input mono"
                  [ngModel]="natSearch()"
                  (ngModelChange)="natSearch.set($event)"
                  placeholder="Search country..."
                  autocomplete="off">
              </div>
              <div class="country-list">
                @for (c of filteredNat(); track c.code) {
                  <button type="button" class="country-item" [class.selected]="fields().nationality === c.code" (click)="setNat(c.code)">
                    <span class="mono item-code">{{ c.code }}</span>
                    <span class="mono item-name">{{ c.name }}</span>
                  </button>
                }
              </div>
            </div>
            <div class="country-col">
              <label class="col-label mono">ISSUING COUNTRY</label>
              <div class="search-wrap">
                <input class="search-input mono"
                  [ngModel]="issuerSearch()"
                  (ngModelChange)="issuerSearch.set($event)"
                  placeholder="Search country..."
                  autocomplete="off">
              </div>
              <div class="country-list">
                @for (c of filteredIssuer(); track c.code) {
                  <button type="button" class="country-item" [class.selected]="fields().issuer === c.code" (click)="setIssuer(c.code)">
                    <span class="mono item-code">{{ c.code }}</span>
                    <span class="mono item-name">{{ c.name }}</span>
                  </button>
                }
              </div>
            </div>
          </div>
          <div class="step-actions">
            <button type="button" class="btn-back mono" (click)="step.set(1)">← BACK</button>
            <button type="button" class="btn-next mono" [disabled]="!fields().nationality || !fields().issuer" (click)="step.set(3)">
              NEXT → FILL DATA
            </button>
          </div>
        </div>
      }

      <!-- STEP 3: Data fields -->
      @if (step() === 3) {
        <div class="step-body fade-in">
          <div class="sel-row">
            <div class="sel-chip mono" (click)="step.set(2)">
              <span class="chip-lbl">NAT</span>{{ fields().nationality }}
            </div>
            <div class="sel-chip mono" (click)="step.set(2)">
              <span class="chip-lbl">ISS</span>{{ fields().issuer }}
            </div>
            <div class="sel-chip mono" (click)="step.set(1)">
              <span class="chip-lbl">DOC</span>{{ fields().docType }}
            </div>
          </div>

          <div class="field-grid">
            <div class="fg-field">
              <label class="mono fg-label">LAST_NAME</label>
              <input class="mono fg-input"
                [ngModel]="fields().lastname"
                (ngModelChange)="patch('lastname', $event)"
                (blur)="trigger()"
                placeholder="SMITH" autocomplete="off" spellcheck="false">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">FIRST_NAME</label>
              <input class="mono fg-input"
                [ngModel]="fields().firstname"
                (ngModelChange)="patch('firstname', $event)"
                (blur)="trigger()"
                placeholder="JOHN" autocomplete="off" spellcheck="false">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">BIRTH_DATE</label>
              <input class="mono fg-input"
                [ngModel]="fields().birthDate"
                (ngModelChange)="patch('birthDate', $event)"
                (blur)="trigger()"
                placeholder="DD-MM-YYYY" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">SEX</label>
              <div class="sex-group">
                @for (s of ['M','F','U']; track s) {
                  <button type="button" class="sex-btn mono" [class.active]="fields().sex === s" (click)="patch('sex', s); trigger()">{{ s }}</button>
                }
              </div>
            </div>
            <div class="fg-field">
              <label class="mono fg-label">DOCUMENT_NUM</label>
              <input class="mono fg-input"
                [ngModel]="fields().docNum"
                (ngModelChange)="patch('docNum', $event)"
                (blur)="trigger()"
                placeholder="PA1234567" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">EXPIRY_DATE</label>
              <input class="mono fg-input"
                [ngModel]="fields().expiryDate"
                (ngModelChange)="patch('expiryDate', $event)"
                (blur)="trigger()"
                placeholder="DD-MM-YYYY" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">SUB_TYPE <span class="opt">opt</span></label>
              <input class="mono fg-input"
                [ngModel]="fields().subType"
                (ngModelChange)="patch('subType', $event)"
                (blur)="trigger()"
                placeholder="e.g. A" maxlength="1" autocomplete="off">
            </div>
            <div class="fg-field">
              <label class="mono fg-label">PERSONAL_NUM <span class="opt">opt</span></label>
              <input class="mono fg-input"
                [ngModel]="fields().persNum"
                (ngModelChange)="patch('persNum', $event)"
                (blur)="trigger()"
                placeholder="Optional" autocomplete="off">
            </div>
            <div class="fg-field fg-full">
              <label class="mono fg-label">OPTIONAL_FIELD <span class="opt">opt</span></label>
              <input class="mono fg-input"
                [ngModel]="fields().optional"
                (ngModelChange)="patch('optional', $event)"
                (blur)="trigger()"
                placeholder="Optional" autocomplete="off">
            </div>
          </div>

          <button type="button" class="btn-gen mono" [disabled]="!canGenerate() || store.loading()" (click)="trigger()">
            <span>›</span> GENERATE MRZ
            @if (store.loading()) { <span class="btn-loader"></span> }
          </button>

          <button type="button" class="btn-back mono" (click)="step.set(2)">← BACK</button>
        </div>
      }

      <!-- MRZ Output -->
      @if (store.mrzGenResult(); as gen) {
        <div class="forge-output">
          <div class="output-header mono">MRZ_OUTPUT</div>
          @if (gen.MRP) {
            <div class="mrz-format-card">
              <div class="mf-header">
                <span class="mf-tag mono">MRP</span>
                <span class="mf-name mono">PASSPORT · TD3 · 2×44</span>
                <button type="button" class="btn-copy mono" [class.copied]="copiedKey === 'MRP'" (click)="copy(gen.MRP!.join('\n'), 'MRP')">{{ copiedKey === 'MRP' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.MRP; track $index) {
                  <div class="mrz-line-wrap"><code class="mrz-line mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.MRV_A) {
            <div class="mrz-format-card visa">
              <div class="mf-header">
                <span class="mf-tag mono visa">MRV-A</span>
                <span class="mf-name mono">VISA · 2×44</span>
                <button type="button" class="btn-copy visa mono" [class.copied]="copiedKey === 'MRV_A'" (click)="copy(gen.MRV_A!.join('\n'), 'MRV_A')">{{ copiedKey === 'MRV_A' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.MRV_A; track $index) {
                  <div class="mrz-line-wrap visa"><code class="mrz-line visa mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.TD1) {
            <div class="mrz-format-card amber">
              <div class="mf-header">
                <span class="mf-tag mono amber">TD1</span>
                <span class="mf-name mono">ID CARD · 3×30</span>
                <button type="button" class="btn-copy amber mono" [class.copied]="copiedKey === 'TD1'" (click)="copy(gen.TD1!.join('\n'), 'TD1')">{{ copiedKey === 'TD1' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.TD1; track $index) {
                  <div class="mrz-line-wrap amber"><code class="mrz-line amber mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.TD2) {
            <div class="mrz-format-card amber">
              <div class="mf-header">
                <span class="mf-tag mono amber">TD2</span>
                <span class="mf-name mono">ID CARD · 2×36</span>
                <button type="button" class="btn-copy amber mono" [class.copied]="copiedKey === 'TD2'" (click)="copy(gen.TD2!.join('\n'), 'TD2')">{{ copiedKey === 'TD2' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                @for (line of gen.TD2; track $index) {
                  <div class="mrz-line-wrap amber"><code class="mrz-line amber mono">{{ line }}</code></div>
                }
              </div>
            </div>
          }
          @if (gen.EDL) {
            <div class="mrz-format-card edl">
              <div class="mf-header">
                <span class="mf-tag mono edl">eDL</span>
                <span class="mf-name mono">DRIVER LICENSE · 1 LINE</span>
                <button type="button" class="btn-copy edl mono" [class.copied]="copiedKey === 'EDL'" (click)="copy(gen.EDL![0], 'EDL')">{{ copiedKey === 'EDL' ? '✓ OK' : 'COPY' }}</button>
              </div>
              <div class="mrz-block">
                <div class="mrz-line-wrap edl"><code class="mrz-line edl mono">{{ gen.EDL[0] }}</code></div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .forge { display: flex; flex-direction: column; gap: 20px; }

    /* Steps */
    .steps {
      display: flex; align-items: center;
      padding: 0 4px;
    }
    .step {
      display: flex; align-items: center; gap: 8px;
      cursor: pointer; opacity: 0.4; transition: opacity 0.2s;
    }
    .step.active, .step.done { opacity: 1; }
    .step-num {
      width: 22px; height: 22px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.6rem; font-weight: 800;
      background: var(--border); color: var(--text-dim);
      border: 1px solid var(--border); transition: 0.2s;
      flex-shrink: 0;
    }
    .step.active .step-num { background: var(--green); color: #000; border-color: var(--green); box-shadow: 0 0 10px var(--green-glow); }
    .step.done .step-num { background: var(--green-dim); color: var(--green); border-color: var(--green); }
    .step-label { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 1.5px; }
    .step.active .step-label { color: var(--green); }
    .step-line { flex: 1; height: 1px; background: var(--border); margin: 0 8px; min-width: 24px; transition: 0.2s; }
    .step-line.done { background: var(--green); }

    /* Step body */
    .step-body { display: flex; flex-direction: column; gap: 16px; }

    /* Doc type */
    .doc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .doc-card {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 20px 12px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: var(--radius); cursor: pointer; transition: 0.15s;
    }
    .doc-card:hover { border-color: var(--border-green); background: rgba(0,255,65,0.03); }
    .doc-card.selected { border-color: var(--green); background: var(--green-dim); box-shadow: 0 0 20px rgba(0,255,65,0.1); }
    .doc-icon { font-size: 1.8rem; }
    .doc-name { font-size: 0.65rem; font-weight: 700; color: var(--text); letter-spacing: 1px; }
    .doc-fmt { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 1px; }
    .doc-card.selected .doc-name { color: var(--green); }

    /* Country selection */
    .country-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .country-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .col-label { font-size: 0.55rem; font-weight: 700; color: var(--text-dim); letter-spacing: 2px; }
    .search-wrap {
      background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 8px 12px;
      transition: border-color 0.15s;
    }
    .search-wrap:focus-within { border-color: var(--border-green); }
    .search-input {
      width: 100%; background: none; border: none; outline: none;
      color: var(--green); font-size: 0.7rem; box-sizing: border-box;
    }
    .search-input::placeholder { color: var(--text-dim); }
    .country-list {
      max-height: 220px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 2px;
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      padding: 4px;
    }
    .country-item {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 6px;
      background: none; border: none; cursor: pointer;
      text-align: left; transition: background 0.1s; width: 100%;
    }
    .country-item:hover { background: rgba(255,255,255,0.04); }
    .country-item.selected { background: var(--green-dim); }
    .item-code {
      font-size: 0.55rem; font-weight: 800; color: var(--green);
      width: 30px; flex-shrink: 0; letter-spacing: 1px;
    }
    .item-name { font-size: 0.6rem; color: var(--text-mid); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .country-item.selected .item-name { color: var(--text); }

    /* Step actions */
    .step-actions { display: flex; gap: 10px; }
    .btn-next {
      flex: 1; padding: 12px 16px;
      background: var(--green); color: #000;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.65rem; font-weight: 800; letter-spacing: 2px;
      cursor: pointer; transition: 0.15s;
    }
    .btn-next:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-next:disabled { opacity: 0.35; cursor: not-allowed; }
    .btn-back {
      padding: 12px 16px;
      background: none; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim);
      font-size: 0.6rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; align-self: flex-start;
    }
    .btn-back:hover { border-color: var(--border-green); color: var(--text); }

    /* Fields grid */
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .fg-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .fg-full { grid-column: 1 / -1; }
    .fg-label { font-size: 0.5rem; font-weight: 700; color: var(--text-dim); letter-spacing: 1.5px; }
    .opt { font-weight: 400; opacity: 0.6; }
    .fg-input {
      background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 8px 10px;
      color: var(--green); font-size: 0.75rem; font-weight: 700;
      outline: none; transition: border-color 0.15s; width: 100%;
      box-sizing: border-box;
    }
    .fg-input:focus { border-color: var(--border-green); }
    .sex-group { display: flex; gap: 6px; }
    .sex-btn {
      flex: 1; padding: 8px 4px;
      background: none; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim);
      font-size: 0.65rem; font-weight: 800; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s;
    }
    .sex-btn.active { background: var(--green-dim); border-color: var(--green); color: var(--green); }

    /* Generate button */
    .btn-gen {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 20px;
      background: var(--green); color: #000;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.7rem; font-weight: 800; letter-spacing: 2px;
      cursor: pointer; transition: 0.15s; font-family: inherit;
    }
    .btn-gen:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-gen:disabled { opacity: 0.35; cursor: not-allowed; }
    .btn-loader {
      width: 12px; height: 12px;
      border: 2px solid rgba(0,0,0,0.3);
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Selected chips */
    .sel-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .sel-chip {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 10px;
      background: var(--green-dim); border: 1px solid var(--border-green);
      border-radius: 20px; font-size: 0.55rem; font-weight: 700;
      color: var(--green); cursor: pointer; letter-spacing: 1px;
      transition: 0.15s;
    }
    .sel-chip:hover { filter: brightness(1.2); }
    .chip-lbl { color: var(--text-dim); font-size: 0.45rem; margin-right: 4px; }

    /* MRZ output */
    .forge-output { display: flex; flex-direction: column; gap: 12px; }
    .output-header {
      font-size: 0.5rem; font-weight: 700; color: var(--text-dim);
      letter-spacing: 3px; padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }
    .mrz-format-card {
      background: rgba(0,0,0,0.6);
      border: 1px solid var(--border-green);
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 10px;
      box-shadow: 0 0 20px rgba(0,255,65,0.04), inset 0 1px 0 rgba(0,255,65,0.06);
    }
    .mrz-format-card.amber { border-color: rgba(255,149,0,0.35); box-shadow: 0 0 20px rgba(255,149,0,0.04), inset 0 1px 0 rgba(255,149,0,0.06); }
    .mrz-format-card.visa  { border-color: rgba(0,122,255,0.35); box-shadow: 0 0 20px rgba(0,122,255,0.04), inset 0 1px 0 rgba(0,122,255,0.06); }
    .mrz-format-card.edl   { border-color: rgba(168,85,247,0.35); box-shadow: 0 0 20px rgba(168,85,247,0.04), inset 0 1px 0 rgba(168,85,247,0.06); }
    .mf-header { display: flex; align-items: center; gap: 10px; }
    .mf-tag {
      font-size: 0.5rem; font-weight: 800; letter-spacing: 1.5px;
      padding: 3px 8px; border-radius: 4px; flex-shrink: 0;
      background: var(--green-dim); color: var(--green); border: 1px solid var(--border-green);
    }
    .mf-tag.amber { background: rgba(255,149,0,0.12); color: #ff9500; border-color: rgba(255,149,0,0.4); }
    .mf-tag.visa  { background: rgba(0,122,255,0.12); color: #007aff; border-color: rgba(0,122,255,0.4); }
    .mf-tag.edl   { background: rgba(168,85,247,0.12); color: #a855f7; border-color: rgba(168,85,247,0.4); }
    .mf-name { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 1.5px; flex: 1; }
    .mrz-block { display: flex; flex-direction: column; gap: 4px; }
    .mrz-line-wrap {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(0,255,65,0.08);
      border-radius: 4px; padding: 10px 14px; overflow-x: auto;
      position: relative;
    }
    .mrz-line-wrap::before {
      content: '';
      position: absolute; inset: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.015) 2px, rgba(0,255,65,0.015) 4px);
      pointer-events: none; border-radius: 4px;
    }
    .mrz-line-wrap.amber { border-color: rgba(255,149,0,0.1); }
    .mrz-line-wrap.amber::before { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,149,0,0.015) 2px, rgba(255,149,0,0.015) 4px); }
    .mrz-line-wrap.visa  { border-color: rgba(0,122,255,0.1); }
    .mrz-line-wrap.visa::before  { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,122,255,0.015) 2px, rgba(0,122,255,0.015) 4px); }
    .mrz-line-wrap.edl   { border-color: rgba(168,85,247,0.1); }
    .mrz-line-wrap.edl::before   { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(168,85,247,0.015) 2px, rgba(168,85,247,0.015) 4px); }
    .mrz-line {
      font-size: 0.75rem; letter-spacing: 3px; color: var(--green);
      white-space: nowrap; display: block; font-weight: 700;
      text-shadow: 0 0 8px rgba(0,255,65,0.5);
    }
    .mrz-line.amber { color: #ff9500; text-shadow: 0 0 8px rgba(255,149,0,0.4); }
    .mrz-line.visa  { color: #007aff; text-shadow: 0 0 8px rgba(0,122,255,0.4); }
    .mrz-line.edl   { color: #a855f7; text-shadow: 0 0 8px rgba(168,85,247,0.4); }
    .btn-copy {
      background: var(--green-dim); border: 1px solid var(--border-green);
      color: var(--green); font-size: 0.5rem; font-weight: 700;
      padding: 4px 10px; border-radius: 4px; cursor: pointer; letter-spacing: 1px;
      white-space: nowrap; flex-shrink: 0; font-family: inherit;
      transition: 0.15s; min-width: 48px; text-align: center;
    }
    .btn-copy.copied { background: var(--green); color: #000; border-color: var(--green); }
    .btn-copy.amber { background: rgba(255,149,0,0.1); border-color: rgba(255,149,0,0.3); color: #ff9500; }
    .btn-copy.amber.copied { background: #ff9500; color: #000; }
    .btn-copy.visa  { background: rgba(0,122,255,0.1); border-color: rgba(0,122,255,0.3); color: #007aff; }
    .btn-copy.visa.copied  { background: #007aff; color: #fff; }
    .btn-copy.edl   { background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); color: #a855f7; }
    .btn-copy.edl.copied   { background: #a855f7; color: #fff; }

    @media (max-width: 767px) {
      .doc-grid { grid-template-columns: 1fr 1fr; }
      .country-grid { grid-template-columns: 1fr; }
      .field-grid { grid-template-columns: 1fr; }
      .fg-full { grid-column: 1; }
    }
  `]
})
export class MrzForgeComponent {
  store = inject(AppStore);

  step = signal(1);
  natSearch = signal('');
  issuerSearch = signal('');

  fields = signal<ForgeFields>({
    docType: '', nationality: '', issuer: '',
    lastname: '', firstname: '', birthDate: '',
    sex: 'M', docNum: '', expiryDate: '',
    subType: '', persNum: '', optional: '',
  });

  docTypes = [
    { id: 'Passport', icon: '📕', name: 'PASSPORT', fmt: 'MRP · 2×44' },
    { id: 'ID Card',  icon: '🪪', name: 'ID CARD',  fmt: 'TD1 3×30 · TD2 2×36' },
    { id: 'Visa',     icon: '🛂', name: 'VISA',     fmt: 'MRV-A · 2×44' },
  ];

  filteredNat = computed(() => {
    const q = this.natSearch().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  filteredIssuer = computed(() => {
    const q = this.issuerSearch().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  canGenerate() {
    const f = this.fields();
    return !!(f.docType && f.nationality && f.issuer && f.lastname && f.birthDate && f.docNum && f.expiryDate);
  }

  stepLabel(s: number) {
    return ['DOC_TYPE', 'COUNTRY', 'DATA'][s - 1];
  }

  goStep(s: number) {
    if (s <= this.step()) this.step.set(s);
  }

  selectDocType(id: string) {
    this.fields.update(f => ({ ...f, docType: id }));
    this.store.mrzGenResult.set(null);
  }

  setNat(code: string) {
    this.fields.update(f => ({ ...f, nationality: code }));
  }

  setIssuer(code: string) {
    this.fields.update(f => ({ ...f, issuer: code }));
  }

  patch(key: keyof ForgeFields, val: string) {
    this.fields.update(f => ({ ...f, [key]: val }));
  }

  trigger() {
    const f = this.fields();
    const lines = [
      f.docType, f.lastname, f.firstname, f.birthDate,
      f.nationality, f.sex, f.docNum, f.expiryDate,
      f.issuer, f.subType, f.persNum, f.optional,
    ];
    const fd = new FormData();
    fd.append('type', 'mrz_gen');
    fd.append('lines', JSON.stringify(lines));
    this.store.executeJson<import('../store').MrzGenResult>(fd)
      .subscribe(res => this.store.mrzGenResult.set(res));
  }

  copiedKey: string | null = null;

  copy(t: string, key: string) {
    navigator.clipboard.writeText(t);
    this.copiedKey = key;
    setTimeout(() => this.copiedKey = null, 1500);
  }
}
