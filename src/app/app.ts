import { Component, signal, inject, AfterViewInit, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas #matrixCanvas id="matrix"></canvas>

    <div class="v-room" [class.app-active]="selectedApp()">
      <div class="status-island glass">
        <span class="pulse-dot"></span>
        <span class="id-code">UPLINK_STABLE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
      </div>

      <div class="springboard" *ngIf="!selectedApp()">
        <div class="folder-wrap">
          <h2 class="folder-name">IRELAND</h2>
          <div class="icon-grid">
            <div class="app-card" (click)="openApp('energia')">
              <div class="app-icon glass"><span class="neon-tag">PDF</span></div>
              <span class="app-title">IE-bill-gen</span>
            </div>
            <div class="app-card" (click)="openApp('ndls_mrz')">
              <div class="app-icon glass"><span class="neon-tag">MRZ</span></div>
              <span class="app-title">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="folder-wrap">
          <h2 class="folder-name">SYSTEM_TOOLS</h2>
          <div class="icon-grid">
            <div class="app-card locked">
              <div class="app-icon glass">🔒</div>
              <span class="app-title">PROXY_V3</span>
            </div>
          </div>
        </div>
      </div>

      <main class="app-terminal glass" *ngIf="selectedApp()">
        <header class="terminal-header">
          <button (click)="closeApp()" class="esc-btn">ESC_TO_HOME</button>
          <div class="module-id">CORE::{{ selectedApp() === 'energia' ? 'IE-BILL-GEN' : 'IE-NDLS-MRZ' }}</div>
          <div class="header-tools">
            <label class="scan-mode-label" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="custom-check" [class.active]="scanMode()"></span>
              <span class="label-txt">SCAN_EFFECTS</span>
            </label>
          </div>
        </header>

        <div class="form-matrix">
          @for (field of schema(); track field.id) {
            <div class="field-node">
              <label>{{ field.label }}</label>
              <div class="input-wrap glass-inset">
                <input 
                  [(ngModel)]="lines()[$index]" 
                  (ngModelChange)="onInputChange()"
                  [placeholder]="field.p" 
                  spellcheck="false"
                  autocomplete="off"
                >
              </div>
            </div>
          }
        </div>

        <div class="console-output glass-dark" *ngIf="mrzData()">
          <div class="log-row">
            <span class="tag">G2</span>
            <code>{{ mrzData().GEN_2_ISO }}</code>
            <button class="copy-pill" (click)="copy(mrzData().GEN_2_ISO)">COPY</button>
          </div>
          <div class="log-row">
            <span class="tag">G1</span>
            <code>{{ mrzData().GEN_1_LEGACY }}</code>
          </div>
        </div>

        <footer class="terminal-footer">
          <button [disabled]="engine.loading()" (click)="fire()" class="exec-btn-titan">
            <span class="btn-label">> {{ engine.loading() ? 'ENCRYPTING_BUFFER...' : 'EXECUTE_SYNC_COMMAND' }}</span>
            <div class="progress-line" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .v-room { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 30px; position: relative; z-index: 10; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.18; pointer-events: none; }

    /* DYNAMIC ISLAND [cite: 2026-02-05] */
    .status-island { padding: 8px 25px; border-radius: 40px; display: flex; align-items: center; gap: 15px; margin-bottom: 40px; border: 1px solid var(--glass-border); box-shadow: 0 15px 45px #000; }
    .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--matrix-green); box-shadow: 0 0 12px var(--matrix-green); animation: pulse 2s infinite; }
    @keyframes pulse { 50% { opacity: 0.3; } }
    .id-code { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); letter-spacing: 1px; }

    /* SPRINGBOARD [cite: 2026-02-21] */
    .springboard { width: 100%; max-width: 800px; display: flex; flex-direction: column; gap: 50px; }
    .folder-name { font-size: 1.2rem; font-weight: 900; color: #fff; margin-bottom: 30px; padding-left: 10px; border-left: 5px solid var(--matrix-green); }
    .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 35px; }
    .app-card { display: flex; flex-direction: column; align-items: center; gap: 15px; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .app-card:hover { transform: scale(1.1) translateY(-5px); }
    .app-icon { width: 80px; height: 80px; border-radius: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border); }
    .neon-tag { color: var(--matrix-green); font-weight: 900; font-size: 0.9rem; text-shadow: 0 0 10px var(--matrix-green); }
    .app-title { font-size: 0.75rem; font-weight: 800; color: var(--text-dim); }
    .app-card.locked { opacity: 0.2; cursor: not-allowed; }

    /* APP TERMINAL [cite: 2026-02-05] */
    .app-terminal { position: absolute; inset: 25px; border-radius: 35px; padding: 45px; display: flex; flex-direction: column; border: 1px solid var(--glass-border); box-shadow: 0 0 100px #000; z-index: 100; }
    .terminal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 45px; }
    .esc-btn { background: transparent; border: none; color: var(--text-dim); font-weight: 900; font-size: 0.8rem; cursor: pointer; transition: 0.2s; }
    .esc-btn:hover { color: #fff; }
    .module-id { color: var(--matrix-green); font-weight: 900; font-size: 1.3rem; letter-spacing: 3px; }

    .form-matrix { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; flex: 1; overflow-y: auto; padding-right: 10px; }
    .field-node label { font-size: 0.65rem; font-weight: 900; color: var(--text-dim); margin-bottom: 10px; display: block; }
    .input-wrap { padding: 16px 22px; border-radius: 15px; border: 1px solid var(--glass-border); transition: 0.3s; }
    .input-wrap:focus-within { border-color: var(--matrix-green); box-shadow: inset 0 0 15px rgba(0, 255, 65, 0.05); }
    input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: var(--font-mono); font-size: 1rem; }
    input::placeholder { color: #111; }

    .console-output { background: #000; padding: 30px; border-radius: 25px; border: 1px solid var(--glass-border); margin: 25px 0; }
    .log-row { display: flex; align-items: center; gap: 25px; margin-bottom: 12px; font-family: var(--font-mono); font-size: 1rem; }
    .tag { color: var(--matrix-green); font-weight: 900; font-size: 0.7rem; }
    code { color: #fff; flex: 1; letter-spacing: 2px; }
    .copy-pill { background: var(--matrix-green); color: #000; border: none; padding: 5px 15px; border-radius: 25px; font-size: 0.65rem; font-weight: 900; cursor: pointer; }

    .terminal-footer { padding-top: 40px; }
    .exec-btn-titan { width: 100%; padding: 28px; background: transparent; border: 1px solid var(--matrix-green); color: var(--matrix-green); font-weight: 900; cursor: pointer; position: relative; overflow: hidden; font-size: 1.1rem; letter-spacing: 4px; border-radius: 20px; transition: 0.3s; }
    .exec-btn-titan:hover:not(:disabled) { background: var(--matrix-green); color: #000; box-shadow: 0 0 40px var(--matrix-glow); }
    .progress-line { position: absolute; bottom: 0; left: 0; height: 6px; background: #fff; transition: 2.5s linear; }

    .glass { background: var(--glass-dark); backdrop-filter: blur(120px) saturate(180%); }
    .glass-inset { background: rgba(0, 255, 65, 0.01); }
    
    .scan-mode-label { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .scan-mode-label input { display: none; }
    .custom-check { width: 18px; height: 18px; border: 1px solid var(--matrix-green); position: relative; }
    .custom-check.active { background: var(--matrix-green); box-shadow: 0 0 15px var(--matrix-green); }
    .label-txt { font-size: 0.65rem; font-weight: 900; color: var(--text-dim); }
  `]
})
export class App implements AfterViewInit {
  engine = inject(EngineService);
  selectedApp = signal<string | null>(null);
  schema = signal<any[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal(false);
  mrzData = signal<any>(null);
  memoryUsage = signal(128);
  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();

  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  constructor() {
    effect(() => {
      if (this.selectedApp()) {
        this.engine.getSchema(this.selectedApp()!).subscribe(s => {
          this.schema.set(s);
          this.lines.set(new Array(s.length).fill(''));
          this.mrzData.set(null);
        });
      }
    }, { allowSignalWrites: true });
  }

  openApp(n: string) { this.selectedApp.set(n); }
  closeApp() { this.selectedApp.set(null); }

  onInputChange() {
    if (this.selectedApp() === 'ndls_mrz') {
      this.engine.execute(this.selectedApp()!, this.lines(), false).subscribe(res => this.mrzData.set(res));
    }
  }

  fire() {
    this.engine.execute(this.selectedApp()!, this.lines(), this.scanMode()).subscribe(res => {
      if (this.selectedApp() === 'ndls_mrz') this.mrzData.set(res);
      else {
        const url = URL.createObjectURL(res);
        const a = document.createElement('a');
        a.href = url; a.download = `V_OS_IE_${Date.now()}.pdf`; a.click();
      }
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const drops = new Array(Math.floor(canvas.width / 18)).fill(1);
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41"; ctx.font = "16px monospace";
      drops.forEach((y, i) => {
        ctx.fillText(Math.floor(Math.random()*2).toString(), i * 18, y * 18);
        if (y * 18 > canvas.height && Math.random() > 0.985) drops[i] = 0;
        drops[i]++;
      });
    };
    setInterval(draw, 50);
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (240 - 180) + 180)), 3000);
  }
}