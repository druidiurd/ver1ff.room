import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../store';
import { MapComponent } from './map';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent],
  template: `
    <main class="terminal-shell fade-in">
      <header class="t-header">
        <button (click)="store.closeApp()" class="esc-btn">‹ EXIT_TO_ROOT</button>
        <div class="t-module">NODE::{{ getAppTitle() }}</div>
        <div class="t-tools">
          <label class="scan-ui" *ngIf="store.selectedApp() === 'energia'">
            <input type="checkbox" [ngModel]="store.scanMode()" (ngModelChange)="store.scanMode.set($event)">
            <span class="slider" [class.on]="store.scanMode()"></span><span class="txt">ARTIFACTS</span>
          </label>
        </div>
      </header>

      <div class="mini-guide-bar glass-inset">
        <span class="guide-prefix">SYSTEM_MANUAL:</span>
        <span class="guide-text">{{ getGuideText() }}</span>
      </div>

      <div class="t-layout">
        <div class="col-form">
          <div class="form-grid">
            @for (field of store.schema(); track field.id) {
              <div class="field-box">
                <label>{{ field.label }}</label>
                <div class="input-bg" [class.range-bg]="field.type === 'range'">
                  <ng-container *ngIf="!field.type || field.type === 'text'">
                    <input [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()" [placeholder]="field.p" autocomplete="off" spellcheck="false">
                  </ng-container>
                  <ng-container *ngIf="field.type === 'select'">
                    <select class="custom-select" [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()">
                      <option value="" disabled>{{ field.p }}</option>
                      <option *ngFor="let opt of field.opts" [value]="opt">{{ opt }}</option>
                    </select>
                  </ng-container>
                  <ng-container *ngIf="field.type === 'range'">
                    <div class="range-wrap">
                      <input type="range" class="custom-range" [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()" [min]="field.min" [max]="field.max">
                      <span class="range-val">{{ store.lines()[$index] || field.p }}</span>
                    </div>
                  </ng-container>
                </div>
              </div>
            }
          </div>

          <div class="drop-zone" *ngIf="store.isMediaApp()" (click)="fi.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
            <input type="file" #fi (change)="onFile($event)" [multiple]="store.selectedApp() === 'ai_bypass'" hidden>
            <ng-container *ngIf="store.selectedApp() !== 'ai_bypass'">
              <div class="d-icon" [class.locked]="store.selectedFile()">{{ store.selectedFile() ? '✅' : '📤' }}</div>
              <div class="d-text">{{ store.selectedFile() ? 'BUFFER_LOCKED' : 'DROP_SOURCE_MEDIA' }}</div>
            </ng-container>
            <ng-container *ngIf="store.selectedApp() === 'ai_bypass'">
              <div class="d-icon" [class.locked]="store.batchFiles().length > 0">{{ store.batchFiles().length > 0 ? '✅' : '📦' }}</div>
              <div class="d-text">{{ store.batchFiles().length > 0 ? store.batchFiles().length + ' FILES_BUFFERED' : 'DROP_UP_TO_5_FILES' }}</div>
            </ng-container>
          </div>
        </div>

        <div class="col-visuals">
          <app-map *ngIf="store.selectedApp() === 'exif_cleaner'"></app-map>

          <div class="preview-box" *ngIf="store.hasPreview()">
            <img *ngIf="store.previewUrl()" [src]="store.previewUrl()" class="pv-img">
            <span *ngIf="!store.previewUrl()" class="pv-empty">AWAITING_SOURCE...</span>
          </div>

          <div class="mrz-box" *ngIf="store.selectedApp() === 'ndls_mrz' && store.mrzData()">
            <div class="m-row"><span class="tag">G2</span><code>{{ store.mrzData().GEN_2_ISO }}</code><button (click)="copy(store.mrzData().GEN_2_ISO)">CPY</button></div>
            <div class="m-row"><span class="tag">G1</span><code>{{ store.mrzData().GEN_1_LEGACY }}</code></div>
          </div>

          <div class="mrz-box td1-box" *ngIf="store.selectedApp() === 'nld_mrz' && store.mrzData()">
            <div class="m-row">
              <span class="tag">L1</span><code>{{ store.mrzData().L1 }}</code>
              <button class="multi-cpy" (click)="copy(store.mrzData().L1 + '\n' + store.mrzData().L2 + '\n' + store.mrzData().L3)">CPY_ALL</button>
            </div>
            <div class="m-row"><span class="tag">L2</span><code>{{ store.mrzData().L2 }}</code></div>
            <div class="m-row"><span class="tag">L3</span><code>{{ store.mrzData().L3 }}</code></div>
          </div>

          <div class="mrz-box td1-box" *ngIf="store.selectedApp() === 'fra_mrz' && store.mrzData()">
            <ng-container *ngIf="store.mrzData().STATUS === 'SYNC_OK'">
              <div class="m-row">
                <span class="tag">L1</span><code>{{ store.mrzData().L1 }}</code>
                <button class="multi-cpy" (click)="copy(store.mrzData().L1 + '\n' + store.mrzData().L2)">CPY_ALL</button>
              </div>
              <div class="m-row"><span class="tag">L2</span><code>{{ store.mrzData().L2 }}</code></div>
            </ng-container>
            
            <ng-container *ngIf="store.mrzData().STATUS === 'VALIDATION_ERR'">
              <div class="m-row"><span class="tag err">ERR</span><code class="err">{{ store.mrzData().ERR_MSG }}</code></div>
            </ng-container>
          </div>

          <div class="batch-container" *ngIf="store.selectedApp() === 'ai_bypass' && store.batchFiles().length > 0">
            <div class="batch-item" *ngFor="let f of store.batchFiles(); let i = index">
              <div class="side orig-side glass-inset">
                <span class="s-tag">ORIGINAL</span>
                <img [src]="store.batchUrls()[i]" class="s-img">
              </div>
              <div class="side res-side glass-dark">
                <span class="s-tag">PROCESSED</span>
                <ng-container *ngIf="store.bypassResults()[i] as res; else loadingTpl">
                  <ng-container *ngIf="res.STATUS !== 'ERROR' && res.STATUS !== 'ALL_NODES_DEAD'">
                    <img [src]="'data:image/jpeg;base64,' + res.IMAGE_BASE64" class="s-img">
                    <div class="res-stats">
                      <span class="r-prob" [class.safe]="isSafe(res)" [class.danger]="!isSafe(res)">
                        {{ res.TYPE === 'ai_batch' ? res.BEST_SCORE : res.AI_PROBABILITY }}
                      </span>
                      <span class="r-node">[{{ res.USED_PROFILE }}]</span>
                      <button class="dl-btn" (click)="download(res.IMAGE_BASE64, f.name)">DL</button>
                    </div>
                  </ng-container>
                  <ng-container *ngIf="res.STATUS === 'ERROR' || res.STATUS === 'ALL_NODES_DEAD'">
                    <span class="pv-empty error">NODES_DEPLETED</span>
                  </ng-container>
                </ng-container>
                <ng-template #loadingTpl>
                  <span class="pv-empty" *ngIf="store.loading()">PROCESSING...</span>
                  <span class="pv-empty" *ngIf="!store.loading()">AWAITING_CMD</span>
                </ng-template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer *ngIf="!['ndls_mrz', 'nld_mrz', 'fra_mrz'].includes(store.selectedApp() || '')">
        <div class="action-grid" [class.dual]="store.selectedApp() === 'ai_bypass'">
          <button [disabled]="store.loading() || !canExecute()" (click)="execute(false)" class="exec-btn">
            > {{ store.selectedApp() === 'ai_bypass' ? 'TEST_CURRENT_QUALITY' : 'INITIATE_CORE_SEQUENCE' }}
            <div class="bar" [style.width.%]="store.loading() ? 100 : 0"></div>
          </button>
          <button *ngIf="store.selectedApp() === 'ai_bypass'" [disabled]="store.loading() || !canExecute()" (click)="execute(true)" class="exec-btn stealth-btn">
            > AUTO-FIND_BEST_COMPRESSION
            <div class="bar" [style.width.%]="store.loading() ? 100 : 0"></div>
          </button>
        </div>
      </footer>
    </main>
  `,
  styles: [`
    .fade-in { animation: fIn 0.4s ease-out; } @keyframes fIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
    .terminal-shell { background: rgba(10,10,10,0.95); backdrop-filter: blur(80px); border: 1px solid rgba(255,255,255,0.1); border-radius: 45px; padding: 50px; display: flex; flex-direction: column; width: 100%; max-width: 1300px; box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
    
    .t-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .esc-btn { background: transparent; border: none; color: #666; font-weight: 900; cursor: pointer; transition: 0.2s; }
    .esc-btn:hover { color: #00ff41; }
    .t-module { color: #00ff41; font-size: 1.8rem; font-weight: 900; letter-spacing: 5px; text-shadow: 0 0 20px rgba(0,255,65,0.4); }

    .mini-guide-bar { padding: 18px 40px; font-size: 0.8rem; color: #888; margin-bottom: 40px; border-radius: 25px; background: rgba(20, 20, 20, 0.95); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 3px 20px #000; }
    .guide-prefix { color: #00ff41; font-weight: 900; margin-right: 15px; }

    .t-layout { display: flex; gap: 50px; flex: 1; min-height: 0; }
    .col-form { flex: 0.8; display: flex; flex-direction: column; gap: 30px; }
    .col-visuals { flex: 1.2; display: flex; flex-direction: column; gap: 30px; min-height: 400px; overflow-y: auto; padding-right: 10px; }
    .col-visuals::-webkit-scrollbar { width: 8px; } .col-visuals::-webkit-scrollbar-thumb { background: rgba(0,255,65,0.3); border-radius: 10px; }
    
    .form-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    .field-box label { display: block; font-size: 0.65rem; font-weight: 900; color: #fff; margin-bottom: 8px; letter-spacing: 1px; }
    .input-bg { background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); padding: 15px 20px; border-radius: 20px; }
    .range-bg { padding: 10px 20px; }
    
    input, .custom-select { width: 100%; background: transparent; border: none; color: #00ff41; font-family: 'JetBrains Mono'; font-size: 1.1rem; font-weight: 700; outline: none; appearance: none; }
    .custom-select option { background: #111; color: #00ff41; }
    
    .range-wrap { display: flex; align-items: center; gap: 12px; }
    .custom-range { flex: 1; cursor: pointer; accent-color: #00ff41; }
    .range-val { color: #fff; font-weight: 900; font-family: 'JetBrains Mono'; width: 35px; text-align: right; font-size: 0.9rem; }

    .drop-zone { flex: 1; border: 3px dashed rgba(255,255,255,0.1); border-radius: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; min-height: 120px; }
    .drop-zone:hover { border-color: #00ff41; background: rgba(0,255,65,0.02); }
    .d-icon { font-size: 3rem; margin-bottom: 15px; opacity: 0.5; }
    .d-icon.locked { opacity: 1; text-shadow: 0 0 20px #00ff41; }
    .d-text { font-weight: 900; color: #fff; letter-spacing: 2px; }

    .preview-box { flex: 1; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .pv-img { max-width: 100%; max-height: 100%; border-radius: 15px; }
    .pv-empty { font-weight: 900; color: #444; letter-spacing: 4px; font-size: 0.8rem; }
    .pv-empty.error { color: #ff3b30; }

    .mrz-box { background: #000; border: 1px solid #00ff41; padding: 30px 40px; border-radius: 30px; }
    .td1-box { border-color: #ff9500; }
    .td1-box .tag { color: #ff9500; }
    .tag.err { color: #ff3b30; }
    code.err { color: #ff3b30; }
    .m-row { display: flex; align-items: center; gap: 30px; margin-bottom: 15px; font-family: 'JetBrains Mono'; font-size: 1.1rem; }
    .tag { color: #00ff41; font-weight: 900; font-size: 0.8rem; width: 25px; }
    code { color: #fff; flex: 1; letter-spacing: 4px; }
    button { background: #00ff41; border: none; padding: 8px 20px; border-radius: 20px; font-weight: 900; cursor: pointer; }
    .multi-cpy { background: #ff9500; }

    .batch-container { display: flex; flex-direction: column; gap: 20px; }
    .batch-item { display: flex; gap: 15px; height: 180px; }
    .side { flex: 1; border-radius: 20px; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
    .glass-inset { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); }
    .glass-dark { background: #000; border: 1px solid #a855f7; box-shadow: 0 0 20px rgba(168,85,247,0.1); }
    .s-tag { position: absolute; top: 10px; left: 10px; font-size: 0.5rem; font-weight: 900; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 5px; color: #fff; z-index: 2; }
    .glass-dark .s-tag { color: #a855f7; }
    .s-img { width: 100%; height: 100%; object-fit: contain; z-index: 1; }
    
    .res-stats { position: absolute; bottom: 10px; width: 90%; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.85); padding: 5px 10px; border-radius: 10px; z-index: 2; border: 1px solid rgba(168,85,247,0.3); }
    .r-prob { font-family: 'JetBrains Mono'; font-weight: 900; font-size: 1.1rem; }
    .r-prob.safe { color: #00ff41; } .r-prob.danger { color: #ff3b30; }
    .r-node { font-size: 0.55rem; color: #a855f7; font-weight: 900; letter-spacing: 1px; }
    .dl-btn { background: #a855f7; color: #fff; padding: 5px 15px; font-size: 0.7rem; }

    .action-grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 40px; }
    .action-grid.dual { grid-template-columns: 1fr 1fr; }
    .exec-btn { width: 100%; padding: 30px; background: #fff; color: #000; border: none; border-radius: 30px; font-size: 1.1rem; font-weight: 900; letter-spacing: 3px; cursor: pointer; position: relative; overflow: hidden; }
    .stealth-btn { background: transparent; border: 2px solid #a855f7; color: #a855f7; }
    .stealth-btn:hover:not(:disabled) { background: rgba(168,85,247,0.1); }
    .bar { position: absolute; bottom: 0; left: 0; height: 8px; background: #00ff41; transition: 2s; }
    .stealth-btn .bar { background: #a855f7; }

    .scan-ui { display: flex; align-items: center; gap: 15px; cursor: pointer; }
    .scan-ui input { display: none; }
    .slider { width: 40px; height: 22px; background: #222; border-radius: 20px; position: relative; transition: 0.3s; }
    .slider::after { content: ""; position: absolute; height: 16px; width: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: 0.3s; }
    .slider.on { background: #00ff41; }
    .slider.on::after { transform: translateX(18px); background: #000; }
    .txt { font-weight: 900; color: #fff; letter-spacing: 2px; font-size: 0.8rem; }
  `]
})
export class TerminalComponent {
  store = inject(AppStore);

