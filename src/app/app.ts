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

    <div class="os-loader" *ngIf="engine.loading()">
      <div class="loader-content">
        <div class="spinner"></div>
        <div class="loader-text">SYNCING_WITH_CORE...</div>
      </div>
    </div>

    <div class="v-os-container" [class.app-active]="selectedApp()">
      <div class="dynamic-island glass pulse-border">
        <span class="led"></span>
        <span class="status-msg">UPLINK_LIVE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
      </div>

      <section class="springboard fade-in" *ngIf="!selectedApp()">
        <div class="folder-group glass">
          <div class="folder-title">IRELAND_NODES</div>
          <div class="app-grid">
            <div class="app-card" (click)="openApp('energia')">
              <div class="app-icon"><span class="neon-green">⚡</span></div>
              <span class="app-label">IE-bill-gen</span>
            </div>
            <div class="app-card" (click)="openApp('ndls_mrz')">
              <div class="app-icon"><span class="neon-blue">🆔</span></div>
              <span class="app-label">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="folder-group glass">
          <div class="folder-title">GLOBAL_TOOLS</div>
          <div class="app-grid">
            <div class="app-card" (click)="openApp('exif_cleaner')">
              <div class="app-icon"><span class="neon-amber">📸</span></div>
              <span class="app-label">EXIF-Sniper</span>
            </div>
            <div class="app-card" (click)="openApp('face_cut')">
              <div class="app-icon"><span class="neon-red">👤</span></div>
              <span class="app-label">Face-Cut</span>
            </div>
          </div>
        </div>
      </section>

      <main class="app-terminal glass fade-in" *ngIf="selectedApp()">
        <header class="terminal-header">
          <button (click)="closeApp()" class="back-btn">‹ EXIT_TO_DASHBOARD</button>
          <span class="module-id">{{ selectedApp()?.toUpperCase() }}</span>
          <div class="header-tools">
            <label class="ios-check" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="slider" [class.on]="scanMode()"></span>
              <span class="lbl">SCAN_MODE</span>
            </label>
          </div>
        </header>

        <div class="mini-guide glass-inset">
          <span class="guide-tag">GUIDE:</span> {{ getInstruction() }}
        </div>

        <div class="terminal-body">
          <div class="col-form">
            <div class="form-grid">
              @for (f of schema(); track f.id) {
                <div class="field">
                  <label>{{ f.label }}</label>
                  <div class="input-wrap glass-inset">
                    <input [(ngModel)]="lines()[$index]" (ngModelChange)="onInputChange()" [placeholder]="f.p" spellcheck="false" autocomplete="off">
                  </div>
                </div>
              }
            </div>

            <div class="drop-zone glass-inset" *ngIf="isMediaApp()" (click)="fi.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
              <input type="file" #fi (change)="onFile($event)" hidden>
              <span class="drop-txt">{{ selectedFile() ? 'FILE_LOCKED: ' + selectedFile()?.name : 'DROP_IMAGE_OR_CLICK' }}</span>
            </div>
          </div>

          <div class="col-visuals">
            <div id="map" class="glass-inset" *ngIf="selectedApp() === 'exif_cleaner'"></div>
            
            <div class="mrz-output glass-dark" *ngIf="mrzData()">
              <div class="mrz-header">REALTIME_MRZ_DUMP</div>
              <div class="mrz-body">
                <div class="m-row"><span class="m-tag">G2</span> <code>{{ mrzData().GEN_2_ISO }}</code> <button class="c-pill" (click)="copy(mrzData().GEN_2_ISO)">COPY</button></div>
                <div class="m-row"><span class="m-tag">G1</span> <code>{{ mrzData().GEN_1_LEGACY }}</code></div>
              </div>
            </div>
          </div>
        </div>

        <footer class="terminal-footer" *ngIf="selectedApp() !== 'ndls_mrz'">
          <button [disabled]="engine.loading() || (requiresFile() && !selectedFile())" (click)="fire()" class="exec-btn">
            <span class="txt">=> INITIATE_EXECUTION_SEQUENCE</span>
            <div class="load-fill" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    /* ANIMATIONS [cite: 2026-03-16] */
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .os-loader { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 2000; display: flex; align-items: center; justify-content: center; }
    .spinner { width: 50px; height: 50px; border: 3px solid rgba(0,255,65,0.1); border-top-color: #00ff41; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loader-text { margin-top: 20px; font-size: 0.7rem; color: #00ff41; font-family: monospace; letter-spacing: 2px; }

    .v-os-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 30px; position: relative; z-index: 10; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }
    
    .glass { background: rgba(10, 10, 10, 0.92); backdrop-filter: blur(120px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 40px; }
    .glass-inset { background: rgba(25, 25, 25, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
    .glass-dark { background: #000; border: 1px solid #00ff41; border-radius: 30px; }

    .dynamic-island { padding: 8px 30px; border-radius: 50px; margin-bottom: 40px; display: flex; align-items: center; gap: 15px; box-shadow: 0 15px 50px #000; }
    .led { width: 8px; height: 8px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 12px #00ff41; }

    /* SPRINGBOARD [cite: 2026-02-21] */
    .springboard { width: 100%; max-width: 900px; display: flex; gap: 40px; }
    .folder-group { flex: 1; padding: 35px; border-radius: 40px; }
    .folder-title { font-size: 0.8rem; font-weight: 900; color: #555; text-align: center; letter-spacing: 3px; margin-bottom: 30px; }
    .app-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .app-card { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.3s; }
    .app-card:hover { transform: scale(1.1); }
    .app-icon { width: 85px; height: 85px; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; border: 1px solid rgba(255, 255, 255, 0.05); background: rgba(255,255,255,0.01); }
    .app-label { font-size: 0.75rem; font-weight: 900; color: #666; margin-top: 15px; }

    /* TERMINAL [cite: 2026-02-05] */
    .app-terminal { position: absolute; inset: 20px; padding: 40px; display: flex; flex-direction: column; }
    .terminal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .back-btn { background: transparent; border: none; color: #fff; font-weight: 900; font-size: 0.8rem; opacity: 0.5; cursor: pointer; }
    .module-id { color: #00ff41; font-weight: 900; font-size: 1.5rem; letter-spacing: 4px; }

    .mini-guide { padding: 12px 25px; font-size: 0.7rem; color: #888; margin-bottom: 30px; border-radius: 15px; }
    .guide-tag { color: #00ff41; font-weight: 900; margin-right: 10px; }

    .terminal-body { display: flex; gap: 40px; flex: 1; min-height: 0; }
    .col-form, .col-visuals { flex: 1; display: flex; flex-direction: column; gap: 25px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field label { font-size: 0.65rem; font-weight: 900; color: #fff; margin-bottom: 8px; display: block; }
    .input-wrap { padding: 15px 20px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #00ff41; font-family: 'JetBrains Mono'; font-size: 1rem; }

    /* MRZ PRETTIER [cite: 2026-03-16] */
    .mrz-output { padding: 35px; min-height: 200px; display: flex; flex-direction: column; justify-content: center; }
    .mrz-header { font-size: 0.6rem; color: #555; margin-bottom: 20px; font-weight: 900; letter-spacing: 2px; }
    .m-row { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; }
    .m-tag { color: #00ff41; font-weight: 900; font-size: 0.75rem; width: 40px; }
    code { color: #fff; flex: 1; font-size: 1.1rem; letter-spacing: 2px; font-family: 'JetBrains Mono'; }
    .c-pill { background: #00ff41; color: #000; border: none; padding: 6px 15px; border-radius: 20px; font-size: 0.65rem; font-weight: 900; cursor: pointer; }

    #map { flex: 1; border-radius: 25px; min-height: 300px; }
    .drop-zone { flex: 1; display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(255,255,255,0.1); cursor: pointer; text-align: center; }
    .drop-txt { font-size: 0.75rem; font-weight: 900; color: #444; padding: 20px; }

    .exec-btn { width: 100%; padding: 28px; background: #fff; color: #000; border: none; border-radius: 25px; font-weight: 900; font-size: 1.1rem; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; margin-top: 20px; }
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

  getInstruction(): string {
    const map: any = {
      'energia': 'Enter address lines. Right-alignment is automatic. Scan artifacts optional.',
      'ndls_mrz': 'Type to compute. No buttons needed. GEN1/GEN2 dual-core output.',
      'exif_cleaner': 'Pick location on map or enter coords. Default date is TODAY.',
      'face_cut': 'Upload photo. Set zoom % and vertical shift. Output: 600x800 px.'
    };
    return map[this.selectedApp() || ''] || 'Ready to execute.';
  }

  isMediaApp() { return ['exif_cleaner', 'face_cut'].includes(this.selectedApp() || ''); }
  requiresFile() { return this.isMediaApp(); }
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
        a.download = `V_SYNC_RES_${Date.now()}.${ext}`;
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
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (220 - 180) + 180)), 3000);
  }
}