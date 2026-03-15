import { Component, signal, inject, AfterViewInit, ElementRef, ViewChild, computed } from '@angular/core';
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
            <span class="icon">IE</span> IE_NDLS_MRZ_CORE
          </button>
        </nav>
        <div class="sidebar-footer">
          <label class="scan-toggle" *ngIf="module() === 'energia'">
            <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
            <span class="led" [class.active]="scanMode()"></span>
            <span class="toggle-text">ARTIFACT_INJECTION</span>
          </label>
        </div>
      </aside>

      <main class="panel">
        <header class="panel-header">
          <span class="path">~/ROOM/{{ module().toUpperCase() }}</span>
          <span class="status">RAM_ALLOC: {{ memoryUsage() }}MB // NODE_ID: {{ nodeId }}</span>
        </header>

        <div class="grid-form">
          @for (field of activeFields(); track $index) {
            <div class="field-row">
              <label>{{ field.label }}</label>
              <div class="field-input">
                <input [(ngModel)]="lines()[$index]" [placeholder]="field.placeholder" spellcheck="false" autocomplete="off">
              </div>
            </div>
          }
        </div>

        <div class="output-console" *ngIf="mrzData()">
          <div class="console-line"><span class="c-tag">[GEN_2]</span> {{ mrzData()?.GEN_2_ISO }}</div>
          <div class="console-line"><span class="c-tag">[GEN_1]</span> {{ mrzData()?.GEN_1_LEGACY }}</div>
        </div>

        <footer class="panel-footer">
          <button [disabled]="engine.loading()" (click)="execute()" class="exec-btn">
            <span class="btn-label">> {{ engine.loading() ? 'PROCESSING...' : 'EXECUTE_CORE' }}</span>
            <span class="btn-mode">{{ module() === 'ndls_mrz' ? 'MRZ_DUMP' : 'PDF_RENDER' }}</span>
            <div class="loading-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    canvas#matrix { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; opacity: 0.1; }
    .dashboard-container { position: relative; z-index: 10; display: flex; width: 95vw; max-width: 920px; height: 550px; background: rgba(8,8,8,0.92); backdrop-filter: blur(20px); border: 1px solid rgba(212,175,55,0.25); box-shadow: 0 0 100px #000; overflow: hidden; font-family: 'JetBrains Mono', monospace; }
    .sidebar { width: 240px; border-right: 1px solid rgba(212,175,55,0.1); display: flex; flex-direction: column; padding: 30px 0; background: rgba(0,0,0,0.4); }
    .brand { padding: 0 30px 40px; font-size: 1.5rem; font-weight: 900; color: #d4af37; letter-spacing: 2px; }
    .brand span { color: #fff; }
    nav { flex: 1; padding: 0 15px; }
    .nav-label { font-size: 0.55rem; color: #444; margin-bottom: 20px; padding: 0 15px; }
    .nav-item { width: 100%; background: transparent; border: none; color: #666; padding: 12px 15px; text-align: left; font-family: inherit; font-size: 0.65rem; cursor: pointer; display: flex; align-items: center; gap: 12px; }
    .nav-item.active { color: #d4af37; background: rgba(212, 175, 55, 0.05); border-left: 2px solid #d4af37; }
    .icon { border: 1px solid currentColor; padding: 2px 4px; font-size: 0.5rem; border-radius: 2px; }
    .sidebar-footer { padding: 25px; border-top: 1px solid rgba(212,175,55,0.05); }
    .scan-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .toggle-text { font-size: 0.5rem; color: #888; }
    .led { width: 6px; height: 6px; border-radius: 50%; background: #222; }
    .led.active { background: #d4af37; box-shadow: 0 0 10px #d4af37; }
    .panel { flex: 1; display: flex; flex-direction: column; }
    .panel-header { padding: 15px 30px; display: flex; justify-content: space-between; font-size: 0.6rem; color: #444; border-bottom: 1px solid rgba(212,175,55,0.05); }
    .grid-form { padding: 25px 40px; display: grid; gap: 12px; }
    .field-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 20px; }
    .field-row label { font-size: 0.55rem; color: #d4af37; opacity: 0.6; font-weight: 800; }
    .field-input { background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 15px; }
    input { width: 100%; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 0.8rem; outline: none; }
    .output-console { margin: 0 40px; padding: 15px; background: #000; border-left: 3px solid #d4af37; font-size: 0.75rem; color: #fff; letter-spacing: 2px; }
    .c-tag { color: #d4af37; margin-right: 10px; font-weight: 800; }
    .panel-footer { margin-top: auto; padding: 25px 40px; background: rgba(0,0,0,0.2); }
    .exec-btn { width: 100%; background: transparent; border: 1px solid #d4af37; padding: 18px; cursor: pointer; position: relative; overflow: hidden; display: flex; justify-content: space-between; align-items: center; }
    .exec-btn:hover:not(:disabled) { background: #d4af37; }
    .exec-btn:hover span { color: #000; }
    .btn-label { color: #d4af37; font-weight: 900; }
    .btn-mode { font-size: 0.6rem; color: #444; }
    .loading-bar { position: absolute; bottom: 0; left: 0; height: 3px; background: #fff; transition: width 2s; }
  `]
})
export class App implements AfterViewInit {
  engine = inject(EngineService);
  module = signal('energia');
  lines = signal<string[]>(new Array(6).fill(''));
  scanMode = signal(false);
  mrzData = signal<any>(null);
  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();
  memoryUsage = signal(128);

  activeFields = computed(() => {
    return this.module() === 'energia' 
      ? [
          { label: 'IDENTITY_NAME', placeholder: 'Mr Peter Browne' },
          { label: 'STREET_LOCUS', placeholder: '114 STANNAWAY RD' },
          { label: 'DISTRICT_ZONE', placeholder: 'KIMMAGE' },
          { label: 'CITY_DISTRICT', placeholder: 'DUBLIN 12' },
          { label: 'COUNTY_REGION', placeholder: 'Co. Dublin 12' },
          { label: 'ZIP_POSTCODE',  placeholder: 'D12 N4V9' }
        ]
      : [
          { label: 'SURNAME_VEC', placeholder: 'BROWNE' },
          { label: 'NAT_ISO_3', placeholder: 'IRL' },
          { label: 'LIC_CORE_9', placeholder: '123456789' },
          { label: 'ISSUE_SEQ_2', placeholder: '01' },
          { label: 'DRIVER_ID_REF', placeholder: '55123456' }
        ];
  });

  execute() {
    this.mrzData.set(null);
    this.engine.process(this.module(), this.lines(), this.scanMode()).subscribe(res => {
      if (this.module() === 'ndls_mrz') {
        this.mrzData.set(res);
      } else {
        const url = URL.createObjectURL(res);
        const a = document.createElement('a');
        a.href = url; a.download = `V_ROOM_IE_${Date.now()}.pdf`; a.click();
      }
    });
  }

  ngAfterViewInit() { this.initMatrix(); setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (180 - 140) + 140)), 2000); }
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
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    }, 40);
  }
}