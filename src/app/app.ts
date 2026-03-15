import { Component, signal, inject, AfterViewInit, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

declare var L: any; // Leaflet [cite: 2026-02-05]

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas #matrixCanvas id="matrix"></canvas>

    <div class="os-container" [class.app-mode]="selectedApp()">
      <div class="island glass">
        <div class="island-inner">
          <span class="led pulse"></span>
          <span class="status">V_OS // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
        </div>
      </div>

      <section class="springboard" *ngIf="!selectedApp()">
        <div class="folder">
          <div class="f-header"><span class="f-tag">DIR</span><h2 class="f-name">IRELAND</h2></div>
          <div class="app-grid">
            <div class="app-card glass" (click)="openApp('energia')"><div class="icon n-green">⚡</div><span class="label">IE-bill-gen</span></div>
            <div class="app-card glass" (click)="openApp('ndls_mrz')"><div class="icon n-blue">🆔</div><span class="label">IE-NDLS-MRZ</span></div>
          </div>
        </div>

        <div class="folder">
          <div class="f-header"><span class="f-tag">SYS</span><h2 class="f-name">GLOBAL_TOOLS</h2></div>
          <div class="app-grid">
            <div class="app-card glass" (click)="openApp('exif_cleaner')"><div class="icon n-amber">📸</div><span class="label">EXIF-Sniper</span></div>
            <div class="app-card glass" (click)="openApp('face_cut')"><div class="icon n-red">👤</div><span class="label">Face-Cut</span></div>
          </div>
        </div>
      </section>

      <main class="app-view glass" *ngIf="selectedApp()">
        <header class="v-header">
          <button (click)="closeApp()" class="esc">/root_dashboard</button>
          <span class="v-title">{{ selectedApp()?.toUpperCase() }}</span>
          <div class="v-tools">
            <div class="file-tag" *ngIf="selectedFile()">[LOCKED: {{ selectedFile()?.name }}]</div>
            <label class="scan-mode" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="slider" [class.active]="scanMode()"></span>
              <span class="txt">SCAN</span>
            </label>
          </div>
        </header>

        <div class="v-layout">
          <div class="v-inputs">
            <div class="form-grid">
              @for (field of schema(); track field.id) {
                <div class="field">
                  <label>{{ field.label }}</label>
                  <div class="i-wrap glass-inset">
                    <input [(ngModel)]="lines()[$index]" (ngModelChange)="onInputChange()" [placeholder]="field.p" spellcheck="false" autocomplete="off">
                  </div>
                </div>
              }
            </div>

            <div class="drop-zone glass-inset" 
                 *ngIf="selectedApp() === 'exif_cleaner' || selectedApp() === 'face_cut'"
                 (click)="fIn.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
              <input type="file" #fIn (change)="onFile($event)" hidden>
              <span>{{ selectedFile() ? 'FILE_ATTACHED' : 'DROP_IMAGE_OR_CLICK' }}</span>
            </div>
          </div>

          <div class="v-visuals">
            <div id="map" class="glass-inset" *ngIf="selectedApp() === 'exif_cleaner'"></div>
            <div class="mrz-box glass-dark" *ngIf="mrzData()">
              <div class="m-line"><span class="tag">G2</span><code>{{ mrzData().GEN_2_ISO }}</code><button (click)="copy(mrzData().GEN_2_ISO)">CPY</button></div>
              <div class="m-line"><span class="tag">G1</span><code>{{ mrzData().GEN_1_LEGACY }}</code></div>
            </div>
          </div>
        </div>

        <footer>
          <button [disabled]="engine.loading() || (requiresFile() && !selectedFile())" (click)="fire()" class="exec-btn">
            <span class="bt">{{ engine.loading() ? 'ENCRYPTING...' : 'EXECUTE_CORE_COMMAND' }}</span>
            <div class="load-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .os-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 30px; position: relative; z-index: 10; font-family: 'Plus Jakarta Sans', sans-serif; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }
    .glass { background: rgba(10,10,10,0.9); backdrop-filter: blur(100px) saturate(180%); border: 1px solid rgba(255,255,255,0.08); border-radius: 35px; }
    .glass-inset { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; box-shadow: inset 0 2px 10px #000; }
    .glass-dark { background: #000; border: 1px solid #00ff41; border-radius: 20px; padding: 25px; }

    .island { padding: 8px 25px; border-radius: 50px; display: flex; align-items: center; gap: 15px; margin-bottom: 40px; box-shadow: 0 15px 45px #000; }
    .led { width: 8px; height: 8px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 10px #00ff41; }
    .pulse { animation: p 2s infinite; } @keyframes p { 50% { opacity: 0.3; } }
    .status { font-size: 0.65rem; font-weight: 800; color: #444; }

    .springboard { width: 100%; max-width: 800px; display: flex; flex-direction: column; gap: 50px; }
    .f-header { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; }
    .f-tag { background: #00ff41; color: #000; font-size: 0.5rem; font-weight: 900; padding: 2px 5px; border-radius: 3px; }
    .f-name { font-size: 1.1rem; font-weight: 900; color: #fff; letter-spacing: 2px; }
    .app-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px; }
    .app-card { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.3s; }
    .app-card:hover { transform: scale(1.1); }
    .icon { width: 75px; height: 75px; border-radius: 22px; display: flex; align-items: center; justify-content: center; font-size: 2rem; border: 1px solid rgba(255,255,255,0.05); }
    .label { font-size: 0.7rem; font-weight: 800; color: #555; margin-top: 10px; }

    .app-view { position: absolute; inset: 25px; padding: 45px; display: flex; flex-direction: column; box-shadow: 0 0 100px #000; }
    .v-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .esc { background: transparent; border: none; color: #444; font-weight: 800; cursor: pointer; }
    .v-title { color: #00ff41; font-weight: 900; font-size: 1.4rem; letter-spacing: 3px; }

    .v-layout { display: flex; gap: 40px; flex: 1; min-height: 0; }
    .v-inputs { flex: 1; display: flex; flex-direction: column; gap: 20px; }
    .v-visuals { flex: 1; display: flex; flex-direction: column; gap: 20px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field label { font-size: 0.6rem; font-weight: 900; color: #444; margin-bottom: 8px; display: block; }
    .i-wrap { padding: 15px 20px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: 'JetBrains Mono'; font-size: 0.95rem; }

    #map { flex: 1; border-radius: 20px; min-height: 250px; }
    .drop-zone { flex: 1; display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(255,255,255,0.05); cursor: pointer; font-weight: 900; font-size: 0.7rem; color: #333; }
    
    .exec-btn { width: 100%; padding: 25px; background: #fff; color: #000; border-radius: 20px; border: none; font-weight: 900; font-size: 1.1rem; letter-spacing: 2px; cursor: pointer; position: relative; overflow: hidden; }
    .load-bar { position: absolute; bottom: 0; left: 0; height: 5px; background: #00ff41; transition: 2s; }
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

  requiresFile() { return this.selectedApp() === 'exif_cleaner' || this.selectedApp() === 'face_cut'; }
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
      this.engine.execute(this.selectedApp()!, this.lines(), false).subscribe(res => this.mrzData.set(res));
    }
  }

  fire() {
    const fd = new FormData();
    fd.append('type', this.selectedApp()!);
    fd.append('lines', JSON.stringify(this.lines()));
    fd.append('scan_mode', this.scanMode().toString());
    if (this.selectedFile()) fd.append('file', this.selectedFile()!);

    this.engine.uploadExecute(fd).subscribe((res: Blob) => {
      const url = URL.createObjectURL(res);
      const a = document.createElement('a');
      a.href = url;
      const ext = this.selectedApp() === 'exif_cleaner' || this.selectedApp() === 'face_cut' ? 'jpg' : 'pdf';
      a.download = `V_RESULT_${Date.now()}.${ext}`;
      a.click(); URL.revokeObjectURL(url);
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