  getAppTitle(): string {
    const map: any = { 
      'energia': 'IE_BILL_GEN_V57_PRO', 
      'ndls_mrz': 'IE_MRZ_SYNC_NODE', 
      'nld_mrz': 'NL_MRZ_SYNC_NODE',
      'fra_mrz': 'FR_CNI_SYNC_NODE',
      'exif_cleaner': 'EXIF_SNIPER_HW', 
      'face_cut': 'FACE_VISION_V12',
      'ai_bypass': 'AI_STEALTH_V3' 
    };
    return map[this.store.selectedApp() || ''] || 'CORE_SYSTEM_DASH';
  }

  getGuideText(): string {
    const map: any = {
      'energia': 'Professional Irish Utility Bill Generator. Auto-right-alignment. Scan mode injects Gaussian noise and biometric artifacts.',
      'ndls_mrz': 'Real-time dual-core MRZ generator. Synchronized checksums for GEN1 and GEN2 standards. Reactive input sink.',
      'nld_mrz': 'Netherlands ID MRZ Generator (TD1). Vectorized ICAO-9303 math.',
      'fra_mrz': 'France CNI MRZ Generator. Validates Department Code and CIN synchronously.',
      'exif_cleaner': 'Metadata Hardware Injector for OnePlus 6. Select target coordinates on map to spoof hardware location.',
      'face_cut': 'AI Biometric Extractor. 3x4 aspect ratio. Adjust Zoom and Vertical Sink manually for live preview results.',
      'ai_bypass': 'Forensic Evader. Applies Chromatic Aberrations, Noise, and iPhone EXIF to bypass AI Detection APIs. Auto-routes between 10 API nodes.'
    };
    return map[this.store.selectedApp() || ''] || 'System operational. Ready...';
  }

