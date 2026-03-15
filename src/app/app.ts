import { Component, signal, inject, AfterViewInit, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

declare var L: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas #matrixCanvas id="matrix"></canvas>

    <div class="v-os-container" [class.app-active]="selectedApp()">
      <div class="island-node glass">
        <div class="inner">
          <span class="led pulse"></span>
          <span class="status-msg">UPLINK_LIVE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
        </div>
      </div>

      <section class="home-screen" *ngIf="!selectedApp()">
        <div class="category-block">
          <div class="cat-label">IRELAND_NODES</div>
          <div class="grid">
            <div class="app-card glass" (click)="openApp('energia')">
              <div class="app-icon n-green">⚡</div>
              <span class="app-name">IE-bill-gen</span>
            </div>
            <div class="app-card glass" (click)="openApp('ndls_mrz')">
              <div class="app-icon n-blue">🆔</div>
              <span class="app-name">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="category-block">
          <div class="cat-label">GLOBAL_TOOLS</div>
          <div class="grid">
            <div class="app-card glass" (click)="openApp('exif_cleaner')">
              <div class="app-icon n-amber">📸</div>
              <span class="app-name">EXIF-Sniper</span>
            </div>
            <div class="app-card glass" (click)="openApp('face_cut')">
              <div class="app-icon n-red">👤</div>
              <span class="app-name">Face-Cut</span>
            </div>
          </div>
        </div>
      </section>

      <main class="terminal-overlay glass" *ngIf="selectedApp()">
        <header class="t-header">
          <button (click)="closeApp()" class="back-link">‹ DASHBOARD</button>
          <div class="t-title">{{ selectedApp() === 'energia' ? 'IE-BILL-GEN' : selectedApp()?.toUpperCase() }}</div>
          <div class="t-tools">
            <span class="file-status" *ngIf="selectedFile()">[SYNC: {{ selectedFile()?.name }}]</span>
            <label class="scan-opt" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="ios-slider" [class.on]="scanMode()"></span>
              <span class="lbl">ARTIFACTS</span>
            </label>
          </div>
        </header>

        <div class="t-layout">
          <div class="t-inputs">
            <div class="input-grid">
              @for (f of schema(); track f.id) {
                <div class="input-node">
                  <label>{{ f.label }}</label>
                  <div class="input-wrap glass-inset">
                    <input [(ngModel)]="lines()[$index]" (ngModelChange)="onInputChange()" [placeholder]="f.p" spellcheck="false" autocomplete="off">
                  </div>
                </div>
              }
            </div>

            <div class="drop-zone glass-inset" *ngIf="isMediaApp()" (click)="fi.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
              <input type="file" #fi (change)="onFile($event)" hidden>
              <div class="drop-info">
                <span class="icon">{{ selectedFile() ? '✅' : '📤' }}</span>
                <span class="txt">{{ selectedFile() ? 'LOCKED' : 'DROP_IMAGE' }}</span>
              </div>
            </div>
          </div>

          <div class="t-visuals">
            <div id="map" class="glass-inset" *ngIf="selectedApp() === 'exif_cleaner'"></div>
            
            <div class="mrz-output glass-dark" *ngIf="mrzData()">
              <div class="console-line">
                <span class="c-tag">[G2]</span> <code>{{ mrzData().GEN_2_ISO }}</code>
                <button class="c-pill" (click)="copy(mrzData().GEN_2_ISO)">COPY</button>
              </div>
              <div class="console-line">
                <span class="c-tag">[G1]</span> <code>{{ mrzData().GEN_1_LEGACY }}</code>
              </div>
            </div>
          </div>
        </div>

        <footer class="t-footer">
          <button [disabled]="engine.loading() || (isMediaApp() && !selectedFile())" (click)="fire()" class="exec-btn-full">
            <span class="btn-txt">{{ engine.loading() ? 'PROCCESSING...' : 'EXECUTE_CORE_GEN' }}</span>
            <div class="load-fill" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .v-os-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px; position: relative; z-index: 10; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }
    
    .glass { background: rgba(10, 10, 10, 0.92); backdrop-filter: blur(120px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 40px; }
    .glass-inset { background: rgba(25, 25, 25, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
    .glass-dark { background: #000; border: 1px solid var(--matrix-green); border-radius: 25px; }

    /* DYNAMIC ISLAND [cite: 2026-02-05] */
    .island-node { padding: 8px 30px; border-radius: 50px; margin-bottom: 50px; box-shadow: 0 15px 50px #000; }
    .led { width: 8px; height: 8px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 12px #00ff41; }
    .pulse { animation: p 2s infinite; } @keyframes p { 50% { opacity: 0.2; } }
    .status-msg { font-size: 0.65rem; font-weight: 800; color: #fff; letter-spacing: 1px; margin-left: 15px; }

    /* SPRINGBOARD [cite: 2026-02-21] */
    .home-screen { width: 100%; max-width: 900px; display: flex; gap: 40px; }
    .category-block { flex: 1; display: flex; flex-direction: column; gap: 20px; }
    .cat-label { font-size: 0.8rem; font-weight: 900; color: #555; text-align: center; letter-spacing: 3px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .app-card { display: flex; flex-direction: column; align-items: center; padding: 25px; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .app-card:hover { transform: scale(1.08); border-color: #00ff41; box-shadow: 0 0 30px rgba(0,255,65,0.2); }
    .app-icon { font-size: 2.2rem; margin-bottom: 15px; }
    .app-name { font-size: 0.75rem; font-weight: 900; color: #fff; }

    /* TERMINAL [cite: 2026-02-05] */
    .terminal-overlay { position: absolute; inset: 20px; padding: 45px; display: flex; flex-direction: column; box-shadow: 0 0 100px #000; z-index: 100; }
    .t-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .back-link { background: transparent; border: none; color: #fff; font-weight: 900; font-size: 0.85rem; cursor: pointer; opacity: 0.6; }
    .back-link:hover { opacity: 1; }
    .t-title { color: #00ff41; font-weight: 900; font-size: 1.5rem; letter-spacing: 4px; text-shadow: 0 0 15px rgba(0,255,65,0.3); }

    .t-layout { display: flex; gap: 40px; flex: 1; min-height: 0; }
    .t-inputs, .t-visuals { flex: 1; display: flex; flex-direction: column; gap: 25px; }
    .input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    
    /* TRUE CONTRAST FIX [cite: 2026-03-16] */
    .input-node label { font-size: 0.65rem; font-weight: 900; color: #fff; margin-bottom: 10px; display: block; letter-spacing: 1px; }
    .input-wrap { padding: 16px 22px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #00ff41; font-family: 'JetBrains Mono'; font-size: 1rem; font-weight: 700; }
    input::placeholder { color: #333; }

    #map { flex: 1; border-radius: 25px; min-height: 300px; }
    .drop-zone { flex: 1; display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(255,255,255,0.1); cursor: pointer; transition: 0.2s; }
    .drop-zone:hover { border-color: #00ff41; background: rgba(0,255,65,0.02); }
    .drop-info { text-align: center; }
    .drop-info .icon { font-size: 2.5rem; display: block; margin-bottom: 10px; }
    .drop-info .txt { font-size: 0.75rem; font-weight: 900; color: #fff; }

    .exec-btn-full { width: 100%; padding: 28px; background: #fff; color: #000; border: none; border-radius: 25px; font-weight: 900; font-size: 1.2rem; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; margin-top: 30px; }
    .exec-btn-full:active { transform: scale(0.98); }
    .load-fill { position: absolute; bottom: 0; left: 0; height: 6px; background: #00ff41; transition: 2s; }
  `]
})
export class App implements AfterViewInit {
  engine = inject(EngineService);
  selectedApp = signal<string | null>(null);
  schema = signal<any[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal(false);
  selectedFile = signal<File | null>(null);
  mrzData = signal<any>(null);
  memoryUsage = signal(128);
  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();
  private map: any; private marker: any;

  constructor() {
    effect(() => {
      const app = this.selectedApp();
      if (app) {
        this.engine.getSchema(app).subscribe(s => {
          this.schema.set(s);
          this.lines.set(new Array(s.length).fill(''));
          if (app === 'exif_cleaner') setTimeout(() => this.initMap(), 500);
        });
      }
    }, { allowSignalWrites: true });
  }

  isMediaApp() { return ['exif_cleaner', 'face_cut'].includes(this.selectedApp() || ''); }
  openApp(n: string) { this.selectedApp.set(n); }
  closeApp() { this.selectedApp.set(null); this.selectedFile.set(null); this.mrzData.set(null); this.map = null; }

  initMap() {
    if (this.map) return;
    this.map = L.map('map', { zoomControl: false }).setView([53.3498, -6.2603], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.map);
    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      if (this.marker) this.marker.setLatLng(e.latlng);
      else this.marker = L.marker(e.latlng).addTo(this.map);
      const l = this.lines(); l[0] = lat.toFixed(6); l[1] = lng.toFixed(6);
      this.lines.set([...l]);
    });
  }

  onFile(e: any) { this.selectedFile.set(e.target.files[0]); }
  onDrop(e: DragEvent) { e.preventDefault(); if (e.dataTransfer?.files.length) this.selectedFile.set(e.dataTransfer.files[0]); }

  onInputChange() {
    if (this.selectedApp() === 'ndls_mrz') {
      const fd = new FormData();
      fd.append('type', 'ndls_mrz');
      fd.append('lines', JSON.stringify(this.lines()));
      this.engine.execute(fd, true).subscribe(res => this.mrzData.set(res));
    }
  }

  fire() {
    const fd = new FormData();
    fd.append('type', this.selectedApp()!);
    fd.append('lines', JSON.stringify(this.lines()));
    fd.append('scan_mode', this.scanMode().toString());
    if (this.selectedFile()) fd.append('file', this.selectedFile()!);

    const isJson = this.selectedApp() === 'ndls_mrz';
    this.engine.execute(fd, isJson).subscribe((res: any) => {
      if (isJson) this.mrzData.set(res);
      else {
        const url = URL.createObjectURL(res);
        const a = document.createElement('a');
        a.href = url;
        const ext = this.isMediaApp() ? 'jpg' : 'pdf';
        a.download = `V_OS_RESULT_${Date.now()}.${ext}`;
        a.click(); URL.revokeObjectURL(url);
      }
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }

  ngAfterViewInit() {
    const canvas = (document.getElementById('matrix') as HTMLCanvasElement);
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