import { Component, signal, inject, AfterViewInit, ElementRef, ViewChild, effect } from '@angular/core';
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
          <div class="nav-label">ACTIVE_MODULES</div>
          <button (click)="module.set('energia')" [class.active]="module() === 'energia'" class="nav-item">
            <span class="icon">IE</span> IE_ENERGIA_V57
          </button>
          <button (click)="module.set('ndls_mrz')" [class.active]="module() === 'ndls_mrz'" class="nav-item">
            <span class="icon">IE</span> IE_NDLS_MRZ
          </button>
        </nav>
        
        <div class="sidebar-footer">
          <label class="scan-toggle" *ngIf="module() === 'energia'">
            <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
            <div class="checkbox-ui"><span class="led" [class.active]="scanMode()"></span></div>
            <span class="toggle-text">SCAN_ARTIFACTS</span>
          </label>
        </div>
      </aside>

      <main class="panel">
        <header class="panel-header">
          <span class="path">~/ROOM/{{ module().toUpperCase() }}</span>
          <span class="status">ALLOCATED_RAM: {{ memoryUsage() }}MB // NODE: {{ nodeId }}</span>
        </header>

        <div class="grid-form">
          @for (field of schema(); track field.id) {
            <div class="field-row">
              <label>{{ field.label }}</label>
              <div class="field-input">
                <input [(ngModel)]="lines()[$index]" [placeholder]="field.p" spellcheck="false" autocomplete="off">
              </div>
            </div>
          }
        </div>

        <div class="output-console" *ngIf="mrzData()">
          <div class="console-line">
            <span class="c-tag">[MRZ_RESULT]</span> {{ mrzData().GEN_2_ISO }}
            <button class="copy-btn" (click)="copy(mrzData().GEN_2_ISO)">COPY_DATA</button>
          </div>
        </div>

        <footer class="panel-footer">
          <button [disabled]="engine.loading()" (click)="execute()" class="exec-btn">
            <span class="btn-label">> {{ engine.loading() ? 'RUNNING_SYNC...' : 'EXECUTE_CORE_COMMAND' }}</span>
            <div class="loading-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    canvas#matrix { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; opacity: 0.1; }
    .dashboard-container { position: relative; z-index: 10; display: flex; width: 95vw; max-width: 920px; height: 540px; background: rgba(8,8,8,0.95); border: 1px solid rgba(212,175,55,0.2); font-family: 'JetBrains Mono', monospace; }
    .sidebar { width: 240px; border-right: 1px solid rgba(212,175,55,0.1); display: flex; flex-direction: column; padding: 25px 0; background: rgba(0,0,0,0.3); }
    .brand { padding: 0 25px 30px; font-size: 1.4rem; font-weight: 900; color: #d4af37; letter-spacing: 2px; }
    .brand span { color: #fff; }
    nav { flex: 1; padding: 0 15px; }
    .nav-label { font-size: 0.55rem; color: #444; margin-bottom: 15px; padding-left: 10px; }
    .nav-item { width: 100%; background: transparent; border: none; color: #666; padding: 12px 15px; text-align: left; font-family: inherit; font-size: 0.65rem; cursor: pointer; display: flex; align-items: center; gap: 12px; }
    .nav-item.active { color: #d4af37; background: rgba(212,175,55,0.05); border-left: 2px solid #d4af37; }
    .icon { border: 1px solid currentColor; padding: 2px 4px; font-size: 0.5rem; border-radius: 2px; }
    
    /* STYLE ДЛЯ ГАЛОЧКИ [cite: 2026-02-05] */
    .sidebar-footer { padding: 20px; border-top: 1px solid rgba(212,175,55,0.1); }
    .scan-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .scan-toggle input { display: none; }
    .checkbox-ui { width: 14px; height: 14px; border: 1px solid #333; display: flex; align-items: center; justify-content: center; }
    .led { width: 6px; height: 6px; background: #222; transition: 0.3s; }
    .led.active { background: #d4af37; box-shadow: 0 0 10px #d4af37; }
    .toggle-text { font-size: 0.5rem; color: #888; letter-spacing: 1px; }

    .panel { flex: 1; display: flex; flex-direction: column; }
    .panel-header { padding: 15px 30px; background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; font-size: 0.6rem; color: #444; }
    .grid-form { padding: 30px 45px; display: grid; gap: 15px; }
    .field-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 20px; }
    .field-row label { font-size: 0.6rem; color: #d4af37; font-weight: 800; opacity: 0.7; }
    .field-input { background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(212,175,55,0.1); padding: 8px 15px; }
    input { width: 100%; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 0.85rem; outline: none; }
    input::placeholder { color: #222; }

    .output-console { margin: 0 45px; padding: 15px; background: #000; border-left: 3px solid #d4af37; font-size: 0.75rem; color: #fff; display: flex; justify-content: space-between; align-items: center; }
    .copy-btn { background: #d4af37; color: #000; border: none; padding: 4px 8px; font-size: 0.5rem; font-weight: 900; cursor: pointer; }

    .panel-footer { margin-top: auto; padding: 30px 45px; background: rgba(0,0,0,0.2); }
    .exec-btn { width: 100%; background: transparent; border: 1px solid #d4af37; padding: 20px; cursor: pointer; position: relative; overflow: hidden; }
    .exec-btn:hover:not(:disabled) { background: #d4af37; }
    .exec-btn:hover .btn-label { color: #000; }
    .btn-label { color: #d4af37; font-weight: 900; font-size: 0.85rem; letter-spacing: 2px; }
    .loading-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: #fff; transition: width 2.5s; }
  `]
})
export class App implements AfterViewInit {
  engine = inject(EngineService);
  module = signal('energia');
  schema = signal<any[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal(false);
  mrzData = signal<any>(null);
  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();
  memoryUsage = signal(128);

  constructor() {
    // Ефект для динамічного перемикання схем [cite: 2026-02-05]
    effect(() => {
      this.engine.getSchema(this.module()).subscribe(s => {
        this.schema.set(s);
        this.lines.set(new Array(s.length).fill(''));
        this.mrzData.set(null);
      });
    }, { allowSignalWrites: true });
  }

  execute() {
    // ВИКЛИК execute (не process!) [cite: 2026-03-15]
    this.engine.execute(this.module(), this.lines(), this.scanMode()).subscribe(res => {
      if (this.module() === 'ndls_mrz') {
        this.mrzData.set(res);
      } else {
        const url = URL.createObjectURL(res);
        const a = document.createElement('a');
        a.href = url; a.download = `V_ROOM_${this.module().toUpperCase()}_${Date.now()}.pdf`; a.click();
      }
    });
  }

  copy(text: string) { navigator.clipboard.writeText(text); }

  ngAfterViewInit() { this.initMatrix(); setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (190 - 130) + 130)), 2000); }
  onFocus(e: any) { e.target.placeholder = ''; }
  onBlur(e: any, p: string) { if (!e.target.value) e.target.placeholder = p; }

  private initMatrix() {
    const canvas = (document.getElementById('matrix') as HTMLCanvasElement);
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const drops = new Array(Math.floor(canvas.width / 16)).fill(1);
    setInterval(() => {
      ctx.fillStyle = "rgba(5, 5, 5, 0.08)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#d4af37"; ctx.font = "16px monospace";
      drops.forEach((y, i) => {
        ctx.fillText(Math.floor(Math.random()*2).toString(), i * 16, y * 16);
        if (y * 16 > canvas.height && Math.random() > 0.98) drops[i] = 0;
        drops[i]++;
      });
    }, 40);
  }
}