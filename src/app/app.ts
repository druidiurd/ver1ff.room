import { Component, signal, inject, AfterViewInit, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EngineService } from './services/engine';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <canvas #matrixCanvas id="matrix"></canvas>

    <div class="os-wrapper" [class.app-active]="selectedApp()">
      <div class="dynamic-island glass">
        <div class="island-inner">
          <span class="status-led pulse"></span>
          <span class="status-id">V1_ROOM // NODE_{{ nodeId }} // RAM: {{ memoryUsage() }}MB</span>
        </div>
      </div>

      <section class="home-screen" *ngIf="!selectedApp()">
        <div class="folder-block">
          <div class="folder-header"><span class="folder-tag">DIR</span><h2 class="folder-name">IRELAND</h2></div>
          <div class="app-grid">
            <div class="app-card glass" (click)="openApp('energia')">
              <div class="app-icon neon-green">⚡</div><span class="app-label">IE-bill-gen</span>
            </div>
            <div class="app-card glass" (click)="openApp('ndls_mrz')">
              <div class="app-icon neon-blue">🆔</div><span class="app-label">IE-NDLS-MRZ</span>
            </div>
          </div>
        </div>

        <div class="folder-block">
          <div class="folder-header"><span class="folder-tag">SYS</span><h2 class="folder-name">GLOBAL_TOOLS</h2></div>
          <div class="app-grid">
            <div class="app-card glass" (click)="openApp('face_crop')">
              <div class="app-icon neon-cyan">✂️</div><span class="app-label">FACE_EXTRACT</span>
            </div>
          </div>
        </div>
      </section>

      <main class="app-view glass" *ngIf="selectedApp()">
        <header class="view-header">
          <button (click)="closeApp()" class="back-btn">ESC_EXIT</button>
          <div class="app-identity">
            <span class="module-name">{{ selectedApp()?.toUpperCase() }}</span>
          </div>
          <div class="view-tools">
            <label class="scan-switch" *ngIf="selectedApp() === 'energia'">
              <input type="checkbox" [ngModel]="scanMode()" (ngModelChange)="scanMode.set($event)">
              <span class="slider"></span><span class="label">ARTIFACTS</span>
            </label>
          </div>
        </header>

        <div class="split-workspace" *ngIf="selectedApp() !== 'face_crop'">
          <div class="form-column">
            @for (field of schema(); track field.id) {
              <div class="input-node-compact">
                <label>{{ field.label }}</label>
                <div class="field-wrap-compact">
                  <input [(ngModel)]="lines()[$index]" (ngModelChange)="onInputChange()" [placeholder]="field.p" spellcheck="false" autocomplete="off">
                </div>
              </div>
            }
          </div>

          <div class="manual-column glass-dark">
            <div class="manual-header">>> OPERATIONAL_MANUAL</div>
            <div class="manual-content" *ngIf="selectedApp() === 'energia'">
              <p><span class="hlt">[+]</span> <strong>PREMISES_BLOCK:</strong> Автоматично збирається з рядків 2, 3 та 6.</p>
              <p><span class="hlt">[+]</span> <strong>RIGHT_ALIGN:</strong> Фінанси автоматично калібруються по правому краю ROI.</p>
              <p><span class="hlt">[!]</span> <strong>EIRCODE:</strong> Використовуй валідні індекси D12/D15 для антифроду.</p>
              <div class="sys-ready">AES_256_READY</div>
            </div>
            <div class="manual-content" *ngIf="selectedApp() === 'ndls_mrz'">
              <p><span class="hlt">[+]</span> <strong>GEN_2_ISO:</strong> 30 байт, стандарт ISO-18013.</p>
              <p><span class="hlt">[+]</span> <strong>GEN_1_LEGACY:</strong> 31 байт, старий формат.</p>
              <p><span class="hlt">[!]</span> <strong>CHECKSUM:</strong> Векторний розрахунок (7-3-1) без циклів (Numpy Array).</p>
              <div class="sys-ready">NATIVE_ENGINE_ACTIVE</div>
            </div>
          </div>
        </div>

        <div class="face-crop-container" *ngIf="selectedApp() === 'face_crop'">
          <div class="crop-workspace">
            <div class="dnd-zone glass-dark" [class.drag-over]="isDragging()" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
              <span class="dnd-text" *ngIf="!faceSource()">DRAG_DROP_IMAGE_HERE</span>
              <img *ngIf="faceSource()" [src]="faceSource()" class="img-preview">
            </div>
            <div class="result-zone glass-dark">
              <div class="zone-label">>> EXTRACTED_FACE (3:4)</div>
              <div class="result-box">
                <img *ngIf="faceResult()" [src]="faceResult()" class="img-result">
                <span class="err-txt" *ngIf="faceError()">{{ faceError() }}</span>
                <span class="wait-txt" *ngIf="!faceResult() && !faceError()">AWAITING_BUFFER...</span>
              </div>
            </div>
          </div>
          <div class="slider-control glass-dark" *ngIf="faceSource()">
            <label>CROP_PADDING_REDUCE_PX: {{ facePadding() }}</label>
            <input type="range" min="-50" max="100" step="5" [ngModel]="facePadding()" (ngModelChange)="onPaddingChange($event)" class="cyber-slider">
          </div>
        </div>

        <div class="console-output glass-dark" *ngIf="mrzData() && selectedApp() === 'ndls_mrz'">
          <div class="row"><span class="tag">G2</span> <code>{{ mrzData().GEN_2_ISO }}</code> <button (click)="copy(mrzData().GEN_2_ISO)" class="copy-btn">CPY</button></div>
          <div class="row"><span class="tag">G1</span> <code>{{ mrzData().GEN_1_LEGACY }}</code></div>
        </div>

        <footer class="view-footer" *ngIf="selectedApp() === 'energia'">
          <button [disabled]="engine.loading()" (click)="fire()" class="primary-btn">
            <span class="btn-txt">> {{ engine.loading() ? 'PROCCESSING_ENCRYPTION...' : 'EXECUTE_SYNC_COMMAND' }}</span>
            <div class="load-fill" [style.width.%]="engine.loading() ? 100 : 0"></div>
          </button>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    .os-wrapper { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px; z-index: 10; position: relative; }
    .glass { background: rgba(10,10,10,0.85); backdrop-filter: blur(120px) saturate(180%); border: 1px solid rgba(255,255,255,0.08); border-radius: 30px; }
    .glass-dark { background: #000; border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; }

    .dynamic-island { padding: 8px 25px; border-radius: 50px; margin-bottom: 50px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    .island-inner { display: flex; align-items: center; gap: 15px; font-size: 0.65rem; font-weight: 800; color: #444; letter-spacing: 1px; }
    .status-led { width: 8px; height: 8px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 10px #00ff41; }
    .pulse { animation: pulse 2s infinite; }
    @keyframes pulse { 50% { opacity: 0.2; } }

    .home-screen { width: 100%; max-width: 800px; display: flex; flex-direction: column; gap: 60px; }
    .folder-header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; padding-left: 10px; }
    .folder-tag { background: #00ff41; color: #000; font-size: 0.5rem; font-weight: 900; padding: 2px 5px; border-radius: 3px; }
    .folder-name { font-size: 1.1rem; font-weight: 900; letter-spacing: 2px; }
    .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 35px; }
    .app-card { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .app-card:hover { transform: scale(1.1) translateY(-5px); border-color: #00ff41; box-shadow: 0 0 30px rgba(0,255,65,0.4); }
    .app-icon { font-size: 2rem; }
    .neon-cyan { text-shadow: 0 0 15px cyan; }
    .app-label { font-size: 0.7rem; font-weight: 700; color: #666; text-align: center; }

    /* APP VIEW - Виправлена висота і overflow */
    .app-view { position: absolute; inset: 20px; padding: 40px; display: flex; flex-direction: column; box-shadow: 0 0 100px #000; z-index: 100; border-radius: 40px; overflow: hidden; }
    .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-shrink: 0; }
    .back-btn { background: transparent; border: none; color: #666; font-weight: 800; font-size: 0.8rem; cursor: pointer; }
    .module-name { color: #00ff41; font-weight: 900; font-size: 1.4rem; letter-spacing: 3px; text-shadow: 0 0 15px rgba(0,255,65,0.4); }

    /* SPLIT WORKSPACE */
    .split-workspace { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; flex: 1; overflow-y: auto; padding-right: 15px; min-height: 0; }
    .form-column { display: flex; flex-direction: column; gap: 15px; }
    .input-node-compact label { font-size: 0.6rem; font-weight: 900; color: #666; margin-bottom: 6px; display: block; letter-spacing: 1px; }
    
    /* КОНТРАСТ ІНПУТІВ [cite: 2026-02-05] */
    .field-wrap-compact { padding: 12px 18px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); transition: 0.3s; }
    .field-wrap-compact:focus-within { border-color: #00ff41; background: rgba(0, 255, 65, 0.08); box-shadow: 0 0 15px rgba(0, 255, 65, 0.15); }
    .field-wrap-compact input { width: 100%; background: transparent; border: none; outline: none; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; }
    .field-wrap-compact input::placeholder { color: #888; }

    .manual-column { padding: 25px; display: flex; flex-direction: column; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15); }
    .manual-header { font-size: 0.7rem; color: #00ff41; font-weight: 900; margin-bottom: 20px; letter-spacing: 2px; }
    .manual-content p { font-size: 0.7rem; color: #aaa; margin-bottom: 15px; line-height: 1.5; font-family: 'JetBrains Mono', monospace; }
    .hlt { color: #00ff41; font-weight: 900; }
    .sys-ready { margin-top: auto; font-size: 0.6rem; color: #444; font-weight: 900; letter-spacing: 2px; text-align: right; }

    /* FACE CROP STYLES - Фікс висоти [cite: 2026-02-05] */
    .face-crop-container { flex: 1; display: flex; flex-direction: column; gap: 15px; min-height: 0; }
    .crop-workspace { display: flex; gap: 20px; flex: 1; min-height: 0; }
    .dnd-zone { flex: 1; border-radius: 20px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px dashed rgba(255,255,255,0.2); transition: 0.3s; position: relative; }
    .dnd-zone.drag-over { border-color: #00ff41; background: rgba(0, 255, 65, 0.05); }
    .dnd-text { font-weight: 900; color: #666; letter-spacing: 2px; }
    .img-preview { width: 100%; height: 100%; object-fit: contain; }
    .result-zone { width: 300px; padding: 15px; display: flex; flex-direction: column; }
    .zone-label { font-size: 0.6rem; color: #00ff41; font-weight: 900; margin-bottom: 15px; }
    .result-box { flex: 1; display: flex; align-items: center; justify-content: center; background: #050505; border-radius: 10px; overflow: hidden; border: 1px solid #222; }
    .img-result { max-width: 100%; max-height: 100%; object-fit: contain; }
    .wait-txt { font-size: 0.7rem; color: #333; font-weight: 800; }
    .err-txt { font-size: 0.7rem; color: #ff003c; font-weight: 900; text-align: center; padding: 10px; }
    
    .slider-control { padding: 15px; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.15); }
    .slider-control label { font-size: 0.7rem; font-weight: 900; color: #00ff41; }
    .cyber-slider { -webkit-appearance: none; width: 100%; background: transparent; }
    .cyber-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #00ff41; cursor: pointer; box-shadow: 0 0 10px #00ff41; margin-top: -8px; }
    .cyber-slider::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #222; border-radius: 2px; }

    .console-output { background: #000; padding: 20px; margin-top: 15px; border: 1px solid rgba(255,255,255,0.15); border-radius: 15px; flex-shrink: 0; }
    .row { display: flex; align-items: center; margin-bottom: 10px; }
    .tag { color: #00ff41; font-weight: 900; margin-right: 20px; font-size: 0.8rem;}
    code { font-family: 'JetBrains Mono', monospace; font-size: 1rem; color: #fff; flex: 1; letter-spacing: 2px; }
    .copy-btn { background: #00ff41; color: #000; border: none; padding: 4px 12px; border-radius: 20px; font-size: 0.6rem; font-weight: 900; cursor: pointer; }

    .view-footer { padding-top: 20px; flex-shrink: 0; }
    .primary-btn { width: 100%; padding: 25px; background: transparent; color: #00ff41; border: 1px solid #00ff41; border-radius: 20px; font-weight: 900; font-size: 1.1rem; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; transition: 0.3s; }
    .primary-btn:hover:not(:disabled) { background: #00ff41; color: #000; box-shadow: 0 0 30px rgba(0,255,65,0.4); }
    .load-fill { position: absolute; bottom: 0; left: 0; height: 5px; background: #fff; transition: 2s linear; }

    .scan-switch { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .scan-switch input { display: none; }
    .slider { width: 38px; height: 20px; background: #222; border-radius: 30px; position: relative; transition: 0.3s; border: 1px solid rgba(255,255,255,0.2); }
    .slider::after { content: ""; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: 0.3s; }
    input:checked + .slider { background: #00ff41; border-color: #00ff41; }
    input:checked + .slider::after { transform: translateX(18px); }
  `]
})
export class App implements AfterViewInit {
  engine = inject(EngineService);
  selectedApp = signal<string | null>(null);
  schema = signal<any[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal(false);
  mrzData = signal<any>(null);
  memoryUsage = signal(128);
  nodeId = Math.random().toString(16).substring(2, 8).toUpperCase();

  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  isDragging = signal(false);
  faceSource = signal<string | null>(null);
  faceResult = signal<string | null>(null);
  faceError = signal<string | null>(null);
  facePadding = signal(20);

  constructor() {
    effect(() => {
      if (this.selectedApp() && this.selectedApp() !== 'face_crop') {
        this.engine.getSchema(this.selectedApp()!).subscribe(s => {
          this.schema.set(s);
          this.lines.set(new Array(s.length).fill(''));
          this.mrzData.set(null);
        });
      }
    }, { allowSignalWrites: true });
  }

  openApp(name: string) { 
    this.selectedApp.set(name); 
    if (name === 'face_crop') {
      this.faceSource.set(null);
      this.faceResult.set(null);
      this.faceError.set(null);
    }
  }
  closeApp() { this.selectedApp.set(null); }

  onInputChange() {
    if (this.selectedApp() === 'ndls_mrz') {
      this.engine.execute(this.selectedApp()!, this.lines(), false).subscribe(res => this.mrzData.set(res));
    }
  }

  fire() {
    this.engine.execute(this.selectedApp()!, this.lines(), this.scanMode()).subscribe(res => {
      if (this.selectedApp() === 'ndls_mrz') this.mrzData.set(res);
      else {
        const blob = new Blob([res], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `V_SYNC_EXTRACT_${Date.now()}.pdf`; a.click();
      }
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging.set(false); }
  
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const b64 = ev.target?.result as string;
          this.faceSource.set(b64);
          this.triggerFaceCrop();
        };
        reader.readAsDataURL(file);
      }
    }
  }

  onPaddingChange(newVal: number) {
    this.facePadding.set(newVal);
    this.triggerFaceCrop();
  }

  triggerFaceCrop() {
    if (!this.faceSource()) return;
    this.faceError.set(null);
    this.engine.processFace(this.faceSource()!, this.facePadding()).subscribe(res => {
      if (res.error) {
        this.faceError.set(res.error);
        this.faceResult.set(null);
      } else {
        this.faceResult.set(res.cropped);
      }
    });
  }

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
    setInterval(() => this.memoryUsage.set(Math.floor(Math.random() * (220 - 180) + 180)), 3000);
  }
}