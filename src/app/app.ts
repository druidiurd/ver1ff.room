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

    <div class="v-os-container" [class.app-active]="selectedApp()">
      
      <div class="dynamic-island glass">
        <div class="island-inner">
          <span class="status-led pulse"></span>
          <span class="status-id">UPLINK_STABLE // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
        </div>
      </div>

      <section class="springboard" *ngIf="!selectedApp()">
        
        <div class="folder-group">
          <div class="folder-header">
            <span class="tag">DIR</span>
            <h2 class="folder-name">IRELAND</h2>
          </div>
          <div class="app-grid">
            <div class="app-card glass" (click)="openApp('energia')">
              <div class="app-icon neon-green">⚡</div>
              <span class="app-label">IE-bill-gen</span>
            </div>
            <div class="app-card glass" (click)="openApp('ndls_mrz')">
              <div class="app-icon neon-blue">🆔</div>
              <span class="app-label">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="folder-group">
          <div class="folder-header">
            <span class="tag">SYS</span>
            <h2 class="folder-name">GLOBAL_TOOLS</h2>
          </div>
          <div class="app-grid">
            <div class="app-card glass" (click)="openApp('exif_cleaner')">
              <div class="app-icon neon-amber">📸</div>
              <span class="app-label">EXIF-Sniper</span>
            </div>
            <div class="app-card glass locked">
              <div class="app-icon">🛡️</div>
              <span class="app-label">PROXY_V3</span>
            </div>
          </div>
        </div>
      </section>

      <main class="app-terminal glass" *ngIf="selectedApp()">
        <header class="view-header">
          <button (click)="closeApp()" class="back-link">/root/dashboard</button>
          <div class="module-title">
            {{ selectedApp() === 'energia' ? 'IE-BILL-GEN' : 
               selectedApp() === 'ndls_mrz' ? 'IE-NDLS-MRZ' : 'EXIF-SNIPER' }}
          </div>
          <div class="header-tools">
            <div class="file-info" *ngIf="selectedFile()">[FILE: {{ selectedFile()?.name }}]</div>
            <label class="scan-toggle" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="slider" [class.active]="scanMode()"></span>
              <span class="txt">ARTIFACTS</span>
            </label>
          </div>
        </header>

        <div class="terminal-layout">
          <div class="form-column">
            <div class="form-grid">
              @for (field of schema(); track field.id) {
                <div class="field-node">
                  <label>{{ field.label }}</label>
                  <div class="field-wrap glass-inset">
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
                 *ngIf="selectedApp() === 'exif_cleaner'"
                 (click)="fileInput.click()" 
                 (drop)="onDrop($event)" 
                 (dragover)="$event.preventDefault()">
              <input type="file" #fileInput (change)="onFile($event)" hidden>
              <div class="drop-content">
                <span class="drop-icon">{{ selectedFile() ? '✅' : '📤' }}</span>
                <span class="drop-text">{{ selectedFile() ? 'IMAGE_LOCKED' : 'DROP_IMAGE_OR_CLICK' }}</span>
              </div>
            </div>
          </div>

          <div class="output-column">
            <div class="map-container glass-inset" *ngIf="selectedApp() === 'exif_cleaner'">
              <div id="map"></div>
              <div class="map-overlay">GEO_SYNC_ACTIVE</div>
            </div>

            <div class="mrz-dump glass-dark" *ngIf="mrzData()">
              <div class="console-label">>> MRZ_CORE_OUT</div>
              <div class="mrz-row">
                <span class="tag">[G2]</span>
                <code>{{ mrzData().GEN_2_ISO }}</code>
                <button (click)="copy(mrzData().GEN_2_ISO)" class="pill-btn">COPY</button>
              </div>
              <div class="mrz-row">
                <span class="tag">[G1]</span>
                <code>{{ mrzData().GEN_1_LEGACY }}</code>
              </div>
            </div>
          </div>
        </div>

        <footer class="view-footer">
          <button [disabled]="engine.loading() || (selectedApp()==='exif_cleaner' && !selectedFile())" 
                  (click)="fire()" 
                  class="exec-btn-primary">
            <span class="btn-txt">> {{ engine.loading() ? 'PROCCESSING_ENCRYPTION...' : 'EXECUTE_SYNC_COMMAND' }}</span>
            <div class="load-fill" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    /* UI CORE [cite: 2026-02-05] */
    .v-os-container { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 30px; position: relative; z-index: 10; font-family: 'Plus Jakarta Sans', sans-serif; }
    canvas#matrix { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }
    .glass { background: rgba(10, 10, 10, 0.9); backdrop-filter: blur(120px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 35px; }
    .glass-inset { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 20px; box-shadow: inset 0 2px 10px #000; }
    .glass-dark { background: #000; border: 1px solid var(--matrix-green); border-radius: 25px; }

    /* DYNAMIC ISLAND [cite: 2026-02-05] */
    .status-island { padding: 8px 25px; border-radius: 50px; margin-bottom: 40px; display: flex; align-items: center; gap: 15px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 15px 45px #000; }
    .led { width: 8px; height: 8px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 12px #00ff41; animation: pulse 2s infinite; }
    @keyframes pulse { 50% { opacity: 0.3; } }
    .id-code { font-size: 0.65rem; font-weight: 800; color: #444; letter-spacing: 1px; }

    /* SPRINGBOARD [cite: 2026-02-21] */
    .springboard { width: 100%; max-width: 800px; display: flex; flex-direction: column; gap: 60px; }
    .folder-header { display: flex; align-items: center; gap: 15px; margin-bottom: 30px; padding-left: 10px; }
    .tag { background: #00ff41; color: #000; font-size: 0.5rem; font-weight: 900; padding: 2px 5px; border-radius: 3px; }
    .folder-name { font-size: 1.1rem; font-weight: 900; letter-spacing: 2px; color: #fff; }
    .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 40px; }
    .app-card { display: flex; flex-direction: column; align-items: center; gap: 15px; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .app-card:hover { transform: scale(1.1) translateY(-5px); }
    .app-icon { width: 80px; height: 80px; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 2rem; border: 1px solid rgba(255, 255, 255, 0.1); }
    .app-label { font-size: 0.7rem; font-weight: 700; color: #555; }
    .locked { opacity: 0.15; cursor: not-allowed; }

    /* TERMINAL VIEW [cite: 2026-02-05] */
    .app-terminal { position: absolute; inset: 25px; padding: 45px; display: flex; flex-direction: column; z-index: 100; box-shadow: 0 0 100px #000; }
    .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 45px; }
    .back-link { background: transparent; border: none; color: #444; font-weight: 900; font-size: 0.8rem; cursor: pointer; }
    .module-title { color: #00ff41; font-weight: 900; font-size: 1.5rem; letter-spacing: 4px; text-shadow: 0 0 20px rgba(0, 255, 65, 0.3); }

    .terminal-layout { display: flex; gap: 40px; flex: 1; min-height: 0; }
    .form-column { flex: 1; display: flex; flex-direction: column; gap: 25px; }
    .output-column { flex: 1; display: flex; flex-direction: column; gap: 25px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .field-node label { font-size: 0.6rem; font-weight: 900; color: #444; margin-bottom: 8px; display: block; }
    .field-wrap { padding: 15px 20px; }
    input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: 'JetBrains Mono'; font-size: 1rem; }

    /* MAP & CONSOLE [cite: 2026-02-05] */
    #map { flex: 1; border-radius: 25px; min-height: 300px; }
    .mrz-dump { padding: 30px; }
    .tag { color: #00ff41; font-weight: 900; margin-right: 20px; }
    code { font-family: 'JetBrains Mono'; color: #fff; flex: 1; letter-spacing: 2px; }
    .pill-btn { background: #00ff41; color: #000; border: none; padding: 5px 15px; border-radius: 20px; font-size: 0.6rem; font-weight: 900; cursor: pointer; }

    .drop-zone { flex: 1; display: flex; align-items: center; justify-content: center; border: 2px dashed rgba(255,255,255,0.05); cursor: pointer; transition: 0.2s; }
    .drop-zone:hover { border-color: #00ff41; }
    .drop-content { text-align: center; }
    .drop-icon { font-size: 2.5rem; display: block; margin-bottom: 10px; }
    .drop-text { font-size: 0.7rem; font-weight: 900; color: #333; }

    .exec-btn-primary { width: 100%; padding: 28px; background: #fff; color: #000; border: none; border-radius: 20px; font-weight: 900; font-size: 1.1rem; letter-spacing: 2px; cursor: pointer; position: relative; overflow: hidden; }
    .load-fill { position: absolute; bottom: 0; left: 0; height: 5px; background: #00ff41; transition: 2.5s linear; }

    .scan-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .slider { width: 34px; height: 18px; background: #1a1a1a; border-radius: 20px; position: relative; transition: 0.3s; }
    .slider::after { content: ""; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; background: #333; border-radius: 50%; transition: 0.3s; }
    .slider.active { background: #00ff41; }
    .slider.active::after { transform: translateX(16px); background: #fff; }
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

  openApp(name: string) { this.selectedApp.set(name); }
  
  closeApp() { 
    this.selectedApp.set(null); 
    this.selectedFile.set(null);
    this.mrzData.set(null);
    this.map = null;
  }

  initMap() {
    if (this.map) return;
    // Dark Map Profile для Obsidian [cite: 2026-02-05]
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

  onFile(e: any) { this.selectedFile.set(e.target.files[0]); }
  
  onDrop(e: DragEvent) { 
    e.preventDefault(); 
    if (e.dataTransfer?.files.length) this.selectedFile.set(e.dataTransfer.files[0]); 
  }

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
    
    const file = this.selectedFile();
    if (file) fd.append('file', file);

    // Fix для рядка 286 в app.ts [cite: 2026-02-21]
    this.engine.uploadExecute(fd).subscribe((res: Blob) => {
      const url = URL.createObjectURL(res);
      const a = document.createElement('a');
      a.href = url;
      const ext = this.selectedApp() === 'exif_cleaner' ? 'jpg' : 'pdf';
      a.download = `V_OS_RESULT_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  copy(text: string) { navigator.clipboard.writeText(text); }

  ngAfterViewInit() {
    this.initMatrix();
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (220 - 180) + 180)), 2500);
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