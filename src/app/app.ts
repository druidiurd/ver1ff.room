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

    <div class="titanium-wrapper">
      <div class="dynamic-island">
        <div class="island-node">
          <span class="pulse-led"></span>
          <span class="node-status">VER1FF_UPLINK_ENCRYPTED // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
        </div>
      </div>

      <div class="hud-container">
        <aside class="hud-card sidebar glass-panel">
          <div class="brand-v">VER1FF<span>.ROOM</span></div>
          
          <nav class="nav-stack">
            <button (click)="module.set('energia')" [class.active]="module() === 'energia'" class="stealth-btn">
              <span class="icon">01</span> IE_ENERGIA_V57
            </button>
            <button (click)="module.set('ndls_mrz')" [class.active]="module() === 'ndls_mrz'" class="stealth-btn">
              <span class="icon">02</span> IE_NDLS_MRZ_CORE
            </button>
          </nav>

          <div class="sidebar-footer" *ngIf="module() === 'energia'">
            <div class="security-module glass-inset">
              <span class="sec-label">ANTI_FORENSICS_CORE</span>
              <label class="matrix-switch">
                <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </aside>

        <main class="hud-card main-terminal glass-panel">
          <header class="terminal-header">
            <span class="terminal-path">/DEV/NODES/{{ module().toUpperCase() }}</span>
            <div class="header-dots"><span class="d"></span><span class="d"></span><span class="d"></span></div>
          </header>

          <div class="input-bento">
            @for (field of schema(); track field.id) {
              <div class="bento-field">
                <label>{{ field.label }}</label>
                <div class="bento-input-wrap glass-inset">
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

          <div class="interactive-console glass-dark" *ngIf="mrzData()">
            <div class="console-label">>> MRZ_OUTPUT_STREAM</div>
            <div class="stream-data">
              <div class="data-row">
                <span class="m-tag">G2</span>
                <code class="m-code">{{ mrzData().GEN_2_ISO }}</code>
                <button (click)="copy(mrzData().GEN_2_ISO)" class="copy-action">COPY</button>
              </div>
              <div class="data-row">
                <span class="m-tag">G1</span>
                <code class="m-code">{{ mrzData().GEN_1_LEGACY }}</code>
              </div>
            </div>
          </div>

          <footer class="action-zone">
            <button [disabled]="engine.loading()" (click)="fire()" class="titanium-btn">
              <span class="btn-label">> {{ engine.loading() ? 'ENCRYPTING_DATA_STREAM...' : 'EXECUTE_CORE_GENERATION' }}</span>
              <div class="btn-loader" [style.width.%]="engine.loading() ? 100 : 0"></div>
            </button>
          </footer>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .titanium-wrapper { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: var(--spacing-xl); gap: 40px; position: relative; }
    
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.04; pointer-events: none; }

    /* DYNAMIC ISLAND [cite: 2026-02-05] */
    .dynamic-island { background: #000; padding: 12px 35px; border-radius: 50px; border: 1px solid var(--glass-border); z-index: 20; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    .island-inner { display: flex; align-items: center; gap: 15px; }
    .node-status { font-size: 0.65rem; font-weight: 800; color: #444; letter-spacing: 1px; }
    .pulse-led { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-neon); box-shadow: 0 0 15px var(--accent-neon); animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.2; } 100% { opacity: 1; } }

    /* HUD BENTO GRID [cite: 2026-02-21] */
    .hud-container { display: grid; grid-template-columns: 320px 1fr; gap: 40px; width: 100%; max-width: 1400px; height: 100%; z-index: 10; }
    .glass-panel { background: var(--surface-titanium); backdrop-filter: blur(80px); border: 1px solid var(--glass-border); border-radius: 40px; }
    .glass-inset { background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
    .glass-dark { background: #000; border: 1px solid var(--glass-border); border-radius: 25px; }
    
    .hud-card { padding: 50px; display: flex; flex-direction: column; }

    /* SIDEBAR */
    .brand-v { font-size: 1.6rem; font-weight: 900; letter-spacing: -1px; margin-bottom: 60px; }
    .brand-v span { color: var(--accent-neon); }
    .nav-stack { display: flex; flex-direction: column; gap: 15px; flex: 1; }
    .stealth-btn { width: 100%; padding: 20px 25px; background: rgba(255,255,255,0.02); border: 1px solid transparent; border-radius: 20px; color: #555; font-family: inherit; font-size: 0.8rem; font-weight: 800; text-align: left; cursor: pointer; transition: 0.4s; display: flex; align-items: center; gap: 15px; }
    .stealth-btn.active { background: #fff; color: #000; transform: scale(1.05); }
    .icon { font-size: 0.6rem; opacity: 0.5; border: 1px solid currentColor; padding: 2px 5px; border-radius: 4px; }

    /* MAIN TERMINAL */
    .terminal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; }
    .terminal-path { font-size: 0.65rem; color: #444; font-weight: 800; letter-spacing: 2px; }
    .header-dots { display: flex; gap: 8px; }
    .header-dots .d { width: 6px; height: 6px; background: #222; border-radius: 50%; }

    .input-bento { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .bento-field label { font-size: 0.65rem; font-weight: 800; color: #555; margin-bottom: 12px; display: block; padding-left: 5px; }
    .bento-input-wrap { padding: 18px 25px; border-radius: 20px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: var(--font-mono); font-size: 0.95rem; }
    input::placeholder { color: #222; }

    /* CONSOLE */
    .interactive-console { margin-top: 50px; padding: 30px; }
    .console-label { font-size: 0.6rem; color: #444; margin-bottom: 20px; font-weight: 800; }
    .data-row { display: flex; align-items: center; gap: 25px; margin-bottom: 20px; }
    .m-tag { color: var(--accent-neon); font-size: 0.65rem; font-weight: 900; }
    .m-code { flex: 1; font-family: var(--font-mono); font-size: 0.9rem; color: #fff; letter-spacing: 2px; }
    .copy-action { background: var(--accent-neon); color: #000; border: none; padding: 5px 15px; border-radius: 30px; font-size: 0.65rem; font-weight: 900; cursor: pointer; }

    /* EXECUTE */
    .action-zone { margin-top: auto; padding-top: 40px; }
    .titanium-btn { width: 100%; padding: 28px; background: #fff; color: #000; border-radius: 25px; border: none; font-weight: 900; font-size: 1.1rem; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; transition: 0.4s; }
    .titanium-btn:hover:not(:disabled) { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(255,255,255,0.1); }
    .btn-loader { position: absolute; bottom: 0; left: 0; height: 5px; background: var(--accent-neon); transition: 2.5s linear; }

    /* SWITCH */
    .sidebar-footer { padding-top: 40px; }
    .security-module { padding: 20px 25px; border-radius: 25px; display: flex; justify-content: space-between; align-items: center; }
    .sec-label { font-size: 0.6rem; color: #888; font-weight: 800; }
    .matrix-switch { position: relative; width: 44px; height: 24px; }
    .matrix-switch input { display: none; }
    .slider { position: absolute; inset: 0; background: #1a1a1a; border-radius: 30px; transition: 0.4s; }
    .slider::after { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: 0.4s; }
    input:checked + .slider { background: var(--accent-neon); box-shadow: 0 0 15px var(--accent-neon); }
    input:checked + .slider::after { transform: translateX(20px); }
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

  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

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
        a.href = url; a.download = `V_ROOM_IE_${Date.now()}.pdf`; a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }

  ngAfterViewInit() {
    this.initMatrix();
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (240 - 190) + 190)), 2000);
  }

  private initMatrix() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const drops = new Array(Math.floor(canvas.width / 16)).fill(1);
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#39ff14"; ctx.font = "16px monospace";
      drops.forEach((y, i) => {
        ctx.fillText(Math.floor(Math.random()*2).toString(), i * 16, y * 16);
        if (y * 16 > canvas.height && Math.random() > 0.985) drops[i] = 0;
        drops[i]++;
      });
    };
    setInterval(draw, 50);
  }
}