  onFile(e: any) { this.handleFiles(e.target.files); }
  onDrop(e: DragEvent) { e.preventDefault(); if (e.dataTransfer?.files.length) this.handleFiles(e.dataTransfer.files); }

  handleFiles(filesList: FileList) {
    if (this.store.selectedApp() === 'ai_bypass') {
      const files = Array.from(filesList).slice(0, 5) as File[];
      this.store.batchUrls().forEach(url => URL.revokeObjectURL(url));
      this.store.batchFiles.set(files);
      this.store.batchUrls.set(files.map(f => URL.createObjectURL(f)));
      this.store.bypassResults.set([]);
    } else {
      const f = filesList[0];
      if (f) { this.store.selectedFile.set(f); if (this.store.hasPreview()) this.reqPreview(); }
    }
  }

  canExecute() {
    if (this.store.selectedApp() === 'ai_bypass') return this.store.batchFiles().length > 0;
    if (this.store.requiresFile()) return !!this.store.selectedFile();
    return true;
  }

  isSafe(res: any) {
    if (res.TYPE === 'ai_batch') return parseFloat(res.BEST_SCORE) < 10.0;
    return parseFloat(res.AI_PROBABILITY) < 10.0;
  }

  onInput() {
    if (['ndls_mrz', 'nld_mrz', 'fra_mrz'].includes(this.store.selectedApp() || '')) {
      const fd = new FormData(); fd.append('type', this.store.selectedApp()!); fd.append('lines', JSON.stringify(this.store.lines()));
      this.store.executeCommand(fd, true).subscribe(res => this.store.mrzData.set(res));
    } else if (this.store.hasPreview() && this.store.selectedFile()) {
      this.reqPreview();
    }
  }

