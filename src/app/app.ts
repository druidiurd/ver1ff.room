import { Component, signal, inject, AfterViewInit, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

declare var L: any; // Leaflet Global [cite: 2026-02-05]

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas #matrixCanvas id="matrix"></canvas>

    <div class="os-loader" *ngIf="engine.loading() && !selectedApp()">
      <div class="loader-content">
        <div class="spinner"></div>
        <div class="loader-text">SYNCING_WITH_V_CORE_V9.4...</div>
        <div class="loader-bar-bg"><div class="loader-bar-fill"></div></div>
      </div>
    </div>

    <div class="v-os-container" [class.app-active]="selectedApp()">
      
      <header class="dynamic-island glass pulse-border">
        <div class="island-inner">
          <span class="status-led pulse"></span>
          <span class="status-text">UPLINK_LIVE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB // V_OS_V9.4</span>
        </div>
      </header>

      <section class="springboard fade-in" *ngIf="!selectedApp()">
        
        <div class="folder-block glass">
          <div class="folder-header">
            <span class="folder-tag">DIR</span>
            <h2 class="folder-name">IRELAND_NODES</h2>
          </div>
          <div class="app-grid">
            <div class="app-card" (click)="openApp('energia')">
              <div class="app-icon-wrap glass-inset">
                <span class="neon-green">⚡</span>
              </div>
              <span class="app-label">IE-bill-gen</span>
            </div>
            <div class="app-card" (click)="openApp('ndls_mrz')">
              <div class="app-icon-wrap glass-inset">
                <span class="neon-blue">🆔</span>
              </div>
              <span class="app-label">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="folder-block glass">
          <div class="folder-header">
            <span class="folder-tag">SYS</span>
            <h2 class="folder-name">GLOBAL_TOOLS</h2>
          </div>
          <div class="app-grid">
            <div class="app-card" (click)="openApp('exif_cleaner')">
              <div class="app-icon-wrap glass-inset">
                <span class="neon-amber">📸</span>
              </div>
              <span class="app-label">EXIF-Sniper</span>
            </div>
            <div class="app-card" (click)="openApp('face_cut')">
              <div class="app-icon-wrap glass-inset">
                <span class="neon-red">👤</span>
              </div>
              <span class="app-label">Face-Cut</span>
            </div>
          </div>
        </div>
      </section>

      <main class="app-terminal glass fade-in" *ngIf="selectedApp()">
        <header class="terminal-header">
          <button (click)="closeApp()" class="back-btn">‹ ESC_TO_DASHBOARD</button>
          <div class="module-id-display">
            <span class="module-prefix">MODULE::</span>
            <span class="module-name">{{ getAppTitle() }}</span>
          </div>
          <div class="header-tools">
            <div class="file-status-pill" *ngIf="selectedFile()">
              <span class="pill-dot"></span> [SYNC: {{ selectedFile()?.name }}]
            </div>
            <label class="scan-toggle-ui" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="toggle-slider" [class.on]="scanMode()"></span>
              <span class="toggle-label">ARTIFACTS</span>
            </label>
          </div>
        </header>

        <div class="mini-guide-bar glass-inset">
          <span class="guide-prefix">SYSTEM_MANUAL:</span>
          <span class="guide-text">{{ getGuideText() }}</span>
        </div>

        <div class="terminal-main-layout">
          <div class="input-column">
            <div class="form-grid-layout">
              @for (field of schema(); track field.id) {
                <div class="input-field-group">
                  <label class="field-label">{{ field.label }}</label>
                  <div class="field-input-container glass-inset">
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

            <div class="media-drop-zone glass-inset" 
                 *ngIf="isMediaApp()" 
                 (click)="fileInput.click()" 
                 (drop)="onDrop($event)" 
                 (dragover)="$event.preventDefault()">
              <input type="file" #fileInput (change)="onFile($event)" hidden>
              <div class="drop-zone-content">
                <div class="drop-icon-box" [class.file-ready]="selectedFile()">
                  {{ selectedFile() ? '✅' : '📤' }}
                </div>
                <div class="drop-text-main">{{ selectedFile() ? 'BUFFER_LOCKED' : 'DROP_SOURCE_IMAGE' }}</div>
                <div class="drop-text-sub">CLICK_TO_BROWSE_LOCAL_STORAGE</div>
              </div>
            </div>
          </div>

          <div class="visual-column">
            <div class="map-wrapper glass-inset" *ngIf="selectedApp() === 'exif_cleaner'">
              <div id="map"></div>
              <div class="map-coord-overlay">GEO_SYNC_ACTIVE</div>
            </div>
            
            <div class="face-preview-wrapper glass-inset" *ngIf="selectedApp() === 'face_cut' && previewUrl()">
              <img [src]="previewUrl()" alt="AI Face Preview" class="preview-img-element">
              <div class="preview-metadata-tag">LIVE_AI_CROP_3X4</div>
            </div>

            <div class="mrz-output-container glass-dark" *ngIf="mrzData()">
              <div class="mrz-header-label">REALTIME_MRZ_DUMP_STREAM</div>
              <div class="mrz-data-body">
                <div class="mrz-data-row">
                  <span class="mrz-tag">G2_ISO</span>
                  <code class="mrz-code">{{ mrzData().GEN_2_ISO }}</code>
                  <button class="copy-pill-btn" (click)="copy(mrzData().GEN_2_ISO)">CPY</button>
                </div>
                <div class="mrz-data-row">
                  <span class="mrz-tag">G1_LEG</span>
                  <code class="mrz-code">{{ mrzData().GEN_1_LEGACY }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer class="terminal-footer-action" *ngIf="selectedApp() !== 'ndls_mrz'">
          <button 
            [disabled]="engine.loading() || (requiresFile() && !selectedFile())" 
            (click)="fire()" 
            class="titan-execute-btn"
          >
            <span class="btn-text-main">> INITIATE_CORE_EXECUTION_SEQUENCE</span>
            <div class="btn-progress-bar" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    /* GLOBAL MATRIX RESET [cite: 2026-02-05] */
    :host { --m-green: #00ff41; --m-glow: rgba(0, 255, 65, 0.4); --bg: #000; --txt-sec: #555; --txt-pri: #fff; }
    
    .v-os-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px; position: relative; z-index: 10; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }

    /* ANIMATIONS [cite: 2026-03-16] */
    .fade-in { animation: fIn 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes fIn { from { opacity: 0; transform: translateY(15px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

    /* SYSTEM LOADER [cite: 2026-03-16] */
    .os-loader { position: fixed; inset: 0; background: rgba(0,0,0,0.92); backdrop-filter: blur(20px); z-index: 5000; display: flex; align-items: center; justify-content: center; }
    .spinner { width: 60px; height: 60px; border: 4px solid rgba(0,255,65,0.05); border-top-color: var(--m-green); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loader-text { margin-top: 30px; font-size: 0.7rem; color: var(--m-green); letter-spacing: 5px; font-weight: 900; }
    .loader-bar-bg { width: 200px; height: 2px; background: rgba(255,255,255,0.05); margin-top: 20px; border-radius: 2px; overflow: hidden; }
    .loader-bar-fill { width: 40%; height: 100%; background: var(--m-green); animation: load 2s ease-in-out infinite; }
    @keyframes load { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }

    /* GLASSMORPHISM ENGINE [cite: 2026-02-05] */
    .glass { background: rgba(10, 10, 10, 0.94); backdrop-filter: blur(120px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.1); }
    .glass-inset { background: rgba(20, 20, 20, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 2px 15px #000; }
    .glass-dark { background: #000; border: 1px solid var(--m-green); box-shadow: 0 0 30px rgba(0,255,65,0.1); }

    /* DYNAMIC ISLAND [cite: 2026-02-05] */
    .dynamic-island { padding: 10px 40px; border-radius: 60px; margin-bottom: 50px; box-shadow: 0 25px 60px #000; }
    .island-inner { display: flex; align-items: center; gap: 20px; font-size: 0.7rem; font-weight: 800; color: var(--txt-sec); letter-spacing: 2px; }
    .status-led { width: 10px; height: 10px; border-radius: 50%; background: var(--m-green); box-shadow: 0 0 15px var(--m-green); }
    .pulse { animation: p 2.5s infinite; } @keyframes p { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

    /* SPRINGBOARD [cite: 2026-02-21] */
    .springboard { width: 100%; max-width: 900px; display: flex; gap: 40px; }
    .folder-block { flex: 1; padding: 45px; border-radius: 50px; }
    .folder-header { display: flex; align-items: center; gap: 15px; margin-bottom: 40px; }
    .folder-tag { background: var(--m-green); color: #000; font-size: 0.55rem; font-weight: 900; padding: 3px 7px; border-radius: 4px; }
    .folder-name { font-size: 1rem; font-weight: 900; color: var(--txt-pri); letter-spacing: 4px; }
    .app-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .app-card { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .app-card:hover { transform: scale(1.15) translateY(-8px); }
    .app-icon-wrap { width: 100px; height: 100px; border-radius: 32px; display: flex; align-items: center; justify-content: center; font-size: 2.8rem; }
    .app-label { font-size: 0.85rem; font-weight: 900; color: var(--txt-sec); margin-top: 20px; }

    /* APP TERMINAL [cite: 2026-02-05, 2026-03-16] */
    .app-terminal { position: absolute; inset: 25px; padding: 50px; display: flex; flex-direction: column; border-radius: 50px; }
    .terminal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .back-btn { background: transparent; border: none; color: var(--txt-pri); font-weight: 900; font-size: 0.9rem; cursor: pointer; opacity: 0.4; transition: 0.3s; }
    .back-btn:hover { opacity: 1; color: var(--m-green); }
    .module-prefix { color: var(--txt-sec); font-size: 0.7rem; font-weight: 900; margin-right: 10px; }
    .module-name { color: var(--m-green); font-weight: 900; font-size: 1.8rem; letter-spacing: 6px; text-shadow: 0 0 25px var(--m-glow); }

    .mini-guide-bar { padding: 15px 35px; font-size: 0.75rem; color: #999; margin-bottom: 40px; border-radius: 25px; line-height: 1.6; }
    .guide-prefix { color: var(--m-green); font-weight: 900; margin-right: 15px; }

    .terminal-main-layout { display: flex; gap: 50px; flex: 1; min-height: 0; }
    .input-column, .visual-column { flex: 1; display: flex; flex-direction: column; gap: 35px; }
    .form-grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .field-label { font-size: 0.75rem; font-weight: 900; color: var(--txt-pri); margin-bottom: 12px; display: block; letter-spacing: 1.5px; }
    .field-input-container { padding: 20px 28px; border-radius: 20px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: var(--m-green); font-family: 'JetBrains Mono'; font-size: 1.15rem; font-weight: 800; }
    input::placeholder { color: #222; }

    /* VISUAL ELEMENTS [cite: 2026-03-16] */
    #map { flex: 1; border-radius: 35px; min-height: 400px; }
    .face-preview-wrapper { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; border-radius: 35px; }
    .preview-img-element { max-height: 100%; max-width: 100%; border-radius: 15px; box-shadow: 0 20px 60px #000; border: 1px solid rgba(255,255,255,0.1); }
    .preview-metadata-tag { position: absolute; bottom: 25px; right: 25px; font-size: 0.65rem; font-weight: 900; color: var(--m-green); background: #000; padding: 6px 12px; border: 1px solid var(--m-green); border-radius: 6px; }

    .mrz-output-container { padding: 50px; border-radius: 40px; display: flex; flex-direction: column; justify-content: center; }
    .mrz-header-label { font-size: 0.65rem; color: #444; margin-bottom: 25px; font-weight: 900; letter-spacing: 3px; }
    .mrz-data-row { display: flex; align-items: center; gap: 35px; margin-bottom: 22px; font-family: 'JetBrains Mono'; font-size: 1.35rem; }
    .mrz-tag { color: var(--m-green); font-weight: 900; font-size: 0.9rem; width: 80px; }
    .mrz-code { color: #fff; flex: 1; letter-spacing: 4px; }
    .copy-pill-btn { background: var(--m-green); color: #000; border: none; padding: 8px 20px; border-radius: 30px; font-size: 0.75rem; font-weight: 900; cursor: pointer; transition: 0.2s; }
    .copy-pill-btn:active { transform: scale(0.9); background: #fff; }

    .media-drop-zone { flex: 1; display: flex; align-items: center; justify-content: center; border: 3px dashed rgba(255,255,255,0.08); cursor: pointer; border-radius: 35px; transition: 0.4s; }
    .media-drop-zone:hover { border-color: var(--m-green); background: rgba(0,255,65,0.02); }
    .drop-icon-box { font-size: 3.5rem; margin-bottom: 20px; transition: 0.3s; }
    .file-ready { text-shadow: 0 0 20px var(--m-green); }
    .drop-text-main { font-size: 0.95rem; font-weight: 900; color: var(--txt-pri); letter-spacing: 3px; margin-bottom: 10px; }
    .drop-text-sub { font-size: 0.65rem; font-weight: 800; color: #333; letter-spacing: 1px; }

    .titan-execute-btn { width: 100%; padding: 35px; background: #fff; color: #000; border: none; border-radius: 35px; font-weight: 900; font-size: 1.4rem; letter-spacing: 5px; cursor: pointer; position: relative; overflow: hidden; margin-top: 40px; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
    .titan-execute-btn:hover:not(:disabled) { transform: translateY(-8px); box-shadow: 0 30px 70px rgba(0,0,0,0.6); }
    .titan-execute-btn:active { transform: scale(0.97); }
    .btn-progress-bar { position: absolute; bottom: 0; left: 0; height: 10px; background: var(--m-green); transition: 2.5s linear; }

    /* IOS SWITCH COMPONENT */
    .scan-toggle-ui { display: flex; align-items: center; gap: 15px; cursor: pointer; }
    .scan-toggle-ui input { display: none; }
    .toggle-slider { width: 50px; height: 28px; background: #1a1a1a; border-radius: 40px; position: relative; transition: 0.3s; border: 2px solid rgba(255,255,255,0.05); }
    .toggle-slider::after { content: ""; position: absolute; width: 22px; height: 22px; left: 2px; top: 1px; background: #333; border-radius: 50%; transition: 0.3s; }
    .toggle-slider.on { background: var(--m-green); border-color: var(--m-green); }
    .toggle-slider.on::after { transform: translateX(22px); background: #fff; }
    .toggle-label { font-size: 0.75rem; font-weight: 900; color: #444; letter-spacing: 1px; }

    .neon-green { color: #00ff41; text-shadow: 0 0 15px rgba(0,255,65,0.5); }
    .neon-blue { color: #007aff; text-shadow: 0 0 15px rgba(0,122,255,0.5); }
    .neon-amber { color: #ff9500; text-shadow: 0 0 15px rgba(255,149,0,0.5); }
    .neon-red { color: #ff3b30; text-shadow: 0 0 15px rgba(255,59,48,0.5); }
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
  previewUrl = signal<string | null>(null);
  
  memoryUsage = signal(128);
  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();
  private map: any;
  private marker: any;

  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

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
      'energia': 'Professional Irish Utility Bill Generator. Precision right-alignment logic for financial data. Scan mode injects Gaussian noise and rotation for biometric-grade evasion.',
      'ndls_mrz': 'Ireland NDLS Dual-Core MRZ Generator. Real-time checksum computation for GEN1 (Legacy) and GEN2 (ISO-18013) standards. Instant sink with input changes.',
      'exif_cleaner': 'Global Metadata Sniper. Injects OnePlus 6 (Sony IMX519) hardware signature. Select geographic coordinates on the dark-vector map to spoof geolocation.',
      'face_cut': 'AI Biometric Center Engine. Automatically detects face landmarks and crops to 3x4 aspect ratio. Adjust Zoom Factor and Vertical Shift with real-time preview sync.'
    };
    return map[this.selectedApp() || ''] || 'Awaiting Uplink...';
  }

  getAppTitle(): string {
    const map: any = { 'energia': 'IE_BILL_GEN_V57', 'ndls_mrz': 'IE_NDLS_MRZ_SYNC', 'exif_cleaner': 'EXIF_SNIPER_PRO', 'face_cut': 'FACE_BIO_CENTER' };
    return map[this.selectedApp() || ''] || 'CORE_SYSTEM_NODE';
  }

  isMediaApp() { return ['exif_cleaner', 'face_cut'].includes(this.selectedApp() || ''); }
  requiresFile() { return this.isMediaApp(); }
  
  openApp(n: string) { this.selectedApp.set(n); }
  
  closeApp() { 
    this.selectedApp.set(null); 
    this.selectedFile.set(null); 
    this.mrzData.set(null); 
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.previewUrl.set(null);
    this.map = null; 
    this.marker = null;
  }

  initMap() {
    if (this.map) return;
    this.map = L.map('map', { zoomControl: false }).setView([53.3498, -6.2603], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.map);
    
    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      if (this.marker) this.marker.setLatLng(e.latlng);
      else this.marker = L.marker(e.latlng).addTo(this.map);
      
      const currentLines = this.lines();
      currentLines[0] = lat.toFixed(6);
      currentLines[1] = lng.toFixed(6);
      this.lines.set([...currentLines]);
    });
  }

  onFile(e: any) { 
    const file = e.target.files[0];
    if (file) {
      this.selectedFile.set(file);
      if (this.selectedApp() === 'face_cut') this.updatePreview();
    }
  }
  
  onDrop(e: DragEvent) { 
    e.preventDefault(); 
    if (e.dataTransfer?.files.length) {
      this.selectedFile.set(e.dataTransfer.files[0]);
      if (this.selectedApp() === 'face_cut') this.updatePreview();
    }
  }

  onInputChange() {
    const app = this.selectedApp();
    if (app === 'ndls_mrz') {
      const fd = new FormData();
      fd.append('type', 'ndls_mrz');
      fd.append('lines', JSON.stringify(this.lines()));
      this.engine.execute(fd, true).subscribe(res => this.mrzData.set(res));
    }
    if (app === 'face_cut' && this.selectedFile()) this.updatePreview();
  }

  updatePreview() {
    const fd = new FormData();
    fd.append('type', 'face_cut');
    fd.append('lines', JSON.stringify(this.lines()));
    fd.append('file', this.selectedFile()!);
    this.engine.execute(fd, false).subscribe((res: Blob) => {
      if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
      this.previewUrl.set(URL.createObjectURL(res));
    });
  }

  fire() {
    const fd = new FormData();
    fd.append('type', this.selectedApp()!);
    fd.append('lines', JSON.stringify(this.lines()));
    fd.append('scan_mode', this.scanMode().toString());
    
    const file = this.selectedFile();
    if (file) fd.append('file', file);

    const isJson = this.selectedApp() === 'ndls_mrz';
    this.engine.execute(fd, isJson).subscribe((res: any) => {
      if (isJson) {
        this.mrzData.set(res);
      } else {
        const url = URL.createObjectURL(res);
        const a = document.createElement('a');
        a.href = url;
        const ext = this.isMediaApp() ? 'jpg' : 'pdf';
        a.download = `V_OS_RESULT_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  copy(text: string) { navigator.clipboard.writeText(text); }

  ngAfterViewInit() {
    this.initMatrix();
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (260 - 210) + 210)), 3000);
  }

  private initMatrix() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const chars = "01".split("");
    const drops = new Array(Math.floor(canvas.width / 18)).fill(1);
    
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41";
      ctx.font = "16px monospace";
      drops.forEach((y, i) => {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * 18, y * 18);
        if (y * 18 > canvas.height && Math.random() > 0.985) drops[i] = 0;
        drops[i]++;
      });
    };
    setInterval(draw, 50);
  }
}