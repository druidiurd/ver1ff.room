import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

const W731 = [7, 3, 1];
const HIST_KEY = 'fra_cin_history';

function calcCd(base12: string): string {
  return String(base12.split('').reduce((s, c, i) => s + parseInt(c) * W731[i % 3], 0) % 10);
}

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n: number, len: number) { return String(n).padStart(len, '0'); }

interface HistEntry { code: string; ts: number; }

@Component({
  selector: 'app-fra-cin',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="cin-wrap">

      <!-- Result -->
      <div class="cin-result-box">
        @if (result(); as r) {
          <code class="mono cin-full">{{ r.slice(0, 12) }}<span class="cin-cd">{{ r.slice(12) }}</span></code>
        } @else {
          <span class="mono cin-wait">AWAITING_INPUT</span>
        }
        <div class="cin-actions">
          <button class="cin-btn mono rnd" (click)="randomize()" title="Random">⚄ RND</button>
          <button class="cin-btn mono clr" (click)="clear()">✕ CLR</button>
          <button class="cin-btn mono cpy" (click)="copy()" [disabled]="!result()">
            {{ copied() ? '✓' : '⎘ CPY' }}
          </button>
        </div>
      </div>

      <!-- Form -->
      <div class="cin-grid">
        <div class="cin-field">
          <label class="cin-lbl mono">YEAR (YY)</label>
          <input class="cin-inp mono" [ngModel]="year()" (ngModelChange)="year.set($event)"
            maxlength="2" placeholder="YY" autocomplete="off">
        </div>
        <div class="cin-field">
          <label class="cin-lbl mono">MONTH (MM)</label>
          <input class="cin-inp mono" [ngModel]="month()" (ngModelChange)="month.set($event)"
            maxlength="2" placeholder="MM" autocomplete="off">
        </div>
        <div class="cin-field">
          <label class="cin-lbl mono">DEPT (2D)</label>
          <input class="cin-inp mono" [ngModel]="dept()" (ngModelChange)="dept.set($event)"
            maxlength="2" placeholder="01–95" autocomplete="off">
        </div>
        <div class="cin-field">
          <label class="cin-lbl mono">SERVICE (1D)</label>
          <input class="cin-inp mono" [ngModel]="service()" (ngModelChange)="service.set($event)"
            maxlength="1" placeholder="1" autocomplete="off">
        </div>
        <div class="cin-field cin-full-col">
          <label class="cin-lbl mono">SERIAL (5D)</label>
          <input class="cin-inp mono" style="letter-spacing:4px"
            [ngModel]="serial()" (ngModelChange)="serial.set($event)"
            maxlength="5" placeholder="SSSSS" autocomplete="off">
        </div>
      </div>

      <!-- Formula breakdown -->
      @if (result(); as r) {
        <div class="cin-formula mono">
          <span class="cf-seg">{{ year().padStart(2,'0') }}</span><span class="cf-dot">·</span>
          <span class="cf-seg">{{ month().padStart(2,'0') }}</span><span class="cf-dot">·</span>
          <span class="cf-seg">{{ dept().padStart(2,'0') }}</span><span class="cf-dot">·</span>
          <span class="cf-seg">{{ service() }}</span><span class="cf-dot">·</span>
          <span class="cf-seg">{{ serial().padStart(5,'0') }}</span>
          <span class="cf-dot">=</span>
          <span class="cf-cd">CD {{ r.slice(12) }}</span>
        </div>
      }

      <!-- History -->
      @if (history().length > 0) {
        <div class="hist-block">
          <div class="hist-header mono">
            <span>⏱ RECENT</span>
            <button class="hist-clear mono" (click)="clearHistory()">CLEAR</button>
          </div>
          @for (h of history(); track h.ts) {
            <div class="hist-row">
              <code class="mono hist-code" (click)="restoreHistory(h)">{{ h.code }}</code>
              <span class="mono hist-ts">{{ formatTs(h.ts) }}</span>
              <button class="hist-cpy mono" (click)="copyStr(h.code)">CPY</button>
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    .cin-wrap { display: flex; flex-direction: column; gap: 20px; }

    .cin-result-box {
      display: flex; align-items: center; gap: 14px;
      background: rgba(0,0,0,0.5); border: 1px solid rgba(0,122,255,0.4);
      border-radius: var(--radius); padding: 16px 20px;
      position: relative; overflow: hidden;
    }
    .cin-result-box::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, #007aff, transparent);
    }
    .cin-full { flex: 1; font-size: 1.8rem; font-weight: 800; color: #007aff; letter-spacing: 5px; line-height: 1; }
    .cin-cd { opacity: 0.55; }
    .cin-wait { flex: 1; font-size: 0.65rem; color: var(--text-dim); letter-spacing: 4px; opacity: 0.35; }
    .cin-actions { display: flex; gap: 6px; flex-shrink: 0; }

    .cin-btn {
      font-size: 0.5rem; font-weight: 800; letter-spacing: 1px;
      padding: 7px 10px; border-radius: var(--radius-sm); cursor: pointer;
      border: 1px solid; transition: 0.15s;
    }
    .cin-btn.rnd { background: rgba(0,255,65,0.08); border-color: var(--border-green); color: var(--green); }
    .cin-btn.rnd:hover { background: rgba(0,255,65,0.18); }
    .cin-btn.clr { background: rgba(255,59,48,0.08); border-color: rgba(255,59,48,0.4); color: #ff3b30; }
    .cin-btn.clr:hover { background: rgba(255,59,48,0.18); }
    .cin-btn.cpy { background: rgba(0,122,255,0.1); border-color: rgba(0,122,255,0.4); color: #007aff; }
    .cin-btn.cpy:hover:not(:disabled) { background: rgba(0,122,255,0.2); }
    .cin-btn:disabled { opacity: 0.3; cursor: not-allowed; }

    .cin-grid {
      display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px;
    }
    .cin-full-col { grid-column: 1 / -1; }
    .cin-field { display: flex; flex-direction: column; gap: 5px; }
    .cin-lbl { font-size: 0.48rem; font-weight: 700; color: var(--text-dim); letter-spacing: 1.5px; }
    .cin-inp {
      background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 10px 12px;
      color: #007aff; font-size: 0.9rem; font-weight: 700;
      outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box;
    }
    .cin-inp:focus { border-color: #007aff; }
    .cin-inp::placeholder { color: rgba(255,255,255,0.12); }

    .cin-formula {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      font-size: 0.58rem; padding: 10px 14px;
      background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: var(--radius-sm);
    }
    .cf-seg { color: var(--text-mid); font-weight: 700; }
    .cf-dot { color: var(--text-dim); opacity: 0.4; }
    .cf-cd { color: #007aff; font-weight: 800; margin-left: 4px; }

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
    }
    .hist-code {
      flex: 1; font-size: 0.75rem; color: var(--text-mid); letter-spacing: 3px;
      cursor: pointer; transition: color 0.15s;
    }
    .hist-code:hover { color: #007aff; }
    .hist-ts { font-size: 0.45rem; color: var(--text-dim); flex-shrink: 0; }
    .hist-cpy {
      background: none; border: 1px solid var(--border); color: var(--text-dim);
      font-size: 0.45rem; padding: 2px 7px; border-radius: 3px; cursor: pointer;
      transition: 0.15s;
    }
    .hist-cpy:hover { border-color: var(--border-green); color: var(--green); }

    @media (max-width: 600px) {
      .cin-grid { grid-template-columns: 1fr 1fr; }
      .cin-full { font-size: 1.2rem; letter-spacing: 3px; }
    }
  `]
})
export class FraCinComponent {
  year    = signal('');
  month   = signal('');
  dept    = signal('');
  service = signal('');
  serial  = signal('');
  copied  = signal(false);
  history = signal<HistEntry[]>(this.loadHistory());

  result = computed(() => {
    const y = this.year().trim();
    const mo = this.month().trim();
    const dp = this.dept().trim();
    const sv = this.service().trim();
    const sr = this.serial().trim();
    // All fields must be non-empty before computing
    if (!y || !mo || !dp || !sv || !sr) return null;
    const base = [
      y.padStart(2, '0').slice(0, 2),
      mo.padStart(2, '0').slice(0, 2),
      dp.padStart(2, '0').slice(0, 2),
      sv.slice(0, 1),
      sr.padStart(5, '0').slice(0, 5),
    ].join('');
    if (base.length !== 12 || !/^\d{12}$/.test(base)) return null;
    return base + calcCd(base);
  });

  randomize() {
    this.year.set(pad(rnd(0, 24), 2));
    this.month.set(pad(rnd(1, 12), 2));
    this.dept.set(pad(rnd(1, 95), 2));
    this.service.set(String(rnd(1, 9)));
    this.serial.set(pad(rnd(10000, 99999), 5));
  }

  clear() {
    this.year.set(''); this.month.set(''); this.dept.set('');
    this.service.set(''); this.serial.set('');
  }

  copy() {
    const v = this.result();
    if (!v) return;
    this.saveHistory(v);
    this.copyStr(v);
  }

  copyStr(s: string) {
    navigator.clipboard.writeText(s);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  restoreHistory(h: HistEntry) {
    const c = h.code;
    this.year.set(c.slice(0,2)); this.month.set(c.slice(2,4));
    this.dept.set(c.slice(4,6)); this.service.set(c.slice(6,7));
    this.serial.set(c.slice(7,12));
  }

  clearHistory() { this.history.set([]); localStorage.removeItem(HIST_KEY); }
  formatTs(ts: number) { return new Date(ts).toLocaleTimeString(); }

  private saveHistory(code: string) {
    const next = [{ code, ts: Date.now() }, ...this.history().filter(h => h.code !== code)].slice(0, 8);
    this.history.set(next);
    localStorage.setItem(HIST_KEY, JSON.stringify(next));
  }

  private loadHistory(): HistEntry[] {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
  }
}
