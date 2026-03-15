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

    <div class="matrix-os" [class.app-mode]="selectedApp()">
      <div class="dynamic-island glass">
        <span class="pulse-dot"></span>
        <span class="status-code">SYS_UPLINK_LIVE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
      </div>

      <div class="springboard" *ngIf="!selectedApp()">
        <div class="icon-section">
          <div class="section-tag">/root/scripts</div>
          <div class="icon-grid">
            <div class="app-widget glass" (click)="openApp('energia')">
              <div class="icon-glow">⚡</div>
              <span class="label">ENERGIA</span>
            </div>
            <div class="app-widget glass" (click)="openApp('ndls_mrz')">
              <div class="icon-glow">🆔</div>
              <span class="label">NDLS_MRZ</span>
            </div>
          </div>
        </div>

        <div class="icon-section">
          <div class="section-tag">/system/soft</div>
          <div class="icon-grid">
            <div class="app-widget glass locked">
              <div class="icon-glow">🛡️</div>
              <span class="label">SNIFFER</span>
            </div>
          </div>
        </div>
      </div>

      <main class="app-sheet glass" *ngIf="selectedApp()">
        <header class="sheet-header">
          <button (click)="closeApp()" class="close-btn">ESC_EXIT</button>
          <span class="app-id">MODULE_ID: {{ selectedApp()?.toUpperCase() }}</span>
          <div class="header-tools">
            <label class="scan-mode" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="led" [class.on]="scanMode()"></span>
              <span class="t-txt">ARTIFACTS</span>
            </label>
          </div>
        </header>

        <div class="form-compact">
          @for (field of schema(); track field.id) {
            <div class="field-item">
              <label>{{ field.label }}</label>
              <div class="field-input-box glass-inset">
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

        <div class="realtime-console glass-dark" *ngIf="mrzData()">
          <div class="c-line"><span class="c-tag">[G2]</span> {{ mrzData().GEN_2_ISO }} <button (click)="copy(mrzData().GEN_2_ISO)">COPY</button></div>
          <div class="c-line"><span class="c-tag">[G1]</span> {{ mrzData().GEN_1_LEGACY }}</div>
        </div>

        <footer class="sheet-footer">
          <button [disabled]="engine.loading()" (click)="fire()" class="matrix-btn">
            <span class="btn-txt">> {{ engine.loading() ? 'PROCCESSING_ENCRYPTION...' : 'EXECUTE_SYNC' }}</span>
            <div class="load-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .matrix-os { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 30px; z-index: 10; position: relative; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.2; }

    .dynamic-island { padding: 6px 20px; border-radius: 40px; display: flex; align-items: center; gap: 12px; margin-bottom: 30px; font-size: 0.6rem; font-weight: 800; border: 1px solid var(--border); }
    .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--matrix-green); box-shadow: 0 0 10px var(--matrix-green); animation: pulse 2s infinite; }
    @keyframes pulse { 50% { opacity: 0.2; } }

    .springboard { width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: 40px; }
    .section-tag { font-size: 0.65rem; color: #333; font-weight: 800; margin-bottom: 15px; letter-spacing: 2px; }
    .icon-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .app-widget { width: 100%; aspect-ratio: 1; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid var(--border); }
    .app-widget:hover { transform: scale(1.1); box-shadow: 0 0 20px var(--matrix-glow); border-color: var(--matrix-green); }
    .icon-glow { font-size: 1.8rem; filter: drop-shadow(0 0 5px var(--matrix-green)); }
    .label { font-size: 0.55rem; font-weight: 800; color: #444; }
    .app-widget.locked { opacity: 0.15; cursor: not-allowed; }

    .app-sheet { position: absolute; inset: 20px; border-radius: 24px; padding: 30px; display: flex; flex-direction: column; border: 1px solid var(--border); }
    .sheet-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .close-btn { background: transparent; border: none; color: #333; font-weight: 800; font-size: 0.7rem; cursor: pointer; }
    .app-id { font-weight: 900; color: var(--matrix-green); letter-spacing: 1px; }

    .form-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; flex: 1; }
    .field-item label { font-size: 0.55rem; font-weight: 800; color: #333; margin-bottom: 6px; display: block; }
    .field-input-box { padding: 12px 15px; border-radius: 12px; border: 1px solid var(--border); }
    input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: var(--font-mono); font-size: 0.85rem; }
    input::placeholder { color: #111; }

    .realtime-console { background: #000; padding: 15px; font-size: 0.75rem; font-family: var(--font-mono); margin-bottom: 20px; border: 1px solid var(--border); }
    .c-line { margin-bottom: 5px; display: flex; gap: 10px; align-items: center; color: #fff; }
    .c-tag { color: var(--matrix-green); font-weight: 800; }
    .realtime-console button { background: var(--matrix-green); border: none; font-size: 0.5rem; font-weight: 900; padding: 2px 6px; cursor: pointer; }

    .matrix-btn { width: 100%; padding: 22px; background: transparent; border: 1px solid var(--matrix-green); color: var(--matrix-green); font-weight: 900; cursor: pointer; position: relative; overflow: hidden; font-size: 0.9rem; letter-spacing: 2px; }
    .load-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: #fff; transition: 2s linear; }

    .glass { background: var(--glass); backdrop-filter: blur(100px); }
    .glass-inset { background: rgba(0, 255, 65, 0.02); }
    .scan-mode { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .scan-mode input { display: none; }
    .led { width: 8px; height: 8px; border: 1px solid var(--matrix-green); }
    .led.on { background: var(--matrix-green); box-shadow: 0 0 10px var(--matrix-green); }
    .t-txt { font-size: 0.5rem; font-weight: 800; }
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
        a.href = url; a.download = `V_SYNC_${Date.now()}.pdf`; a.click();
      }
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const drops = new Array(Math.floor(canvas.width / 16)).fill(1);
    setInterval(() => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41"; ctx.font = "16px monospace";
      drops.forEach((y, i) => {
        ctx.fillText(Math.floor(Math.random()*2).toString(), i * 16, y * 16);
        if (y * 16 > canvas.height && Math.random() > 0.98) drops[i] = 0;
        drops[i]++;
      });
    }, 50);
  }
}