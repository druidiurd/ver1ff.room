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
        <div class="loader-text">SYNCING_WITH_CORE...</div>
      </div>
    </div>

    <div class="v-os-container" [class.app-active]="selectedApp()">
      <div class="status-island glass fade-in">
        <span class="led pulse"></span>
        <span class="id-code">UPLINK_LIVE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
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
          <button (click)="closeApp()" class="esc">‹ ESC_TO_ROOT</button>
          <div class="t-module">{{ getAppTitle() }}</div>
          <div class="t-tools">
            <span class="f-info" *ngIf="selectedFile()">[FILE: {{ selectedFile()?.name }}]</span>
            <label class="scan-mode" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="slider" [class.on]="scanMode()"></span>
              <span class="txt">SCAN</span>
            </label>
          </div>
        </header>

        <div class="t-guide glass-inset">
          <span class="g-tag">MANUAL:</span> {{ getGuideText() }}
        </div>

        <div class="t-body">
          <div class="col-inputs">
            <div class="form-grid">
              @for (field of schema(); track field.id) {
                <div class="field">
                  <label>{{ field.label }}</label>
                  <div class="i-wrap glass-inset">
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

            <div class="drop-zone glass-inset" 
                 *ngIf="isMediaApp()" 
                 (click)="fIn.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
              <input type="file" #fIn (change)="onFile($event)" hidden>
              <div class="drop-info">
                <span class="icon">{{ selectedFile() ? '✅' : '📤' }}</span>
                <span class="label">{{ selectedFile() ? 'LOCKED_IN_BUFFER' : 'DROP_SOURCE_IMAGE' }}</span>
              </div>
            </div>
          </div>

          <div class="col-visuals">
            <div id="map" class="glass-inset" *ngIf="selectedApp() === 'exif_cleaner'"></div>
            
            <div class="preview-box glass-inset" *ngIf="selectedApp() === 'face_cut' && previewUrl()">
              <img [src]="previewUrl()" alt="AI Biometric Preview" class="face-img">
              <div class="p-tag">LIVE_AI_CROP_3X4</div>
            </div>

            <div class="mrz-output glass-dark" *ngIf="mrzData()">
              <div class="m-row"><span class="t">G2</span><code>{{ mrzData().GEN_2_ISO }}</code><button (click)="copy(mrzData().GEN_2_ISO)">CPY</button></div>
              <div class="m-row"><span class="t">G1</span><code>{{ mrzData().GEN_1_LEGACY }}</code></div>
            </div>
          </div>
        </div>

        <footer class="terminal-footer" *ngIf="selectedApp() !== 'ndls_mrz'">
          <button [disabled]="engine.loading() || (requiresFile() && !selectedFile())" (click)="fire()" class="exec-btn-titan">
            <span class="bt">> EXECUTE_CORE_SYNC</span>
            <div class="load-fill" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .fade-in { animation: fIn 0.4s ease-out; } @keyframes fIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .os-loader { position: fixed; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(20px); z-index: 2000; display: flex; align-items: center; justify-content: center; }
    .spinner { width: 45px; height: 45px; border: 3px solid rgba(0,255,65,0.05); border-top-color: #00ff41; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loader-text { margin-top: 25px; font-size: 0.65rem; color: #00ff41; letter-spacing: 4px; font-family: monospace; }

    .v-os-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px; position: relative; z-index: 10; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }
    
    .glass { background: rgba(10, 10, 10, 0.94); backdrop-filter: blur(120px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 45px; }
    .glass-inset { background: rgba(20, 20, 20, 0.9); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 25px; box-shadow: inset 0 2px 15px #000; }
    .glass-dark { background: #000; border: 1px solid #00ff41; border-radius: 35px; }

    .status-island { padding: 10px 35px; border-radius: 50px; margin-bottom: 50px; box-shadow: 0 20px 60px #000; display: flex; align-items: center; gap: 15px; }
    .led { width: 8px; height: 8px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 12px #00ff41; }
    .pulse { animation: p 2s infinite; } @keyframes p { 50% { opacity: 0.2; } }
    .id-code { font-size: 0.7rem; font-weight: 800; color: #555; letter-spacing: 1.5px; }

    .springboard { width: 100%; max-width: 850px; display: flex; gap: 40px; }
    .folder { flex: 1; padding: 40px; border-radius: 45px; border: 1px solid rgba(255,255,255,0.05); }
    .folder-title { font-size: 0.85rem; font-weight: 900; color: #444; text-align: center; letter-spacing: 4px; margin-bottom: 35px; }
    .app-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 35px; }
    .app-card { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.3s; }
    .app-card:hover { transform: scale(1.1) translateY(-5px); }
    .app-icon { width: 90px; height: 90px; border-radius: 28px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; border: 1px solid rgba(255, 255, 255, 0.08); }
    .app-label { font-size: 0.8rem; font-weight: 900; color: #666; margin-top: 18px; }

    .app-terminal { position: absolute; inset: 25px; padding: 50px; display: flex; flex-direction: column; }
    .t-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
    .esc { background: transparent; border: none; color: #fff; font-weight: 900; font-size: 0.9rem; cursor: pointer; opacity: 0.4; transition: 0.2s; }
    .esc:hover { opacity: 1; color: #00ff41; }
    .t-module { color: #00ff41; font-weight: 900; font-size: 1.6rem; letter-spacing: 5px; text-shadow: 0 0 20px rgba(0, 255, 65, 0.4); }

    .t-guide { padding: 15px 30px; font-size: 0.75rem; color: #888; margin-bottom: 35px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.02); }
    .g-tag { color: #00ff41; font-weight: 900; margin-right: 15px; }

    .t-body { display: flex; gap: 50px; flex: 1; min-height: 0; }
    .col-inputs, .col-visuals { flex: 1; display: flex; flex-direction: column; gap: 30px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .field label { font-size: 0.7rem; font-weight: 900; color: #fff; margin-bottom: 10px; display: block; letter-spacing: 1px; }
    .i-wrap { padding: 18px 25px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #00ff41; font-family: 'JetBrains Mono'; font-size: 1.1rem; font-weight: 700; }
    input::placeholder { color: #222; }

    .preview-box { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .face-img { max-height: 100%; max-width: 100%; border-radius: 12px; box-shadow: 0 15px 40px #000; border: 1px solid rgba(255,255,255,0.1); }
    .p-tag { position: absolute; bottom: 20px; right: 20px; font-size: 0.6rem; font-weight: 900; color: #00ff41; background: #000; padding: 4px 10px; border: 1px solid #00ff41; border-radius: 4px; }

    .mrz-output { padding: 45px; min-height: 220px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 0 30px rgba(0,255,65,0.1); }
    .m-row { display: flex; align-items: center; gap: 30px; margin-bottom: 18px; font-family: 'JetBrains Mono'; font-size: 1.2rem; }
    .t { color: #00ff41; font-weight: 900; font-size: 0.8rem; width: 50px; }
    code { color: #fff; flex: 1; letter-spacing: 3px; }
    
    #map { flex: 1; border-radius: 30px; min-height: 350px; }
    .drop-zone { flex: 1; display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(255,255,255,0.08); cursor: pointer; text-align: center; transition: 0.3s; }
    .drop-zone:hover { border-color: #00ff41; background: rgba(0,255,65,0.01); }
    .drop-info .icon { font-size: 3rem; display: block; margin-bottom: 15px; opacity: 0.6; }
    .drop-info .label { font-size: 0.8rem; font-weight: 900; color: #333; letter-spacing: 2px; }

    .exec-btn-titan { width: 100%; padding: 32px; background: #fff; color: #000; border: none; border-radius: 28px; font-weight: 900; font-size: 1.3rem; letter-spacing: 4px; cursor: pointer; position: relative; overflow: hidden; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
    .exec-btn-titan:hover:not(:disabled) { transform: translateY(-5px); box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
    .exec-btn-titan:active { transform: scale(0.98); }
    .load-fill { position: absolute; bottom: 0; left: 0; height: 8px; background: #00ff41; transition: 2.5s linear; }

    /* IOS SWITCH */
    .scan-mode { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .scan-mode input { display: none; }
    .slider { width: 40px; height: 22px; background: #1a1a1a; border-radius: 30px; position: relative; transition: 0.3s; border: 1px solid rgba(255,255,255,0.05); }
    .slider::after { content: ""; position: absolute; width: 18px; height: 18px; left: 2px; top: 1px; background: #333; border-radius: 50%; transition: 0.3s; }
    .slider.on { background: #00ff41; border-color: #00ff41; }
    .slider.on::after { transform: translateX(18px); background: #fff; }
    .txt { font-size: 0.65rem; font-weight: 900; color: #444; }
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
  private map: any; private marker: any;

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

  getAppTitle(): string {
    const map: any = { 'energia': 'IE_BILL_GEN_V57', 'ndls_mrz': 'IE_NDLS_MRZ_SYNC', 'exif_cleaner': 'EXIF_SNIPER_PRO', 'face_cut': 'FACE_BIO_CENTER' };
    return map[this.selectedApp() || ''] || 'CORE_SYSTEM';
  }

  getGuideText(): string {
    const map: any = {
      'energia': 'Auto-aligned Irish Utility Bill. Scan artifacts for deep-forensics.',
      'ndls_mrz': 'Dual-core MRZ generator. Updates instantly as you type.',
      'exif_cleaner': 'OnePlus 6 metadata injection. Pick coordinates on the dark map.',
      'face_cut': 'AI Face Detection + 3x4 Crop. Adjust Zoom and Shift for live results.'
    };
    return map[this.selectedApp() || ''] || 'Ready for uplink.';
  }

  isMediaApp() { return ['exif_cleaner', 'face_cut'].includes(this.selectedApp() || ''); }
  requiresFile() { return this.isMediaApp(); }
  openApp(n: string) { this.selectedApp.set(n); }
  
  closeApp() { 
    this.selectedApp.set(null); this.selectedFile.set(null); this.mrzData.set(null); 
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.previewUrl.set(null); this.map = null; 
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
    if (this.selectedApp() === 'face_cut') this.updatePreview();
  }
  
  onDrop(e: DragEvent) { 
    e.preventDefault(); 
    if (e.dataTransfer?.files.length) {
      this.selectedFile.set(e.dataTransfer.files[0]);
      if (this.selectedApp() === 'face_cut') this.updatePreview();
    }
  }

  onInputChange() {
    if (this.selectedApp() === 'ndls_mrz') {
      const fd = new FormData();
      fd.append('type', 'ndls_mrz');
      fd.append('lines', JSON.stringify(this.lines()));
      this.engine.execute(fd, true).subscribe(res => this.mrzData.set(res));
    }
    if (this.selectedApp() === 'face_cut' && this.selectedFile()) this.updatePreview();
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
    const canvas = this.canvasRef.nativeElement;
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
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (260 - 210) + 210)), 3000);
  }
}