  reqPreview() {
    const fd = new FormData(); fd.append('type', this.store.selectedApp()!); fd.append('lines', JSON.stringify(this.store.lines())); fd.append('file', this.store.selectedFile()!);
    this.store.executeCommand(fd, false).subscribe((res: Blob) => {
      if (this.store.previewUrl()) URL.revokeObjectURL(this.store.previewUrl()!);
      this.store.previewUrl.set(URL.createObjectURL(res));
    });
  }

  async execute(isBatch: boolean = false) {
    if (this.store.selectedApp() === 'ai_bypass') {
      this.store.loading.set(true);
      const files = this.store.batchFiles();
      const results = new Array(files.length).fill(null);
      this.store.bypassResults.set([...results]);

      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append('type', 'ai_bypass');
        fd.append('lines', JSON.stringify(this.store.lines()));
        fd.append('scan_mode', isBatch ? 'true' : 'false');
        fd.append('file', files[i]);

        try {
          const res = await lastValueFrom(this.store.executeSilent(fd, true));
          results[i] = res;
        } catch (err) {
          results[i] = { STATUS: 'ERROR' };
        }
        this.store.bypassResults.set([...results]);
      }
      this.store.loading.set(false);
      return;
    }

    const fd = new FormData(); 
    fd.append('type', this.store.selectedApp()!); 
    fd.append('lines', JSON.stringify(this.store.lines())); 
    fd.append('scan_mode', this.store.scanMode().toString());
    if (this.store.selectedFile()) fd.append('file', this.store.selectedFile()!);
    
    const isJson = ['ndls_mrz', 'nld_mrz', 'fra_mrz'].includes(this.store.selectedApp() || '');
    
    this.store.executeCommand(fd, isJson).subscribe((res: any) => {
      if (isJson) this.store.mrzData.set(res);
      else {
        const url = URL.createObjectURL(res); const a = document.createElement('a'); a.href = url;
        a.download = `V_OUT_${Date.now()}.${this.store.isMediaApp() ? 'jpg' : 'pdf'}`;
        a.click(); URL.revokeObjectURL(url);
      }
    });
  }

  download(base64Data: string, originalName: string) {
    const a = document.createElement('a');
    a.href = `data:image/jpeg;base64,${base64Data}`;
    a.download = `STEALTH_${originalName}`;
    a.click();
  }

  copy(t: string) { navigator.clipboard.writeText(t); }
}