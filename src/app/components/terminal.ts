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
    <div class="shell fade-in">

      <div class="shell-header">
        <div class="shell-title">
          <span class="shell-dot"></span>
          <span class="mono shell-name">{{ getAppTitle() }}</span>
        </div>
        <div class="shell-meta mono">{{ getGuideText() }}</div>
        @if (store.selectedApp() === 'energia' || store.selectedApp() === 'revolut') {
          <label class="toggle">
            <input type="checkbox" [ngModel]="store.scanMode()" (ngModelChange)="store.scanMode.set($event)">
            <span class="toggle-track" [class.on]="store.scanMode()">
              <span class="toggle-thumb"></span>
            </span>
            <span class="mono toggle-label">SCAN</span>
          </label>
        }
      </div>

      <div class="shell-body">
        <!-- LEFT: form -->
        <div class="panel-form">
          <div class="fields">
            @for (field of store.schema(); track field.id) {
              <div class="field">
                <label class="mono field-label">{{ field.label }}</label>
                @if (!field.type || field.type === 'text') {
                  <div class="field-input">
                    <input [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()"
                      [placeholder]="field.p" autocomplete="off" spellcheck="false" class="mono">
                  </div>
                }
                @if (field.type === 'select') {
                  <div class="field-input">
                    <select class="mono" [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()">
                      <option value="" disabled>{{ field.p }}</option>
                      @for (opt of field.opts; track opt) {
                        <option [value]="opt">{{ opt }}</option>
                      }
                    </select>
                  </div>
                }
                @if (field.type === 'range') {
                  <div class="field-input field-range">
                    <input type="range" [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()"
                      [min]="field.min" [max]="field.max">
                    <span class="mono range-val">{{ store.lines()[$index] || field.p }}</span>
                  </div>
                }
              </div>
            }
          </div>

          @if (store.isMediaApp()) {
            <div class="dropzone" (click)="fi.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
              <input type="file" #fi (change)="onFile($event)" [multiple]="store.selectedApp() === 'ai_bypass'" hidden>
              @if (store.selectedApp() !== 'ai_bypass') {
                <div class="dz-icon" [class.ok]="store.selectedFile()">
                  {{ store.selectedFile() ? '✓' : '↑' }}
                </div>
                <div class="mono dz-label">
                  {{ store.selectedFile() ? 'FILE_LOCKED' : 'DROP_OR_CLICK' }}
                </div>
              } @else {
                <div class="dz-icon" [class.ok]="store.batchFiles().length > 0">
                  {{ store.batchFiles().length > 0 ? '✓' : '⊞' }}
                </div>
                <div class="mono dz-label">
                  {{ store.batchFiles().length > 0 ? store.batchFiles().length + '_FILES' : 'DROP_UP_TO_5' }}
                </div>
              }
            </div>
          }

          @if (!['ndls_mrz','nld_mrz','fra_mrz'].includes(store.selectedApp() || '')) {
            <div class="actions" [class.dual]="store.selectedApp() === 'ai_bypass'">
              <button class="btn-exec mono"
                [disabled]="store.loading() || !canExecute()"
                (click)="execute(false)">
                <span class="btn-arrow">›</span>
                {{ store.selectedApp() === 'ai_bypass' ? 'TEST_QUALITY' : 'EXECUTE' }}
                @if (store.loading()) { <span class="btn-loader"></span> }
              </button>
              @if (store.selectedApp() === 'ai_bypass') {
                <button class="btn-exec btn-purple mono"
                  [disabled]="store.loading() || !canExecute()"
                  (click)="execute(true)">
                  <span class="btn-arrow">›</span>AUTO_COMPRESS
                </button>
              }
            </div>
          }
        </div>

        <!-- RIGHT: visuals -->
        <div class="panel-visuals">
          @if (store.selectedApp() === 'exif_cleaner') {
            <app-map></app-map>
          }

          @if (store.hasPreview()) {
            <div class="preview">
              @if (store.previewUrl()) {
                <img [src]="store.previewUrl()" class="preview-img">
              } @else {
                <span class="mono empty-label">AWAITING_SOURCE</span>
              }
            </div>
          }

          @if (store.selectedApp() === 'ndls_mrz') {
            @if (store.mrzData(); as mrz) {
              <div class="mrz-card">
                <div class="mrz-row">
                  <span class="mrz-tag mono">G2</span>
                  <code class="mono">{{ mrz.GEN_2_ISO }}</code>
                  <button class="btn-copy mono" (click)="copy(mrz.GEN_2_ISO || '')">CPY</button>
                </div>
                <div class="mrz-row">
                  <span class="mrz-tag mono">G1</span>
                  <code class="mono">{{ mrz.GEN_1_LEGACY }}</code>
                </div>
              </div>
            }
          }

          @if (store.selectedApp() === 'nld_mrz') {
            @if (store.mrzData(); as mrz) {
              <div class="mrz-card amber">
                <div class="mrz-row">
                  <span class="mrz-tag mono">L1</span>
                  <code class="mono">{{ mrz.L1 }}</code>
                  <button class="btn-copy amber mono" (click)="copy((mrz.L1||'')+'\n'+(mrz.L2||'')+'\n'+(mrz.L3||''))">ALL</button>
                </div>
                <div class="mrz-row"><span class="mrz-tag mono">L2</span><code class="mono">{{ mrz.L2 }}</code></div>
                <div class="mrz-row"><span class="mrz-tag mono">L3</span><code class="mono">{{ mrz.L3 }}</code></div>
              </div>
            }
          }

          @if (store.selectedApp() === 'fra_mrz') {
            @if (store.mrzData(); as mrz) {
              <div class="mrz-card amber">
                @if (mrz.STATUS === 'SYNC_OK') {
                  <div class="mrz-row">
                    <span class="mrz-tag mono">L1</span>
                    <code class="mono">{{ mrz.L1 }}</code>
                    <button class="btn-copy amber mono" (click)="copy((mrz.L1||'')+'\n'+(mrz.L2||''))">ALL</button>
                  </div>
                  <div class="mrz-row"><span class="mrz-tag mono">L2</span><code class="mono">{{ mrz.L2 }}</code></div>
                }
                @if (mrz.STATUS === 'VALIDATION_ERR') {
                  <div class="mrz-row err">
                    <span class="mrz-tag mono err">ERR</span>
                    <code class="mono err">{{ mrz.ERR_MSG }}</code>
                  </div>
                }
              </div>
            }
          }

          @if (store.selectedApp() === 'ai_bypass' && store.batchFiles().length > 0) {
            <div class="batch">
              @for (f of store.batchFiles(); track f.name; let i = $index) {
                <div class="batch-item">
                  <div class="batch-side">
                    <span class="mono side-tag">ORIGINAL</span>
                    <img [src]="store.batchUrls()[i]" class="side-img">
                  </div>
                  <div class="batch-side purple">
                    <span class="mono side-tag purple">PROCESSED</span>
                    @if (store.bypassResults()[i]; as res) {
                      @if (res.STATUS !== 'ERROR' && res.STATUS !== 'ALL_NODES_DEAD') {
                        <img [src]="'data:image/jpeg;base64,' + res.IMAGE_BASE64" class="side-img">
                        <div class="batch-stats">
                          <span class="mono stat-score"
                            [class.safe]="isSafe(res)" [class.danger]="!isSafe(res)">
                            {{ res.TYPE === 'ai_batch' ? res.BEST_SCORE : res.AI_PROBABILITY }}
                          </span>
                          <span class="mono stat-node">{{ res.USED_PROFILE }}</span>
                          <button class="btn-dl mono" (click)="download(res.IMAGE_BASE64||'', f.name)">DL</button>
                        </div>
                      } @else {
                        <span class="mono empty-label err">NODES_DEAD</span>
                      }
                    } @else {
                      <span class="mono empty-label">
                        {{ store.loading() ? 'PROCESSING...' : 'PENDING' }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shell {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex; flex-direction: column;
      width: 100%; max-width: 1200px; margin: 0 auto;
      overflow: hidden;
    }

    /* header */
    .shell-header {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap; gap: 10px;
    }
    .shell-title { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .shell-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--green); box-shadow: 0 0 8px var(--green);
      animation: pulse-green 2s infinite;
    }
    .shell-name { font-size: 0.75rem; font-weight: 700; color: var(--green); letter-spacing: 3px; }
    .shell-meta { flex: 1; font-size: 0.6rem; color: var(--text-dim); letter-spacing: 1px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* toggle */
    .toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0; }
    .toggle input { display: none; }
    .toggle-track {
      width: 34px; height: 18px; background: var(--surface2);
      border: 1px solid var(--border); border-radius: 20px;
      position: relative; transition: 0.2s;
    }
    .toggle-track.on { background: var(--green-dim); border-color: var(--green); }
    .toggle-thumb {
      position: absolute; left: 2px; top: 2px;
      width: 12px; height: 12px; border-radius: 50%;
      background: var(--text-dim); transition: 0.2s;
    }
    .toggle-track.on .toggle-thumb { left: 18px; background: var(--green); }
    .toggle-label { font-size: 0.6rem; color: var(--text-dim); letter-spacing: 2px; }

    /* body */
    .shell-body {
      display: flex; flex: 1; gap: 0;
      overflow: hidden;
    }

    /* form panel */
    .panel-form {
      width: 320px; flex-shrink: 0;
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column; gap: 0;
      overflow-y: auto;
    }

    .fields { padding: 20px; display: flex; flex-direction: column; gap: 12px; }

    .field {}
    .field-label {
      display: block; font-size: 0.55rem; font-weight: 700;
      color: var(--text-dim); letter-spacing: 2px; margin-bottom: 6px;
    }
    .field-input {
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      transition: border-color 0.15s;
    }
    .field-input:focus-within { border-color: var(--border-green); }
    .field-input input, .field-input select {
      width: 100%; background: none; border: none; outline: none;
      color: var(--green); font-size: 0.8rem; font-weight: 700;
      appearance: none;
    }
    .field-input select option { background: #111; }
    .field-range { display: flex; align-items: center; gap: 10px; padding: 8px 14px; }
    .field-range input[type=range] { flex: 1; accent-color: var(--green); cursor: pointer; }
    .range-val { font-size: 0.75rem; color: var(--text); font-weight: 700; width: 28px; text-align: right; }

    .dropzone {
      margin: 0 20px 20px;
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      padding: 24px 16px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      cursor: pointer; transition: 0.2s;
    }
    .dropzone:hover { border-color: var(--border-green); background: var(--green-dim); }
    .dz-icon {
      font-size: 1.4rem; font-weight: 900;
      color: var(--text-dim); font-family: var(--mono);
      transition: 0.2s;
    }
    .dz-icon.ok { color: var(--green); text-shadow: 0 0 10px var(--green-glow); }
    .dz-label { font-size: 0.6rem; color: var(--text-dim); letter-spacing: 2px; }

    .actions {
      margin: 0 20px 20px;
      display: grid; grid-template-columns: 1fr; gap: 8px;
    }
    .actions.dual { grid-template-columns: 1fr 1fr; }

    .btn-exec {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      background: var(--green); color: #000;
      border: none; border-radius: var(--radius-sm);
      font-size: 0.65rem; font-weight: 700; letter-spacing: 2px;
      cursor: pointer; transition: 0.15s; position: relative;
      justify-content: center;
    }
    .btn-exec:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-exec:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-exec.btn-purple { background: transparent; border: 1px solid var(--purple); color: var(--purple); }
    .btn-exec.btn-purple:hover:not(:disabled) { background: rgba(168,85,247,0.1); }
    .btn-arrow { font-size: 1rem; }
    .btn-loader {
      width: 12px; height: 12px;
      border: 2px solid transparent; border-top-color: #000;
      border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* visuals panel */
    .panel-visuals {
      flex: 1; overflow-y: auto;
      padding: 20px; display: flex; flex-direction: column; gap: 16px;
    }

    .preview {
      flex: 1; min-height: 200px;
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .preview-img { max-width: 100%; max-height: 100%; object-fit: contain; }

    .empty-label { font-size: 0.65rem; color: var(--text-dim); letter-spacing: 3px; }
    .empty-label.err { color: var(--red); }

    /* MRZ */
    .mrz-card {
      background: rgba(0,0,0,0.6);
      border: 1px solid var(--border-green);
      border-radius: var(--radius-sm);
      padding: 16px 20px;
    }
    .mrz-card.amber { border-color: rgba(255,149,0,0.3); }
    .mrz-row {
      display: flex; align-items: center; gap: 16px;
      margin-bottom: 10px;
    }
    .mrz-row:last-child { margin-bottom: 0; }
    .mrz-row.err code, .mrz-row.err .mrz-tag { color: var(--red); }
    .mrz-tag { font-size: 0.55rem; font-weight: 700; color: var(--green); width: 20px; letter-spacing: 1px; }
    .mrz-card.amber .mrz-tag { color: var(--amber); }
    code { color: var(--text); font-size: 0.7rem; letter-spacing: 3px; flex: 1; word-break: break-all; }
    .btn-copy {
      background: var(--green-dim); border: 1px solid var(--border-green);
      color: var(--green); font-size: 0.55rem; font-weight: 700;
      padding: 4px 10px; border-radius: 4px; cursor: pointer; letter-spacing: 1px;
      white-space: nowrap; flex-shrink: 0;
    }
    .btn-copy.amber { background: rgba(255,149,0,0.1); border-color: rgba(255,149,0,0.3); color: var(--amber); }

    /* batch */
    .batch { display: flex; flex-direction: column; gap: 12px; }
    .batch-item { display: flex; gap: 10px; height: 160px; }
    .batch-side {
      flex: 1; border-radius: var(--radius-sm);
      position: relative; overflow: hidden;
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
    }
    .batch-side.purple { border-color: rgba(168,85,247,0.3); }
    .side-tag {
      position: absolute; top: 8px; left: 8px;
      font-size: 0.45rem; font-weight: 700;
      background: rgba(0,0,0,0.8); padding: 3px 6px;
      border-radius: 3px; color: var(--text-dim); z-index: 2;
    }
    .side-tag.purple { color: var(--purple); }
    .side-img { width: 100%; height: 100%; object-fit: contain; }
    .batch-stats {
      position: absolute; bottom: 8px; left: 8px; right: 8px;
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(0,0,0,0.85); padding: 4px 8px;
      border-radius: 4px; z-index: 2;
      border: 1px solid rgba(168,85,247,0.2);
    }
    .stat-score { font-size: 0.85rem; font-weight: 700; }
    .stat-score.safe { color: var(--green); }
    .stat-score.danger { color: var(--red); }
    .stat-node { font-size: 0.5rem; color: var(--purple); }
    .btn-dl {
      background: var(--purple); color: #fff;
      border: none; padding: 3px 10px;
      border-radius: 3px; font-size: 0.55rem;
      font-weight: 700; cursor: pointer;
    }

    /* mobile */
    @media (max-width: 767px) {
      .shell-body { flex-direction: column; overflow: visible; }
      .panel-form { width: 100%; border-right: none; border-bottom: 1px solid var(--border); }
      .panel-visuals { min-height: 300px; }
      .actions.dual { grid-template-columns: 1fr; }
      .shell-meta { display: none; }
    }
  `]
})
export class TerminalComponent {
  store = inject(AppStore);

  getAppTitle(): string {
    const map: Record<string, string> = {
      'energia': 'IE_BILL_GEN_V57_PRO', 
      'ndls_mrz': 'IE_MRZ_SYNC_NODE', 
      'nld_mrz': 'NL_MRZ_SYNC_NODE',
      'fra_mrz': 'FR_CNI_SYNC_NODE',
      'exif_cleaner': 'EXIF_SNIPER_HW', 
      'face_cut': 'FACE_VISION_V12',
      'ai_bypass': 'AI_STEALTH_V3',
      'revolut':   'REVOLUT_STMT_GEN'
    };
    return map[this.store.selectedApp() || ''] || 'CORE_SYSTEM_DASH';
  }

  getGuideText(): string {
    const map: Record<string, string> = {
      'energia': 'Professional Irish Utility Bill Generator. Auto-right-alignment. Scan mode injects Gaussian noise and biometric artifacts.',
      'ndls_mrz': 'Real-time dual-core MRZ generator. Synchronized checksums for GEN1 and GEN2 standards. Reactive input sink.',
      'nld_mrz': 'Netherlands ID MRZ Generator (TD1). Vectorized ICAO-9303 math.',
      'fra_mrz': 'France CNI MRZ Generator. Validates Department Code and CIN synchronously.',
      'exif_cleaner': 'Metadata Hardware Injector for OnePlus 6. Select target coordinates on map to spoof hardware location.',
      'face_cut': 'AI Biometric Extractor. 3x4 aspect ratio. Adjust Zoom and Vertical Sink manually for live preview results.',
      'ai_bypass': 'Forensic Evader. Applies Chromatic Aberrations, Noise, and iPhone EXIF to bypass AI Detection APIs. Auto-routes between 10 API nodes.',
      'revolut':   'Revolut EUR Statement Generator. Fill account holder data, IBAN, BIC, and one transaction row. Output is a ready PDF.'
    };
    return map[this.store.selectedApp() || ''] || 'System operational. Ready...';
  }

  onFile(e: Event) { this.handleFiles((e.target as HTMLInputElement).files!); }
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

  isSafe(res: import('../store').BypassResult) {
    if (res.TYPE === 'ai_batch') return parseFloat(res.BEST_SCORE ?? '100') < 10.0;
    return parseFloat(res.AI_PROBABILITY ?? '100') < 10.0;
  }

  onInput() {
    if (['ndls_mrz', 'nld_mrz', 'fra_mrz'].includes(this.store.selectedApp() || '')) {
      const fd = new FormData(); fd.append('type', this.store.selectedApp()!); fd.append('lines', JSON.stringify(this.store.lines()));
      this.store.executeJson<import('../store').MrzData>(fd).subscribe(res => this.store.mrzData.set(res));
    } else if (this.store.hasPreview() && this.store.selectedFile()) {
      this.reqPreview();
    }
  }

  reqPreview() {
    const fd = new FormData(); fd.append('type', this.store.selectedApp()!); fd.append('lines', JSON.stringify(this.store.lines())); fd.append('file', this.store.selectedFile()!);
    this.store.executeBlob(fd).subscribe(res => {
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
          const res = await lastValueFrom(this.store.executeSilentJson<import('../store').BypassResult>(fd));
          results[i] = res;
        } catch {
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

    if (isJson) {
      this.store.executeJson<import('../store').MrzData>(fd).subscribe(res => this.store.mrzData.set(res));
    } else {
      this.store.executeBlob(fd).subscribe(res => {
        const url = URL.createObjectURL(res); const a = document.createElement('a'); a.href = url;
        a.download = this.getFileName();
        a.click(); URL.revokeObjectURL(url);
      });
    }
  }

  getFileName(): string {
    const app = this.store.selectedApp() || '';
    const ext = this.store.isMediaApp() ? 'jpg' : 'pdf';
    if (app === 'revolut') {
      const now = new Date();
      const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const rnd = Math.floor(Math.random() * 90000 + 10000);
      return `transaction_statement_${ts}_${rnd}.pdf`;
    }
    return `V_OUT_${Date.now()}.${ext}`;
  }

  download(base64Data: string, originalName: string) {
    const a = document.createElement('a');
    a.href = `data:image/jpeg;base64,${base64Data}`;
    a.download = `STEALTH_${originalName}`;
    a.click();
  }

  copy(t: string) { navigator.clipboard.writeText(t); }
}