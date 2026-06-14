import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

// ICAO 9303 weighted check digit
function mrzCd(s: string): string {
  const W = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let v = 0;
    if (c >= '0' && c <= '9') v = parseInt(c);
    else if (c >= 'A' && c <= 'Z') v = c.charCodeAt(0) - 55;
    else if (c === '<') v = 0;
    sum += v * W[i % 3];
  }
  return String(sum % 10);
}

// Portuguese NIC check digit: Modulo 11, weights [9,8,7,6,5,4,3,2]
function nicCd(nic8: string): string {
  const W = [9, 8, 7, 6, 5, 4, 3, 2];
  const sum = nic8.split('').reduce((acc, c, i) => acc + parseInt(c) * W[i], 0);
  const rem = 11 - (sum % 11);
  return rem >= 10 ? '0' : String(rem);
}

function pad(s: string, n: number, fill = '<'): string {
  return (s + fill.repeat(n)).slice(0, n).toUpperCase();
}
function rndDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}
function rndAlpha(n: number): string {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: n }, () => a[Math.floor(Math.random() * 26)]).join('');
}
function rndName(): string {
  const names = ['SILVA', 'SANTOS', 'FERREIRA', 'PEREIRA', 'OLIVEIRA', 'COSTA', 'RODRIGUES', 'MARTINS', 'JESUS', 'SOUSA'];
  return names[Math.floor(Math.random() * names.length)];
}
function rndGivenName(): string {
  const names = ['MARIA', 'JOAO', 'ANA', 'JOSE', 'PEDRO', 'PAULO', 'LUIS', 'CARLOS', 'MANUEL', 'ANTONIO'];
  return names[Math.floor(Math.random() * names.length)];
}
function fmtDate(s: string): string {
  // DDMMYYYY → YYMMDD  e.g. "17101996" → "961017"
  if (s.length !== 8) return '000000';
  return s.slice(6, 8) + s.slice(2, 4) + s.slice(0, 2);
}

function cleanName(s: string): string {
  return s.toUpperCase().replace(/\s+/g, '<').replace(/[^A-Z<]/g, '');
}

const HIST_KEY = 'pt_id_mrz_history';
interface HistEntry { lines: string[]; ts: number; }

