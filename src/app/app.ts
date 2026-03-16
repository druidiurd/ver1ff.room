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

    <div class="os-loader" *ngIf="engine.loading() && !selectedApp()">
      <div class="loader-content">
        <div class="spinner"></div>
        <div class="loader-text">SYNCING_CORE...</div>
      </div>
    </div>

    <div class="v-os-container" [class.app-active]="selectedApp()">
      <div class="status-island glass fade-in">
        <span class="led pulse"></span>
        <span class="id-code">V_OS // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
      </div>

      <section class="springboard fade-in" *ngIf="!selectedApp()">
        <div class="folder glass">
          <div class="folder-title">IRELAND_NODES</div>
          <div class="app-grid">
            <div class="app-card" (click)="openApp('energia')">
              <div class="app-icon glass"><span class="neon-green">⚡</span></div>
              <span class="app-label">IE-bill-gen</span>
            </div>
            <div class="app-card" (click)="openApp('ndls_mrz')">
              <div class="app-icon glass"><span class="neon-blue">🆔</span></div>
              <span class="app-label">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="folder glass">
          <div class="folder-title">GLOBAL_TOOLS</div>
          <div class="app-grid">
            <div class="app-card" (click)="openApp('exif_cleaner')">
              <div class="app-icon glass"><span class="neon-amber">📸</span></div>
              <span class="app-label">EXIF-Sniper</span>
            </div>
            <div class="app-card" (click)="openApp('face_cut')">
              <div class="app-icon glass"><span class="neon-red">👤</span></div>
              <span class="app-label">Face-Cut</span>
            </div>
          </div>
        </div>
      </section>

      <main class="app-terminal glass fade-in" *ngIf="selectedApp()">
        <header class="t-header">
          <button (click)="closeApp()" class="esc">‹ BACK_TO_ROOT</button>
          <div class="t-module">{{ selectedApp()?.toUpperCase() }}</div>
          <div class="t-tools">
            <span class="f-info" *ngIf="selectedFile()">[SYNC: {{ selectedFile()?.name }}]</span>
            <label class="scan-mode" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="slider" [class.on]="scanMode()"></span>
              <span class="txt">SCAN</span>
            </label>
          </div>
        </header>

        <div class="t-guide glass-inset">
          <span class="g-tag">INFO:</span> {{ getGuideText() }}
        </div>

        <div class="t-body">
          <div class="col-inputs">
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

            <div class="drop-zone glass-inset" *ngIf="isMediaApp()" (click)="fi.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
              <input type="file" #fi (change)="onFile($event)" hidden>
              <div class="drop-info">
                <span class="icon">{{ selectedFile() ? '✅' : '📤' }}</span>
                <span class="label">{{ selectedFile() ? 'LOCKED' : 'DROP_IMAGE' }}</span>
              </div>
            </div>
          </div>

          <div class="col-visuals">
            <div id="map" class="glass-inset" *ngIf="selectedApp() === 'exif_cleaner'"></div>
            
            <div class="preview-box glass-inset" *ngIf="selectedApp() === 'face_cut' && previewUrl()">
              <img [src]="previewUrl()" alt="Biometric Preview" class="face-img">
              <div class="p-tag">LIVE_PREVIEW_3X4</div>
            </div>

            <div class="mrz-output glass-dark" *ngIf="mrzData()">
              <div class="m-row"><span class="t">G2</span><code>{{ mrzData().GEN_2_ISO }}</code><button (click)="copy(mrzData().GEN_2_ISO)">CPY</button></div>
              <div class="m-row"><span class="t">G1</span><code>{{ mrzData().GEN_1_LEGACY }}</code></div>
            </div>
          </div>
        </div>

        <footer>
          <button [disabled]="engine.loading() || (requiresFile() && !selectedFile())" (click)="fire()" class="exec-btn-titan">
            <span class="bt">> {{ engine.loading() ? 'PROCCESSING...' : 'EXECUTE_SYNC_COMMAND' }}</span>
            <div class="load-fill" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .fade-in { animation: fIn 0.4s ease-out; } @keyframes fIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .os-loader { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(15px); z-index: 2000; display: flex; align-items: center; justify-content: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(0,255,65,0.1); border-top-color: #00ff41; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loader-text { margin-top: 20px; font-size: 0.6rem; color: #00ff41; letter-spacing: 3px; font-family: monospace; }

    .v-os-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px; position: relative; z-index: 10; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }
    
    .glass { background: rgba(10, 10, 10, 0.93); backdrop-filter: blur(120px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 40px; }
    .glass-inset { background: rgba(25, 25, 25, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
    .glass-dark { background: #000; border: 1px solid #00ff41; border-radius: 30px; }

    .status-island { padding: 8px 30px; border-radius: 50px; margin-bottom: 50px; box-shadow: 0 15px 50px #000; display: flex; align-items: center; gap: 15px; }
    .led { width: 8px; height: 8px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 10px #00ff41; }
    .pulse { animation: p 2s infinite; } @keyframes p { 50% { opacity: 0.2; } }
    .id-code { font-size: 0.65rem; font-weight: 800; color: #444; letter-spacing: 1px; }

    .springboard { width: 100%; max-width: 850px; display: flex; gap: 40px; }
    .folder { flex: 1; padding: 35px; border-radius: 40px; }
    .folder-title { font-size: 0.8rem; font-weight: 900; color: #555; text-align: center; letter-spacing: 3px; margin-bottom: 30px; }
    .app-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .app-card { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.3s; }
    .app-card:hover { transform: scale(1.1); }
    .app-icon { width: 85px; height: 85px; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; border: 1px solid rgba(255, 255, 255, 0.05); }
    .app-label { font-size: 0.75rem; font-weight: 800; color: #666; margin-top: 15px; }

    .app-terminal { position: absolute; inset: 20px; padding: 45px; display: flex; flex-direction: column; }
    .t-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .esc { background: transparent; border: none; color: #444; font-weight: 900; font-size: 0.85rem; cursor: pointer; }
    .t-module { color: #00ff41; font-weight: 900; font-size: 1.5rem; letter-spacing: 4px; }

    .t-guide { padding: 12px 25px; font-size: 0.7rem; color: #888; margin-bottom: 30px; border-radius: 15px; }
    .g-tag { color: #00ff41; font-weight: 900; margin-right: 10px; }

    .t-body { display: flex; gap: 45px; flex: 1; min-height: 0; }
    .col-inputs, .col-visuals { flex: 1; display: flex; flex-direction: column; gap: 25px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field label { font-size: 0.65rem; font-weight: 900; color: #fff; margin-bottom: 8px; display: block; }
    .i-wrap { padding: 16px 22px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #00ff41; font-family: 'JetBrains Mono'; font-size: 1rem; }

    /* PREVIEW UI [cite: 2026-03-16] */
    .preview-box { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .face-img { max-height: 100%; max-width: 100%; border-radius: 10px; box-shadow: 0 10px 30px #000; }
    .p-tag { position: absolute; bottom: 15px; right: 15px; font-size: 0.55rem; font-weight: 900; color: #333; }

    .mrz-output { padding: 35px; min-height: 200px; display: flex; flex-direction: column; justify-content: center; }
    .m-row { display: flex; align-items: center; gap: 20px; margin-bottom: 15px; font-family: 'JetBrains Mono'; font-size: 1.1rem; }
    .t { color: #00ff41; font-weight: 900; font-size: 0.75rem; width: 40px; }
    code { color: #fff; flex: 1; letter-spacing: 2px; }
    
    #map { flex: 1; border-radius: 25px; min-height: 300px; }
    .drop-zone { flex: 1; display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(255,255,255,0.1); cursor: pointer; text-align: center; }
    .drop-info .icon { font-size: 2.5rem; display: block; margin-bottom: 10px; }
    .drop-info .label { font-size: 0.75rem; font-weight: 900; color: #333; }

    .exec-btn-titan { width: 100%; padding: 28px; background: #fff; color: #000; border: none; border-radius: 25px; font-weight: 900; font-size: 1.2rem; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; margin-top: 25px; }
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
  previewUrl = signal<string | null>(null); // Signal for live preview [cite: 2026-03-16]
  
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

  getGuideText(): string {
    const map: any = {
      'energia': 'Auto-aligned Irish Utility Bill generator. Scan artifacts are optional.',
      'ndls_mrz': 'Real-time dual-core MRZ generator. Updates instantly on keypress.',
      'exif_cleaner': 'OnePlus 6 (IMX519) metadata injector. Pick coordinates on map.',
      'face_cut': 'Biometric 3x4 crop tool. Zoom and Shift update the preview instantly.'
    };
    return map[this.selectedApp() || ''] || 'Awaiting command.';
  }

  isMediaApp() { return ['exif_cleaner', 'face_cut'].includes(this.selectedApp() || ''); }
  requiresFile() { return this.isMediaApp(); }
  openApp(n: string) { this.selectedApp.set(n); }
  
  closeApp() { 
    this.selectedApp.set(null); 
    this.selectedFile.set(null); 
    this.mrzData.set(null); 
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!); // Clean memory [cite: 2026-02-05]
    this.previewUrl.set(null);
    this.map = null; 
  }

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

  onFile(e: any) { 
    this.selectedFile.set(e.target.files[0]);
    if (this.selectedApp() === 'face_cut') this.updatePreview(); // Trigger initial preview [cite: 2026-03-16]
  }
  
  onDrop(e: DragEvent) { 
    e.preventDefault(); 
    if (e.dataTransfer?.files.length) {
      this.selectedFile.set(e.dataTransfer.files[0]);
      if (this.selectedApp() === 'face_cut') this.updatePreview();
    }
  }

  /** Senior Reactive Sink [cite: 2026-03-16] */
  onInputChange() {
    if (this.selectedApp() === 'ndls_mrz') {
      const fd = new FormData();
      fd.append('type', 'ndls_mrz');
      fd.append('lines', JSON.stringify(this.lines()));
      this.engine.execute(fd, true).subscribe(res => this.mrzData.set(res));
    }
    if (this.selectedApp() === 'face_cut' && this.selectedFile()) {
      this.updatePreview(); // Реагуємо на зум/шифт миттєво [cite: 2026-03-16]
    }
  }

  /** Генерація живого прев'ю без скачування [cite: 2026-03-16] */
  updatePreview() {
    const fd = new FormData();
    fd.append('type', 'face_cut');
    fd.append('lines', JSON.stringify(this.lines()));
    fd.append('file', this.selectedFile()!);
    this.engine.execute(fd, false).subscribe((res: Blob) => {
      if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!); // Revoke old to prevent leak
      this.previewUrl.set(URL.createObjectURL(res));
    });
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
        a.download = `V_OS_RES_${Date.now()}.${ext}`;
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