import { Component, signal, inject, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas id="matrix"></canvas>
    <div class="dashboard-container">
      <aside class="sidebar">
        <div class="brand">VER1FF<span>.ROOM</span></div>
        <nav>
          <div class="nav-label">MODULE_SELECT</div>
          <button (click)="module.set('energia')" [class.active]="module() === 'energia'" class="nav-item">IE_ENERGIA</button>
          <button (click)="module.set('ndls_mrz')" [class.active]="module() === 'ndls_mrz'" class="nav-item">IE_NDLS_MRZ</button>
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
          <span class="status">SYNC: {{ engine.loading() ? 'BUSY' : 'IDLE' }} // RAM: {{ memoryUsage() }}MB</span>
        </header>

        <div class="grid-form">
          @for (field of schema(); track field.id) {
            <div class="field-row">
              <label>{{ field.label }}</label>
              <div class="field-input">
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

        <div class="output-console" *ngIf="mrzData()">
          <div class="console-line">
            <span class="c-tag">[GEN_2]</span> {{ mrzData().GEN_2_ISO }}
            <button (click)="copy(mrzData().GEN_2_ISO)">COPY</button>
          </div>
          <div class="console-line">
            <span class="c-tag">[GEN_1]</span> {{ mrzData().GEN_1_LEGACY }}
          </div>
        </div>

        <footer class="panel-footer">
          <button [disabled]="engine.loading()" (click)="fireManual()" class="exec-btn">
            <span class="btn-label">> {{ module() === 'ndls_mrz' ? 'RE-SYNC_CORE' : 'EXECUTE_GENERATION' }}</span>
            <div class="loading-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    canvas#matrix { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; opacity: 0.1; }
    .dashboard-container { position: relative; z-index: 10; display: flex; width: 95vw; max-width: 920px; height: 550px; background: rgba(8,8,8,0.95); border: 1px solid rgba(212,175,55,0.2); font-family: 'JetBrains Mono', monospace; }
    .sidebar { width: 240px; border-right: 1px solid rgba(212,175,55,0.1); display: flex; flex-direction: column; padding: 25px 0; }
    .brand { padding: 0 25px 30px; font-size: 1.4rem; font-weight: 900; color: #d4af37; letter-spacing: 2px; }
    .brand span { color: #fff; }
    nav { flex: 1; padding: 0 15px; }
    .nav-item { width: 100%; background: transparent; border: none; color: #666; padding: 12px 15px; text-align: left; font-size: 0.65rem; cursor: pointer; }
    .nav-item.active { color: #d4af37; background: rgba(212,175,55,0.05); border-left: 2px solid #d4af37; }
    .grid-form { padding: 30px 45px; display: grid; gap: 12px; }
    .field-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 20px; }
    .field-row label { font-size: 0.6rem; color: #d4af37; font-weight: 800; }
    .field-input { background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(212,175,55,0.15); padding: 8px 15px; }
    input { width: 100%; background: transparent; border: none; color: #fff; font-size: 0.85rem; outline: none; }
    .output-console { margin: 0 45px; padding: 15px; background: #000; border-left: 3px solid #d4af37; font-size: 0.75rem; color: #fff; }
    .c-tag { color: #d4af37; margin-right: 10px; }
    .exec-btn { width: 100%; background: transparent; border: 1px solid #d4af37; padding: 20px; cursor: pointer; position: relative; overflow: hidden; }
    .loading-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: #fff; transition: width 2s; }
    /* Checkbox & Sidebar Footer */
    .sidebar-footer { padding: 20px; border-top: 1px solid rgba(212,175,55,0.1); }
    .scan-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .checkbox-ui { width: 14px; height: 14px; border: 1px solid #333; display: flex; align-items: center; justify-content: center; }
    .led { width: 6px; height: 6px; background: #222; }
    .led.active { background: #d4af37; box-shadow: 0 0 10px #d4af37; }
    .toggle-text { font-size: 0.5rem; color: #888; }
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

  constructor() {
    effect(() => {
      this.engine.getSchema(this.module()).subscribe(s => {
        this.schema.set(s);
        this.lines.set(new Array(s.length).fill(''));
        this.mrzData.set(null);
      });
    }, { allowSignalWrites: true });
  }

  /** Реактивне оновлення при введенні [cite: 2026-02-05] */
  onInputChange() {
    if (this.module() === 'ndls_mrz') {
      this.engine.execute(this.module(), this.lines(), false).subscribe(res => {
        this.mrzData.set(res);
      });
    }
  }

  /** Ручний запуск (для PDF) [cite: 2026-02-21] */
  fireManual() {
    this.engine.execute(this.module(), this.lines(), this.scanMode()).subscribe(res => {
      if (this.module() === 'ndls_mrz') this.mrzData.set(res);
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(res); a.download = `V_ROOM_${Date.now()}.pdf`; a.click();
      }
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }
  ngAfterViewInit() { /* Matrix logic */ }
}