@Component({
  selector: 'app-pt-id-mrz',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="pt-wrap">

      <!-- MRZ output -->
      <div class="mrz-output-box">
        @if (mrz(); as m) {
          @for (line of m; track $index) {
            <code class="mono mrz-line">{{ line }}</code>
          }
        } @else {
          <span class="mono mrz-wait">AWAITING_INPUT</span>
        }
        <div class="mrz-actions">
          <button class="pt-btn rnd mono" (click)="randomize()">⚄ RND</button>
          <button class="pt-btn clr mono" (click)="clear()">✕ CLR</button>
          <button class="pt-btn cpy mono" (click)="copy()" [disabled]="!mrz()">
            {{ copied() ? '✓' : '⎘ CPY ALL' }}
          </button>
        </div>
      </div>

      <!-- Form -->
      <div class="pt-grid">

        <!-- NIC -->
        <div class="pt-field-group">
          <div class="pt-field">
            <label class="pt-lbl mono">NIC (8 DIGITS)</label>
            <div class="pt-input-row">
              <input class="pt-inp mono" [ngModel]="nic()" (ngModelChange)="nic.set($event)"
                maxlength="8" placeholder="12345678" autocomplete="off">
              <span class="pt-derived mono">CD: {{ nicCheckDigit() }}</span>
            </div>
          </div>
          <div class="pt-field">
            <label class="pt-lbl mono">OPT DATA (3 CHARS)</label>
            <div class="pt-input-row">
              <input class="pt-inp mono" [ngModel]="optData()" (ngModelChange)="optData.set($event.toUpperCase())"
                maxlength="3" placeholder="ZY6" autocomplete="off">
              <span class="pt-derived mono">CD: {{ optCd() }}</span>
            </div>
          </div>
        </div>

        <div class="pt-field">
          <label class="pt-lbl mono">SURNAMES</label>
          <input class="pt-inp mono" [ngModel]="surnames()" (ngModelChange)="surnames.set($event.toUpperCase())"
            maxlength="30" placeholder="SILVA" autocomplete="off">
        </div>

        <div class="pt-field">
          <label class="pt-lbl mono">GIVEN NAMES</label>
          <input class="pt-inp mono" [ngModel]="givenNames()" (ngModelChange)="givenNames.set($event.toUpperCase())"
            maxlength="30" placeholder="MARIA" autocomplete="off">
        </div>

        <div class="pt-field-row">
          <div class="pt-field">
            <label class="pt-lbl mono">DOB (DDMMYYYY)</label>
            <input class="pt-inp mono" [ngModel]="dob()" (ngModelChange)="dob.set($event)"
              maxlength="8" placeholder="15031990" autocomplete="off">
          </div>
          <div class="pt-field">
            <label class="pt-lbl mono">SEX</label>
            <div class="sex-group">
              @for (s of ['M','F','<']; track s) {
                <button class="sex-btn mono" [class.active]="sex() === s" (click)="sex.set(s)">{{ s === '<' ? 'X' : s }}</button>
              }
            </div>
          </div>
          <div class="pt-field">
            <label class="pt-lbl mono">EXPIRY (DDMMYYYY)</label>
            <input class="pt-inp mono" [ngModel]="expiry()" (ngModelChange)="expiry.set($event)"
              maxlength="8" placeholder="15032034" autocomplete="off">
          </div>
        </div>

      </div>

      <!-- History -->
      @if (history().length > 0) {
        <div class="hist-block">
          <div class="hist-header mono">
            <span>⏱ RECENT</span>
            <button class="hist-clear mono" (click)="clearHistory()">CLEAR</button>
          </div>
          @for (h of history(); track h.ts) {
            <div class="hist-row" (click)="restoreHistory(h)">
              <code class="mono hist-code">{{ h.lines[0] }}</code>
              <span class="mono hist-ts">{{ fmtTs(h.ts) }}</span>
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    .pt-wrap { display: flex; flex-direction: column; gap: 20px; }

    /* MRZ output box */
    .mrz-output-box {
      display: flex; flex-direction: column; gap: 10px;
      background: rgba(0,0,0,0.6); border: 1px solid rgba(0,255,65,0.3);
      border-radius: var(--radius); padding: 16px 20px; position: relative; overflow: hidden;
    }
    .mrz-output-box::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--green), transparent);
    }
    .mrz-line {
      font-size: clamp(0.55rem, 1.5vw, 0.8rem); font-weight: 700; color: var(--green);
      letter-spacing: 3px; line-height: 1.8; white-space: pre;
      text-shadow: 0 0 8px var(--green-glow);
    }
    .mrz-wait {
      font-size: 0.65rem; color: var(--text-dim); letter-spacing: 4px; opacity: 0.35;
    }
    .mrz-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }

    /* Buttons */
    .pt-btn {
      font-size: 0.5rem; font-weight: 800; letter-spacing: 1px;
      padding: 7px 12px; border-radius: var(--radius-sm); cursor: pointer;
      border: 1px solid; transition: 0.15s;
    }
    .pt-btn.rnd { background: rgba(0,255,65,0.08); border-color: var(--border-green); color: var(--green); }
    .pt-btn.rnd:hover { background: rgba(0,255,65,0.18); }
    .pt-btn.clr { background: rgba(255,59,48,0.08); border-color: rgba(255,59,48,0.4); color: #ff3b30; }
    .pt-btn.clr:hover { background: rgba(255,59,48,0.18); }
    .pt-btn.cpy { background: rgba(0,255,65,0.08); border-color: var(--border-green); color: var(--green); }
    .pt-btn.cpy:hover:not(:disabled) { background: rgba(0,255,65,0.18); }
    .pt-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    /* Form */
    .pt-grid { display: flex; flex-direction: column; gap: 14px; }
    .pt-field-group { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .pt-field-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .pt-field { display: flex; flex-direction: column; gap: 5px; }
    .pt-lbl { font-size: 0.48rem; font-weight: 700; color: var(--text-dim); letter-spacing: 1.5px; }
    .pt-input-row { display: flex; gap: 8px; align-items: center; }
    .pt-inp {
      flex: 1; background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 10px 12px;
      color: var(--green); font-size: 0.9rem; font-weight: 700;
      outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box;
      min-width: 0;
    }
    .pt-inp:focus { border-color: var(--border-green); }
    .pt-inp::placeholder { color: rgba(255,255,255,0.1); }
    .pt-derived {
      font-size: 0.55rem; font-weight: 700; color: var(--text-dim);
      white-space: nowrap; flex-shrink: 0;
    }

    /* Sex buttons */
    .sex-group { display: flex; gap: 6px; }
    .sex-btn {
      flex: 1; padding: 8px 4px; background: rgba(0,0,0,0.4);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text-dim); font-size: 0.7rem; font-weight: 800;
      cursor: pointer; transition: 0.15s;
    }
    .sex-btn.active { border-color: var(--green); color: var(--green); background: var(--green-dim); }
    .sex-btn:hover:not(.active) { border-color: var(--border-green); color: var(--text); }

    /* History */
    .hist-block { display: flex; flex-direction: column; gap: 6px; }
    .hist-header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.48rem; color: var(--text-dim); letter-spacing: 2px; padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }
    .hist-clear {
      background: none; border: none; color: var(--text-dim); cursor: pointer;
      font-size: 0.45rem; letter-spacing: 1px;
    }
    .hist-clear:hover { color: #ff3b30; }
    .hist-row {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 10px; background: rgba(0,0,0,0.3);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      cursor: pointer; transition: border-color 0.15s;
    }
    .hist-row:hover { border-color: var(--border-green); }
    .hist-code {
      flex: 1; font-size: 0.6rem; color: var(--text-mid); letter-spacing: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .hist-ts { font-size: 0.45rem; color: var(--text-dim); flex-shrink: 0; }

    @media (max-width: 600px) {
      .pt-field-group, .pt-field-row { grid-template-columns: 1fr; }
      .mrz-line { font-size: 0.45rem; letter-spacing: 1px; }
    }
  `]
})
export class PtIdMrzComponent {
  nic        = signal('');
  optData    = signal('');
  surnames   = signal('');
  givenNames = signal('');
  dob        = signal('');
  sex        = signal('M');
  expiry     = signal('');
  copied     = signal(false);
  history    = signal<HistEntry[]>(this.loadHistory());

  nicCheckDigit = computed(() => {
    const n = this.nic();
    return /^\d{8}$/.test(n) ? nicCd(n) : '?';
  });

  // opt_cd = checksum of entire doc_block (NIC+NIC_CD+"<"+OPT), not just OPT alone
  optCd = computed(() => {
    const n = this.nic();
    if (!/^\d{8}$/.test(n)) return '?';
    const ncd = nicCd(n);
    const o = pad(this.optData() || '', 3);
    return mrzCd(n + ncd + '<' + o);
  });

  mrz = computed((): string[] | null => {
    const nicVal  = this.nic();
    const optVal  = pad(this.optData() || '', 3);   // 3 chars, padded with '<'
    const surnVal = this.surnames().trim();
    const givnVal = this.givenNames().trim();
    const dobVal  = this.dob();
    const expVal  = this.expiry();
    const sexVal  = this.sex() || '<';

    if (!/^\d{8}$/.test(nicVal)) return null;
    if (!/^\d{8}$/.test(dobVal) || !/^\d{8}$/.test(expVal)) return null;
    if (!surnVal) return null;

    const nicCheckD = nicCd(nicVal);

    // doc_block = NIC(8) + NIC_CD(1) + "<" + OPT_DATA(3)  →  13 chars
    const docBlock  = nicVal + nicCheckD + '<' + optVal;
    // opt_cd = checksum of doc_block
    const optCdVal  = mrzCd(docBlock);

    // LINE 1: "I<PRT" + doc_block + opt_cd  →  padded to 30
    const line1 = pad('I<PRT' + docBlock + optCdVal, 30);

    // DOB / EXP sub-checksums
    const dobMrz = fmtDate(dobVal);   // DDMMYYYY → YYMMDD
    const dobCd  = mrzCd(dobMrz);
    const expMrz = fmtDate(expVal);
    const expCd  = mrzCd(expMrz);

    // Composite payload: line1[5:] (25) + dob+dob_cd (7) + exp+exp_cd (7) + "<<<<<<<<<<<" (11) = 50 chars
    const l1mrd             = line1.slice(5);                          // 25 chars
    const compositePayload  = l1mrd + dobMrz + dobCd + expMrz + expCd + '<<<<<<<<<<<'; // 50 chars
    const compCd            = mrzCd(compositePayload);

    // LINE 2: dob(6)+dob_cd+sex+exp(6)+exp_cd+"PRT"+"<<<<<<<<<<<"+comp_cd  →  30 chars
    const line2 = dobMrz + dobCd + sexVal + expMrz + expCd + 'PRT<<<<<<<<<<<' + compCd;

    // LINE 3: surnames + "<<" + given names, padded to 30
    const line3 = pad(cleanName(surnVal) + '<<' + cleanName(givnVal), 30);

    return [line1, line2, line3];
  });

  randomize() {
    const nic8 = rndDigits(8);
    const optD = rndAlpha(2) + rndDigits(1);
    const birthYear = 1960 + Math.floor(Math.random() * 40);
    const birthMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const birthDay   = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    const expYear = 2025 + Math.floor(Math.random() * 10);
    const expMonth = birthMonth;
    const expDay   = birthDay;

    this.nic.set(nic8);
    this.optData.set(optD);
    this.surnames.set(rndName());
    this.givenNames.set(rndGivenName());
    this.dob.set(`${birthDay}${birthMonth}${birthYear}`);
    this.sex.set(Math.random() > 0.5 ? 'M' : 'F');
    this.expiry.set(`${expDay}${expMonth}${expYear}`);
  }

  clear() {
    this.nic.set(''); this.optData.set(''); this.surnames.set('');
    this.givenNames.set(''); this.dob.set(''); this.sex.set('M'); this.expiry.set('');
  }

  copy() {
    const m = this.mrz();
    if (!m) return;
    const text = m.join('\n');
    this.saveHistory(m);
    navigator.clipboard.writeText(text);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  restoreHistory(h: HistEntry) {
    // parse line1 & line2 back into fields (best effort)
    const l1 = h.lines[0];
    this.nic.set(l1.slice(5, 13));
  }

  clearHistory() { this.history.set([]); localStorage.removeItem(HIST_KEY); }
  fmtTs(ts: number) { return new Date(ts).toLocaleTimeString(); }

  private saveHistory(lines: string[]) {
    const next = [{ lines, ts: Date.now() }, ...this.history()].slice(0, 8);
    this.history.set(next);
    localStorage.setItem(HIST_KEY, JSON.stringify(next));
  }

  private loadHistory(): HistEntry[] {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
  }
}
