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

    <div class="v-room" [class.app-open]="selectedApp()">
      <div class="status-island glass">
        <span class="led"></span>
        <span class="id">V_ROOM_UPLINK // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
      </div>

      <div class="springboard" *ngIf="!selectedApp()">
        <div class="folder">
          <h2 class="folder-title">IRELAND</h2>
          <div class="icon-grid">
            <div class="app-item" (click)="openApp('energia')">
              <div class="app-icon glass"><span class="neon-text">PDF</span></div>
              <span class="app-label">IE-bill-gen</span>
            </div>
            <div class="app-item" (click)="openApp('ndls_mrz')">
              <div class="app-icon glass"><span class="neon-text">MRZ</span></div>
              <span class="app-label">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="folder">
          <h2 class="folder-title">SYSTEM_CORE</h2>
          <div class="icon-grid">
            <div class="app-item locked">
              <div class="app-icon glass">🛡️</div>
              <span class="app-label">SNIFFER_X</span>
            </div>
          </div>
        </div>
      </div>

      <main class="app-terminal glass" *ngIf="selectedApp()">
        <header class="terminal-header">
          <button (click)="closeApp()" class="back-link">/root/IRELAND</button>
          <div class="header-center">
            <span class="app-id">{{ selectedApp() === 'energia' ? 'IE-BILL-GEN' : 'IE-NDLS-MRZ' }}</span>
          </div>
          <div class="header-right">
            <label class="scan-mode" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="check-box" [class.on]="scanMode()"></span>
              <span class="check-label">ARTIFACTS</span>
            </label>
          </div>
        </header>

        <div class="terminal-body">
          <div class="form-grid">
            @for (field of schema(); track field.id) {
              <div class="field-node">
                <label>{{ field.label }}</label>
                <div class="input-container glass-inset">
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

          <div class="output-console glass-dark" *ngIf="mrzData()">
            <div class="console-label">>> MRZ_DATA_STREAM</div>
            <div class="data-row">
              <span class="tag">[G2]</span>
              <code>{{ mrzData().GEN_2_ISO }}</code>
              <button (click)="copy(mrzData().GEN_2_ISO)" class="copy-btn">COPY</button>
            </div>
            <div class="data-row">
              <span class="tag">[G1]</span>
              <code>{{ mrzData().GEN_1_LEGACY }}</code>
            </div>
          </div>
        </div>

        <footer class="terminal-footer">
          <button [disabled]="engine.loading()" (click)="fire()" class="exec-btn">
            <span class="btn-text">=> {{ engine.loading() ? 'PROCCESSING...' : 'EXECUTE_CORE_GEN' }}</span>
            <div class="load-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .v-room { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px; z-index: 10; position: relative; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.2; }

    .status-island { padding: 6px 20px; border-radius: 40px; display: flex; align-items: center; gap: 12px; margin-bottom: 40px; font-size: 0.65rem; font-weight: 800; border: 1px solid var(--glass-border); box-shadow: 0 10px 40px #000; }
    .led { width: 8px; height: 8px; border-radius: 50%; background: var(--matrix-green); box-shadow: 0 0 10px var(--matrix-green); animation: pulse 2s infinite; }
    @keyframes pulse { 50% { opacity: 0.2; } }
    .id { color: var(--text-dim); letter-spacing: 1px; }

    .springboard { width: 100%; max-width: 800px; display: flex; flex-direction: column; gap: 50px; z-index: 10; }
    .folder-title { font-size: 1.2rem; font-weight: 900; color: #fff; margin-bottom: 25px; padding-left: 10px; border-left: 4px solid var(--matrix-green); }
    .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 30px; }
    .app-item { display: flex; flex-direction: column; align-items: center; gap: 12px; cursor: pointer; transition: 0.3s; }
    .app-item:hover { transform: scale(1.1); }
    .app-icon { width: 70px; height: 70px; border-radius: 20px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border); font-weight: 900; }
    .neon-text { font-size: 0.8rem; color: var(--matrix-green); text-shadow: 0 0 10px var(--matrix-green); }
    .app-label { font-size: 0.75rem; font-weight: 700; color: var(--text-dim); }
    .app-item.locked { opacity: 0.15; cursor: not-allowed; }

    .app-terminal { position: absolute; inset: 20px; border-radius: 30px; padding: 40px; display: flex; flex-direction: column; border: 1px solid var(--glass-border); box-shadow: 0 0 80px #000; z-index: 100; }
    .terminal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .back-link { background: transparent; border: none; color: var(--text-dim); font-weight: 800; font-size: 0.8rem; cursor: pointer; }
    .back-link:hover { color: #fff; }
    .app-id { color: var(--matrix-green); font-weight: 900; font-size: 1.2rem; letter-spacing: 2px; }

    .terminal-body { flex: 1; display: flex; flex-direction: column; gap: 30px; overflow-y: auto; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field-node label { font-size: 0.65rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px; display: block; }
    .input-container { padding: 15px 20px; border-radius: 12px; border: 1px solid var(--glass-border); }
    input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: var(--font-mono); font-size: 0.95rem; }
    input::placeholder { color: #111; }

    .output-console { background: #000; padding: 25px; border-radius: 20px; border: 1px solid var(--glass-border); }
    .console-label { font-size: 0.6rem; color: var(--text-dim); margin-bottom: 15px; font-weight: 800; }
    .data-row { display: flex; align-items: center; gap: 20px; margin-bottom: 10px; font-family: var(--font-mono); font-size: 0.9rem; }
    .tag { color: var(--matrix-green); font-weight: 900; }
    code { color: #fff; flex: 1; letter-spacing: 1px; }
    .copy-btn { background: var(--matrix-green); color: #000; border: none; padding: 4px 12px; border-radius: 20px; font-size: 0.6rem; font-weight: 900; cursor: pointer; }

    .terminal-footer { padding-top: 40px; }
    .exec-btn { width: 100%; padding: 25px; background: transparent; border: 1px solid var(--matrix-green); color: var(--matrix-green); font-weight: 900; cursor: pointer; position: relative; overflow: hidden; font-size: 1rem; letter-spacing: 3px; border-radius: 15px; }
    .exec-btn:hover:not(:disabled) { background: var(--matrix-green); color: #000; box-shadow: 0 0 30px var(--matrix-glow); }
    .load-bar { position: absolute; bottom: 0; left: 0; height: 5px; background: #fff; transition: 2s linear; }

    .glass { background: var(--glass-heavy); backdrop-filter: blur(120px) saturate(180%); }
    .glass-inset { background: rgba(0, 255, 65, 0.02); }
    
    .scan-mode { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .scan-mode input { display: none; }
    .check-box { width: 16px; height: 16px; border: 1px solid var(--matrix-green); }
    .check-box.on { background: var(--matrix-green); box-shadow: 0 0 10px var(--matrix-green); }
    .check-label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); }
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

  openApp(name: string) { this.selectedApp.set(name); }
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
        const blob = new Blob([res], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `V_SYNC_${Date.now()}.pdf`; a.click();
      }
    });
  }

  copy(text: string) { navigator.clipboard.writeText(text); }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const drops = new Array(Math.floor(canvas.width / 18)).fill(1);
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41"; ctx.font = "16px monospace";
      drops.forEach((y, i) => {
        ctx.fillText(Math.floor(Math.random()*2).toString(), i * 18, y * 18);
        if (y * 18 > canvas.height && Math.random() > 0.985) drops[i] = 0;
        drops[i]++;
      });
    };
    setInterval(draw, 50);
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (220 - 180) + 180)), 3000);
  }
}