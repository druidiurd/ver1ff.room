import { Component, signal, inject, AfterViewInit, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stealth-wrapper">
      <div class="dynamic-island">
        <div class="island-inner">
          <span class="pulse-dot"></span>
          <span class="status-text">UPLINK_STABLE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
        </div>
      </div>

      <div class="bento-container">
        <aside class="bento-card sidebar glass">
          <div class="brand-area">
            <div class="brand-orb"></div>
            <span class="brand-name">VER1FF<span>.ROOM</span></span>
          </div>
          
          <nav class="module-stack">
            <button (click)="module.set('energia')" [class.active]="module() === 'energia'" class="ios-nav-item">
              <span class="module-icon">⚡</span> IE_ENERGIA_V57
            </button>
            <button (click)="module.set('ndls_mrz')" [class.active]="module() === 'ndls_mrz'" class="ios-nav-item">
              <span class="module-icon">🆔</span> IE_NDLS_MRZ
            </button>
          </nav>

          <div class="sidebar-footer" *ngIf="module() === 'energia'">
            <div class="tool-box glass-inset">
              <span class="tool-label">ANTI_FORENSICS_MODE</span>
              <label class="ios-switch">
                <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </aside>

        <main class="bento-card control-unit glass">
          <header class="card-header">
            <span class="path-indicator">/ROOT/MODULES/{{ module().toUpperCase() }}</span>
            <span class="encryption-tag">AES_256_ACTIVE</span>
          </header>

          <div class="input-matrix">
            @for (field of schema(); track field.id) {
              <div class="modern-input-group">
                <label>{{ field.label }}</label>
                <div class="input-field-wrap glass-inset">
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

          <div class="mrz-output-console glass-dark" *ngIf="mrzData()">
            <div class="console-label">>> REALTIME_MRZ_DUMP</div>
            <div class="console-rows">
              <div class="row">
                <span class="tag">G2_30B</span>
                <code>{{ mrzData().GEN_2_ISO }}</code>
                <button (click)="copy(mrzData().GEN_2_ISO)" class="pill-btn">COPY</button>
              </div>
              <div class="row">
                <span class="tag">G1_31B</span>
                <code>{{ mrzData().GEN_1_LEGACY }}</code>
              </div>
            </div>
          </div>

          <footer class="execution-area">
            <button [disabled]="engine.loading()" (click)="fire()" class="primary-exec-btn">
              <span class="btn-text">> {{ engine.loading() ? 'PROCCESSING_ENCRYPTION...' : 'EXECUTE_SYNC_COMMAND' }}</span>
              <div class="btn-loader" [style.width.%]="engine.loading() ? 100 : 0"></div>
            </button>
          </footer>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .stealth-wrapper { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px; gap: 30px; position: relative; }
    
    /* DYNAMIC ISLAND [cite: 2026-02-05] */
    .dynamic-island { background: #000; padding: 10px 30px; border-radius: 50px; border: 1px solid var(--border-ios); box-shadow: 0 15px 40px rgba(0,0,0,0.9); }
    .island-inner { display: flex; align-items: center; gap: 12px; font-size: 0.65rem; font-weight: 800; color: #555; letter-spacing: 1px; }
    .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-emerald); box-shadow: 0 0 10px var(--accent-emerald); animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

    /* BENTO GRID [cite: 2026-02-21] */
    .bento-container { display: grid; grid-template-columns: 300px 1fr; gap: 20px; width: 100%; max-width: 1100px; height: 100%; }
    .glass { background: var(--glass); backdrop-filter: blur(50px) saturate(200%); border: 1px solid var(--border-ios); border-radius: 30px; }
    .glass-inset { background: rgba(0,0,0,0.3); border: 1px solid var(--border-ios); box-shadow: inset 2px 2px 5px rgba(0,0,0,0.5); }
    .glass-dark { background: #000; border: 1px solid var(--border-ios); border-radius: 20px; }
    
    .bento-card { padding: 35px; display: flex; flex-direction: column; }
    
    /* SIDEBAR */
    .brand-area { display: flex; align-items: center; gap: 15px; margin-bottom: 50px; }
    .brand-orb { width: 16px; height: 16px; background: var(--accent-blue); border-radius: 50%; box-shadow: 0 0 15px var(--accent-blue); }
    .brand-name { font-size: 1.3rem; font-weight: 900; letter-spacing: -0.5px; }
    .brand-name span { color: var(--accent-blue); }

    .module-stack { display: flex; flex-direction: column; gap: 12px; flex: 1; }
    .ios-nav-item { width: 100%; padding: 16px 20px; background: rgba(255,255,255,0.02); border: 1px solid transparent; border-radius: 18px; color: #666; font-family: inherit; font-size: 0.75rem; font-weight: 800; text-align: left; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 12px; }
    .ios-nav-item.active { background: #fff; color: #000; transform: scale(1.02); }

    /* CONTROL UNIT */
    .card-header { display: flex; justify-content: space-between; font-size: 0.6rem; color: #444; font-weight: 800; margin-bottom: 40px; letter-spacing: 1px; }
    .input-matrix { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .modern-input-group label { font-size: 0.6rem; font-weight: 800; color: #666; margin-bottom: 10px; display: block; padding-left: 5px; }
    .input-field-wrap { padding: 14px 20px; border-radius: 15px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: var(--font-mono); font-size: 0.85rem; }

    /* CONSOLE */
    .mrz-output-console { margin-top: 40px; padding: 25px; }
    .console-label { font-size: 0.55rem; color: #444; margin-bottom: 15px; font-weight: 800; }
    .mrz-row { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
    .tag { color: var(--accent-emerald); font-size: 0.6rem; font-weight: 900; }
    code { flex: 1; font-family: var(--font-mono); font-size: 0.85rem; color: #fff; letter-spacing: 2px; }
    .pill-btn { background: var(--accent-blue); color: #fff; border: none; padding: 4px 15px; border-radius: 20px; font-size: 0.6rem; font-weight: 900; cursor: pointer; }

    /* BUTTONS */
    .execution-area { margin-top: auto; padding-top: 30px; }
    .primary-exec-btn { width: 100%; padding: 24px; background: #fff; color: #000; border-radius: 20px; border: none; font-weight: 900; font-size: 0.95rem; letter-spacing: 2px; cursor: pointer; position: relative; overflow: hidden; transition: 0.3s; }
    .primary-exec-btn:active { transform: scale(0.98); }
    .btn-loader { position: absolute; bottom: 0; left: 0; height: 4px; background: var(--accent-blue); transition: 2s linear; }

    /* IOS SWITCH */
    .sidebar-footer { padding-top: 30px; }
    .tool-box { padding: 15px 20px; border-radius: 20px; display: flex; justify-content: space-between; align-items: center; }
    .tool-label { font-size: 0.55rem; color: #888; font-weight: 800; }
    .ios-switch { position: relative; width: 38px; height: 20px; }
    .ios-switch input { display: none; }
    .slider { position: absolute; inset: 0; background: #1c1c1e; border-radius: 20px; transition: 0.3s; }
    .slider::after { content: ""; position: absolute; height: 16px; width: 16px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: 0.3s; }
    input:checked + .slider { background: var(--accent-emerald); }
    input:checked + .slider::after { transform: translateX(18px); }
  `]
})
export class App implements AfterViewInit {
  engine = inject(EngineService);
  module = signal('energia');
  schema = signal<any[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal(false);
  mrzData = signal<any>(null);
  memoryUsage = signal(128);
  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();

  constructor() {
    effect(() => {
      this.engine.getSchema(this.module()).subscribe(s => {
        this.schema.set(s);
        this.lines.set(new Array(s.length).fill(''));
        this.mrzData.set(null);
      });
    }, { allowSignalWrites: true });
  }

  onInputChange() {
    if (this.module() === 'ndls_mrz') {
      this.engine.execute(this.module(), this.lines(), false).subscribe(res => this.mrzData.set(res));
    }
  }

  fire() {
    this.engine.execute(this.module(), this.lines(), this.scanMode()).subscribe(res => {
      if (this.module() === 'ndls_mrz') this.mrzData.set(res);
      else {
        const url = URL.createObjectURL(res);
        const a = document.createElement('a');
        a.href = url; a.download = `V_ROOM_EXTRACT_${Date.now()}.pdf`; a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }
  ngAfterViewInit() { setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (220 - 180) + 180)), 2000); }
}