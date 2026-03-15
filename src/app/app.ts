import { Component, signal, inject, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas #matrixCanvas id="matrix"></canvas>

    <div class="dashboard-container">
      <aside class="sidebar">
        <div class="brand">VER1FF<span>.ROOM</span></div>
        <nav>
          <div class="nav-label">DATABASE_MODULES</div>
          <button class="nav-item active"><span class="icon">IE</span> IE_ENERGIA_V57</button>
          <button class="nav-item locked"><span class="icon">NL</span> NL_POSTBANK_V1</button>
        </nav>
        <div class="sidebar-footer">
          <label class="scan-toggle">
            <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
            <span class="toggle-label">SCAN_ARTIFACT_INJECTION</span>
            <span class="led" [class.on]="scanMode()"></span>
          </label>
        </div>
      </aside>

      <main class="panel">
        <header class="panel-header">
          <div class="path">~/ROOM/SCRIPTS/IE_ENERGIA_V57</div>
          <div class="node-info">NODE_ID: {{ nodeId }} // RAM: {{ memoryUsage() }}MB</div>
        </header>

        <div class="form-grid">
          @for (field of fieldConfig; track $index) {
            <div class="horizontal-field">
              <label>{{ field.label }}</label>
              <div class="input-wrap">
                <input 
                  [(ngModel)]="lines()[$index]" 
                  [placeholder]="field.placeholder"
                  (focus)="onFocus($event)"
                  (blur)="onBlur($event, field.placeholder)"
                  spellcheck="false"
                  autocomplete="off"
                >
              </div>
            </div>
          }
        </div>

        <div class="action-footer">
          <button [disabled]="engine.loading()" (click)="burn()" class="execute-btn">
            <div class="btn-layout">
              <span class="cmd-text">> {{ engine.loading() ? 'RUNNING_ENCRYPTION...' : 'EXECUTE_GENERATION' }}</span>
              <span class="shortcut">MODE: {{ scanMode() ? 'HARD_SCAN' : 'CLEAN_PDF' }}</span>
            </div>
            <div class="progress-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    canvas#matrix { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; opacity: 0.1; }
    .dashboard-container { position: relative; z-index: 10; display: flex; width: 95vw; max-width: 900px; height: 520px; background: rgba(8, 8, 8, 0.9); backdrop-filter: blur(20px); border: 1px solid rgba(212, 175, 55, 0.2); box-shadow: 0 0 100px #000; overflow: hidden; font-family: 'JetBrains Mono', monospace; }
    .sidebar { width: 240px; background: rgba(0, 0, 0, 0.5); border-right: 1px solid rgba(212, 175, 55, 0.1); display: flex; flex-direction: column; padding: 25px 0; }
    .brand { padding: 0 25px 30px; font-size: 1.4rem; font-weight: 900; color: #d4af37; letter-spacing: 2px; }
    .brand span { color: #fff; }
    nav { flex: 1; padding: 0 15px; }
    .nav-label { font-size: 0.55rem; color: #444; margin-bottom: 15px; letter-spacing: 2px; }
    .nav-item { width: 100%; background: transparent; border: none; color: #666; padding: 12px 10px; text-align: left; font-family: inherit; font-size: 0.65rem; cursor: pointer; display: flex; align-items: center; gap: 10px; }
    .nav-item.active { color: #d4af37; background: rgba(212, 175, 55, 0.05); }
    .icon { font-size: 0.5rem; border: 1px solid currentColor; padding: 2px 4px; border-radius: 2px; }
    .sidebar-footer { padding: 20px; border-top: 1px solid rgba(212, 175, 55, 0.05); }
    .scan-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .scan-toggle input { display: none; }
    .toggle-label { font-size: 0.5rem; color: #888; }
    .led { width: 6px; height: 6px; border-radius: 50%; background: #222; transition: 0.3s; }
    .led.active { background: #d4af37; box-shadow: 0 0 8px #d4af37; }
    .panel { flex: 1; display: flex; flex-direction: column; }
    .panel-header { padding: 15px 25px; background: rgba(255, 255, 255, 0.02); display: flex; justify-content: space-between; font-size: 0.6rem; color: #555; }
    .form-grid { padding: 30px 40px; display: grid; gap: 12px; }
    .horizontal-field { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 20px; }
    .horizontal-field label { font-size: 0.6rem; color: #d4af37; opacity: 0.6; font-weight: 800; }
    .input-wrap { background: rgba(0, 0, 0, 0.4); border-bottom: 1px solid rgba(212, 175, 55, 0.1); padding: 8px 15px; }
    input { width: 100%; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 0.85rem; outline: none; }
    input::placeholder { color: #222; }
    .action-footer { margin-top: auto; padding: 25px 40px; background: rgba(0,0,0,0.3); }
    .execute-btn { width: 100%; background: transparent; border: 1px solid #d4af37; padding: 18px; cursor: pointer; position: relative; overflow: hidden; }
    .execute-btn:hover:not(:disabled) { background: #d4af37; }
    .execute-btn:hover span { color: #000; }
    .btn-layout { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 5; }
    .cmd-text { color: #d4af37; font-weight: 900; font-size: 0.8rem; }
    .shortcut { font-size: 0.6rem; color: #444; }
    .progress-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: #fff; transition: width 2s; }
  `]
})
export class App implements AfterViewInit {
  engine = inject(EngineService);
  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();
  scanMode = signal(false);
  lines = signal<string[]>(new Array(6).fill(''));
  memoryUsage = signal(128);

  fieldConfig = [
    { label: 'IDENTITY_NAME', placeholder: 'Mr Peter Browne' },
    { label: 'STREET_LOCUS', placeholder: '114 STANNAWAY RD' },
    { label: 'DISTRICT_ZONE', placeholder: 'KIMMAGE' },
    { label: 'CITY_DISTRICT', placeholder: 'DUBLIN 12' },
    { label: 'COUNTY_REGION', placeholder: 'Co. Dublin 12' },
    { label: 'ZIP_POSTCODE',  placeholder: 'D12 N4V9' }
  ];

  ngAfterViewInit() { 
    this.initMatrix(); 
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (170 - 130) + 130)), 2000); 
  }

  onFocus(e: any) { e.target.placeholder = ''; }
  onBlur(e: any, placeholder: string) { if (!e.target.value) e.target.placeholder = placeholder; }

  burn() {
    // ТЕПЕР ТУТ ТРИ АРГУМЕНТИ, ЯКІ ОЧІКУЄ ОНОВЛЕНИЙ СЕРВІС [cite: 2026-02-21]
    this.engine.run('energia', this.lines(), this.scanMode()).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `V_ROOM_IE_${Date.now()}.pdf`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  private initMatrix() {
    const canvas = this.canvasRef.nativeElement; const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const chars = "01".split(""); const fontSize = 16;
    const drops = new Array(Math.floor(canvas.width / fontSize)).fill(1);
    const draw = () => {
      ctx.fillStyle = "rgba(5, 5, 5, 0.08)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#d4af37"; ctx.font = fontSize + "px monospace";
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.98) drops[i] = 0;
        drops[i]++;
      }
    };
    setInterval(draw, 40);
  }
}