import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStore } from '../store';
import { MapComponent } from './map';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent],
  template: `
    <main class="terminal-shell fade-in">
      <header class="t-header">
        <button (click)="store.closeApp()" class="esc-btn">‹ EXIT_TO_ROOT</button>
        <div class="t-module">NODE::{{ store.selectedApp()?.toUpperCase() }}</div>
        <div class="t-tools">
          <label class="scan-ui" *ngIf="store.selectedApp() === 'energia'">
            <input type="checkbox" [ngModel]="store.scanMode()" (ngModelChange)="store.scanMode.set($event)">
            <span class="slider" [class.on]="store.scanMode()"></span><span class="txt">ARTIFACTS</span>
          </label>
        </div>
      </header>

      <div class="t-layout">
        <div class="col-form">
          <div class="form-grid">
            @for (field of store.schema(); track field.id) {
              <div class="field-box">
                <label>{{ field.label }}</label>
                <div class="input-bg">
                  <input [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()" [placeholder]="field.p" autocomplete="off">
                </div>
              </div>
            }
          </div>

          <div class="drop-zone" *ngIf="store.isMediaApp()" (click)="fi.click()" (drop)="onDrop($event)" (dragover)="$event.preventDefault()">
            <input type="file" #fi (change)="onFile($event)" hidden>
            <div class="d-icon" [class.locked]="store.selectedFile()">{{ store.selectedFile() ? '✅' : '📤' }}</div>
            <div class="d-text">{{ store.selectedFile() ? 'BUFFER_LOCKED' : 'DROP_SOURCE_MEDIA' }}</div>
          </div>
        </div>

        <div class="col-visuals">
          <app-map *ngIf="store.selectedApp() === 'exif_cleaner'"></app-map>

          <div class="preview-box" *ngIf="store.hasPreview()">
            <img *ngIf="store.previewUrl()" [src]="store.previewUrl()" class="pv-img">
            <span *ngIf="!store.previewUrl()" class="pv-empty">AWAITING_SOURCE...</span>
          </div>

          <div class="mrz-box" *ngIf="store.mrzData()">
            <div class="m-row"><span class="tag">G2</span><code>{{ store.mrzData().GEN_2_ISO }}</code><button (click)="copy(store.mrzData().GEN_2_ISO)">CPY</button></div>
            <div class="m-row"><span class="tag">G1</span><code>{{ store.mrzData().GEN_1_LEGACY }}</code></div>
          </div>
        </div>
      </div>

      <footer *ngIf="store.selectedApp() !== 'ndls_mrz'">
        <button [disabled]="store.loading() || (store.requiresFile() && !store.selectedFile())" (click)="execute()" class="exec-btn">
          > INITIATE_CORE_SEQUENCE
          <div class="bar" [style.width.%]="store.loading() ? 100 : 0"></div>
        </button>
      </footer>
    </main>
  `,
  styles: [`
    .fade-in { animation: fIn 0.4s ease-out; } @keyframes fIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
    .terminal-shell { background: rgba(10,10,10,0.95); backdrop-filter: blur(80px); border: 1px solid rgba(255,255,255,0.1); border-radius: 45px; padding: 50px; display: flex; flex-direction: column; width: 100%; max-width: 1200px; box-shadow: 0 40px 100px rgba(0,0,0,0.8); }
    
    .t-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .esc-btn { background: transparent; border: none; color: #666; font-weight: 900; cursor: pointer; transition: 0.2s; }
    .esc-btn:hover { color: #00ff41; }
    .t-module { color: #00ff41; font-size: 1.8rem; font-weight: 900; letter-spacing: 5px; text-shadow: 0 0 20px rgba(0,255,65,0.4); }

    .t-layout { display: flex; gap: 50px; flex: 1; min-height: 0; }
    .col-form, .col-visuals { flex: 1; display: flex; flex-direction: column; gap: 30px; }
    
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
    .field-box label { display: block; font-size: 0.7rem; font-weight: 900; color: #fff; margin-bottom: 12px; letter-spacing: 1px; }
    .input-bg { background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); padding: 18px 25px; border-radius: 20px; }
    input { width: 100%; background: transparent; border: none; color: #00ff41; font-family: 'JetBrains Mono'; font-size: 1.1rem; font-weight: 700; outline: none; }

    .drop-zone { flex: 1; border: 3px dashed rgba(255,255,255,0.1); border-radius: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; }
    .drop-zone:hover { border-color: #00ff41; background: rgba(0,255,65,0.02); }
    .d-icon { font-size: 3rem; margin-bottom: 15px; opacity: 0.5; }
    .d-icon.locked { opacity: 1; text-shadow: 0 0 20px #00ff41; }
    .d-text { font-weight: 900; color: #fff; letter-spacing: 2px; }

    .preview-box { flex: 1; background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 30px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .pv-img { max-width: 100%; max-height: 100%; border-radius: 15px; }
    .pv-empty { font-weight: 900; color: #444; letter-spacing: 4px; }

    .mrz-box { background: #000; border: 1px solid #00ff41; padding: 40px; border-radius: 30px; }
    .m-row { display: flex; align-items: center; gap: 30px; margin-bottom: 20px; font-family: 'JetBrains Mono'; font-size: 1.3rem; }
    .tag { color: #00ff41; font-weight: 900; }
    code { color: #fff; flex: 1; letter-spacing: 4px; }
    button { background: #00ff41; border: none; padding: 8px 20px; border-radius: 20px; font-weight: 900; cursor: pointer; }

    .exec-btn { width: 100%; margin-top: 40px; padding: 30px; background: #fff; color: #000; border: none; border-radius: 30px; font-size: 1.2rem; font-weight: 900; letter-spacing: 4px; cursor: pointer; position: relative; overflow: hidden; }
    .bar { position: absolute; bottom: 0; left: 0; height: 8px; background: #00ff41; transition: 2s; }
  `]
})
export class TerminalComponent {
  store = inject(AppStore);

  onFile(e: any) { const f = e.target.files[0]; if (f) { this.store.selectedFile.set(f); if (this.store.hasPreview()) this.reqPreview(); } }
  onDrop(e: DragEvent) { e.preventDefault(); if (e.dataTransfer?.files.length) { this.store.selectedFile.set(e.dataTransfer.files[0]); if (this.store.hasPreview()) this.reqPreview(); } }

  onInput() {
    if (this.store.selectedApp() === 'ndls_mrz') {
      const fd = new FormData(); fd.append('type', 'ndls_mrz'); fd.append('lines', JSON.stringify(this.store.lines()));
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

  execute() {
    const fd = new FormData(); fd.append('type', this.store.selectedApp()!); fd.append('lines', JSON.stringify(this.store.lines())); fd.append('scan_mode', this.store.scanMode().toString());
    if (this.store.selectedFile()) fd.append('file', this.store.selectedFile()!);
    
    this.store.executeCommand(fd, false).subscribe((res: Blob) => {
      const url = URL.createObjectURL(res); const a = document.createElement('a'); a.href = url;
      a.download = `V_OUT_${Date.now()}.${this.store.isMediaApp() ? 'jpg' : 'pdf'}`;
      a.click(); URL.revokeObjectURL(url);
    });
  }

  copy(t: string) { navigator.clipboard.writeText(t); }
}