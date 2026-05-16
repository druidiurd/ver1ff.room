import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AppStore } from '../store';
import { I18nService } from '../services/i18n';
import { MapComponent } from './map';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent],
  template: `
    <div class="shell fade-in">

      <div class="shell-header">
        <div class="shell-title-row">
          <div class="shell-title">
            <span class="shell-dot"></span>
            <span class="mono shell-name">{{ getAppTitle() }}</span>
          </div>
            @if (store.selectedApp() === 'energia' || store.selectedApp() === 'revolut') {
            <label class="toggle" [class.scan-active]="store.scanMode()">
              <input type="checkbox" [ngModel]="store.scanMode()" (ngModelChange)="store.scanMode.set($event)">
              <span class="scan-icon">📷</span>
              <span class="toggle-track" [class.on]="store.scanMode()">
                <span class="toggle-thumb"></span>
              </span>
              <span class="mono toggle-label">{{ i18n.t().scan }}</span>
            </label>
          }
        </div>
        <div class="shell-desc mono">{{ getGuideText() }}</div>
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
                  {{ store.selectedFile() ? i18n.t().fileLocked : i18n.t().dropOrClick }}
                </div>
              } @else {
                <div class="dz-icon" [class.ok]="store.batchFiles().length > 0">
                  {{ store.batchFiles().length > 0 ? '✓' : '⊞' }}
                </div>
                <div class="mono dz-label">
                  {{ store.batchFiles().length > 0 ? store.batchFiles().length + '_FILES' : i18n.t().dropUpTo5 }}
                </div>
              }
            </div>
          }

          @if (!['ndls_mrz','nld_mrz','fra_mrz','mrz_gen'].includes(store.selectedApp() || '')) {
            <div class="actions" [class.col]="store.selectedApp() === 'ai_bypass'">
              <button class="btn-exec mono"
                [disabled]="store.loading() || !canExecute()"
                (click)="execute(false)">
                <span class="btn-arrow">›</span>
                {{ store.selectedApp() === 'ai_bypass' ? i18n.t().testQuality : i18n.t().execute }}
                @if (store.loading()) { <span class="btn-loader"></span> }
              </button>
              @if (store.selectedApp() === 'ai_bypass') {
                <button class="btn-exec btn-auto mono"
                  [disabled]="store.loading() || !canExecute()"
                  (click)="execute(true)">
                  <span class="btn-arrow">⚡</span>{{ i18n.t().autoCompress }}
                  @if (store.loading()) { <span class="btn-loader btn-loader-purple"></span> }
                </button>
                @if (store.bypassResults().some(r => r?.IMAGE_BASE64)) {
                  <button class="btn-exec btn-dl-all mono" (click)="downloadAll()">
                    ↓ DOWNLOAD_ALL
                  </button>
                }
              }
            </div>
          }
        </div>

        <!-- RIGHT: visuals -->
        <div class="panel-visuals">
          @if (store.selectedApp() === 'exif_cleaner') {
            <app-map></app-map>
          }

          @if (store.selectedApp() === 'mrz_gen') {
            @if (store.mrzGenResult(); as gen) {
              <div class="forge-output">
                @if (gen.MRP) {
                  <div class="mrz-format-card">
                    <div class="mf-header">
                      <span class="mf-tag mono">MRP</span>
                      <span class="mf-name mono">PASSPORT · TD3 · 2×44</span>
                      <button class="btn-copy mono" (click)="copy(gen.MRP!.join('\n'))">COPY</button>
                    </div>
                    @for (line of gen.MRP; track $index) {
                      <div class="mrz-line-wrap">
                        <code class="mrz-line mono">{{ line }}</code>
                      </div>
                    }
                  </div>
                }
                @if (gen.MRV_A) {
                  <div class="mrz-format-card visa">
                    <div class="mf-header">
                      <span class="mf-tag mono visa">MRV-A</span>
                      <span class="mf-name mono">VISA · 2×44</span>
                      <button class="btn-copy mono" (click)="copy(gen.MRV_A!.join('\n'))">COPY</button>
                    </div>
                    @for (line of gen.MRV_A; track $index) {
                      <div class="mrz-line-wrap"><code class="mrz-line mono">{{ line }}</code></div>
                    }
                  </div>
                }
                @if (gen.TD1) {
                  <div class="mrz-format-card amber">
                    <div class="mf-header">
                      <span class="mf-tag mono amber">TD1</span>
                      <span class="mf-name mono">ID CARD · 3×30</span>
                      <button class="btn-copy amber mono" (click)="copy(gen.TD1!.join('\n'))">COPY</button>
                    </div>
                    @for (line of gen.TD1; track $index) {
                      <div class="mrz-line-wrap"><code class="mrz-line mono">{{ line }}</code></div>
                    }
                  </div>
                }
                @if (gen.TD2) {
                  <div class="mrz-format-card amber">
                    <div class="mf-header">
                      <span class="mf-tag mono amber">TD2</span>
                      <span class="mf-name mono">ID CARD · 2×36</span>
                      <button class="btn-copy amber mono" (click)="copy(gen.TD2!.join('\n'))">COPY</button>
                    </div>
                    @for (line of gen.TD2; track $index) {
                      <div class="mrz-line-wrap"><code class="mrz-line mono">{{ line }}</code></div>
                    }
                  </div>
                }
                @if (gen.EDL) {
                  <div class="mrz-format-card edl">
                    <div class="mf-header">
                      <span class="mf-tag mono edl">eDL</span>
                      <span class="mf-name mono">DRIVER LICENSE · 1 LINE</span>
                      <button class="btn-copy edl mono" (click)="copy(gen.EDL![0])">COPY</button>
                    </div>
                    <div class="mrz-line-wrap"><code class="mrz-line mono">{{ gen.EDL[0] }}</code></div>
                  </div>
                }
              </div>
            } @else {
              <div class="forge-empty">
                <span class="mono empty-label">FILL_FIELDS → MRZ_UPDATES_LIVE</span>
              </div>
            }
          }

          @if (store.hasPreview()) {
            <div class="preview">
              @if (store.previewUrl()) {
                <img [src]="store.previewUrl()" class="preview-img">
              } @else {
                <span class="mono empty-label">{{ i18n.t().awaitingSource }}</span>
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
              @if (store.batchProgress(); as prog) {
                <div class="batch-progress">
                  <div class="bp-bar">
                    <div class="bp-fill" [style.width.%]="(prog.done / prog.total) * 100"></div>
                  </div>
                  <span class="mono bp-label">{{ prog.done }} / {{ prog.total }} PROCESSED</span>
                </div>
              }

              @for (f of store.batchFiles(); track f.name; let i = $index) {
                <div class="batch-item">
                  <div class="batch-side">
                    <span class="mono side-tag">ORIGINAL</span>
                    <span class="mono side-fname">{{ f.name }}</span>
                    <img [src]="store.batchUrls()[i]" class="side-img">
                  </div>
                  <div class="batch-side purple">
                    <span class="mono side-tag purple">STEALTH</span>
                    @if (store.bypassResults()[i]; as res) {
                      @if (res.STATUS !== 'ERROR' && res.STATUS !== 'ALL_NODES_DEAD') {
                        <img [src]="'data:image/jpeg;base64,' + res.IMAGE_BASE64" class="side-img">
                        <div class="batch-stats">
                          <div class="stat-main">
                            <span class="mono stat-score" [class.safe]="isSafe(res)" [class.danger]="!isSafe(res)">
                              {{ getScore(res) }}
                            </span>
                            <span class="mono stat-label">{{ isSafe(res) ? 'AI_SAFE' : 'DETECTED' }}</span>
                          </div>
                          <span class="mono stat-node">{{ res.USED_PROFILE }}</span>
                          <button class="btn-dl mono" (click)="download(res.IMAGE_BASE64||'', f.name)">↓</button>
                        </div>
                        @if (res.TYPE === 'ai_batch' && $any(res).RESULTS) {
                          <div class="scan-table">
                            @for (row of $any(res).RESULTS; track row.quality) {
                              <div class="scan-row" [class.best]="row.quality === $any(res).BEST_Q">
                                <span class="mono">Q{{ row.quality }}</span>
                                <span class="mono" [class.safe]="row.score < 0.1" [class.danger]="row.score >= 0.1">
                                  {{ (row.score * 100).toFixed(1) }}%
                                </span>
                                @if (row.quality === $any(res).BEST_Q) {
                                  <span class="mono best-tag">BEST</span>
                                }
                              </div>
                            }
                          </div>
                        }
                      } @else {
                        <span class="mono empty-label err">{{ i18n.t().nodesDead }}</span>
                      }
                    } @else {
                      <div class="pending-slot">
                        @if (store.loading()) {
                          <div class="pending-spinner"></div>
                          <span class="mono empty-label">{{ i18n.t().processing }}</span>
                        } @else {
                          <span class="mono empty-label">{{ i18n.t().pending }}</span>
                        }
                      </div>
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
      display: flex; flex-direction: column; gap: 10px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
    }
    .shell-title-row {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    }
    .shell-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .shell-dot {
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
      background: var(--green); box-shadow: 0 0 8px var(--green);
      animation: pulse-green 2s infinite;
    }
    .shell-name { font-size: 0.75rem; font-weight: 700; color: var(--green); letter-spacing: 3px; }
    .shell-desc {
      font-size: 0.62rem; color: var(--text-dim); letter-spacing: 0.5px;
      line-height: 1.6; padding: 10px 14px;
      background: rgba(0,255,65,0.03);
      border: 1px solid var(--border);
      border-left: 2px solid var(--border-green);
      border-radius: var(--radius-sm);
    }

    /* toggle / scan */
    .toggle {
      display: flex; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0;
      padding: 6px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      transition: border-color 0.2s, background 0.2s;
    }
    .toggle:hover { border-color: var(--border-green); }
    .toggle.scan-active {
      border-color: var(--green);
      background: var(--green-dim);
      box-shadow: 0 0 12px rgba(0,255,65,0.15);
      animation: scan-pulse 2s infinite;
    }
    @keyframes scan-pulse {
      0%,100% { box-shadow: 0 0 8px rgba(0,255,65,0.1); }
      50%      { box-shadow: 0 0 20px rgba(0,255,65,0.3); }
    }
    .toggle input { display: none; }
    .scan-icon { font-size: 0.85rem; }
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
    .toggle-track.on .toggle-thumb { left: 18px; background: var(--green); box-shadow: 0 0 6px var(--green); }
    .toggle-label { font-size: 0.6rem; color: var(--text-dim); letter-spacing: 2px; }
    .scan-active .toggle-label { color: var(--green); font-weight: 700; }

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
    .btn-exec.btn-auto {
      background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05));
      border: 1px solid var(--purple); color: var(--purple);
    }
    .btn-exec.btn-auto:hover:not(:disabled) { background: rgba(168,85,247,0.2); box-shadow: 0 0 16px rgba(168,85,247,0.2); }
    .btn-exec.btn-dl-all {
      background: transparent; border: 1px solid var(--border);
      color: var(--text-dim); font-size: 0.6rem;
    }
    .btn-exec.btn-dl-all:hover { border-color: var(--border-green); color: var(--green); }
    .btn-arrow { font-size: 1rem; }
    .btn-loader {
      width: 12px; height: 12px;
      border: 2px solid transparent; border-top-color: #000;
      border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    .btn-loader-purple { border-top-color: var(--purple); }
    @keyframes spin { to { transform: rotate(360deg); } }

    .actions.col { grid-template-columns: 1fr; }

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
    .batch { display: flex; flex-direction: column; gap: 16px; }

    .batch-progress {
      display: flex; flex-direction: column; gap: 6px;
    }
    .bp-bar {
      height: 3px; background: var(--border); border-radius: 2px; overflow: hidden;
    }
    .bp-fill {
      height: 100%; background: var(--purple);
      box-shadow: 0 0 8px rgba(168,85,247,0.5);
      transition: width 0.3s ease;
    }
    .bp-label { font-size: 0.55rem; color: var(--purple); letter-spacing: 2px; }

    .batch-item { display: flex; gap: 10px; min-height: 220px; }
    .batch-side {
      flex: 1; border-radius: var(--radius-sm);
      position: relative; overflow: hidden;
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .batch-side.purple { border-color: rgba(168,85,247,0.2); }
    .side-tag {
      position: absolute; top: 8px; left: 8px;
      font-size: 0.45rem; font-weight: 700;
      background: rgba(0,0,0,0.85); padding: 3px 8px;
      border-radius: 3px; color: var(--text-dim); z-index: 2; letter-spacing: 1px;
    }
    .side-tag.purple { color: var(--purple); }
    .side-fname {
      position: absolute; top: 8px; right: 8px;
      font-size: 0.4rem; color: var(--text-dim);
      background: rgba(0,0,0,0.7); padding: 2px 6px; border-radius: 3px;
      z-index: 2; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .side-img { width: 100%; height: 100%; object-fit: contain; }

    .batch-stats {
      position: absolute; bottom: 0; left: 0; right: 0;
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(transparent, rgba(0,0,0,0.95) 30%);
      padding: 20px 10px 8px; z-index: 2;
    }
    .stat-main { display: flex; flex-direction: column; gap: 2px; }
    .stat-score { font-size: 1rem; font-weight: 800; }
    .stat-score.safe { color: var(--green); text-shadow: 0 0 10px var(--green-glow); }
    .stat-score.danger { color: var(--red); text-shadow: 0 0 10px rgba(255,59,48,0.4); }
    .stat-label { font-size: 0.45rem; letter-spacing: 2px; color: var(--text-dim); }
    .stat-node { font-size: 0.45rem; color: var(--purple); letter-spacing: 1px; }
    .btn-dl {
      background: rgba(168,85,247,0.2); color: var(--purple);
      border: 1px solid rgba(168,85,247,0.4);
      padding: 5px 12px; border-radius: 4px; font-size: 0.6rem;
      font-weight: 700; cursor: pointer; transition: 0.15s; flex-shrink: 0;
    }
    .btn-dl:hover { background: rgba(168,85,247,0.35); }

    .pending-slot {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .pending-spinner {
      width: 24px; height: 24px;
      border: 2px solid var(--border); border-top-color: var(--purple);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }

    .scan-table {
      position: absolute; top: 8px; right: 8px;
      display: flex; flex-direction: column; gap: 2px; z-index: 3;
    }
    .scan-row {
      display: flex; gap: 6px; align-items: center;
      background: rgba(0,0,0,0.8); padding: 2px 6px; border-radius: 3px;
      font-size: 0.45rem; color: var(--text-dim); border: 1px solid transparent;
    }
    .scan-row.best { border-color: var(--green); color: var(--text); }
    .best-tag { color: var(--green); font-weight: 700; }
    .safe { color: var(--green); }
    .danger { color: var(--red); }

    /* MRZ Forge */
    .forge-output { display: flex; flex-direction: column; gap: 12px; }
    .forge-empty {
      flex: 1; display: flex; align-items: center; justify-content: center;
      border: 1px dashed var(--border); border-radius: var(--radius-sm); min-height: 120px;
    }
    .mrz-format-card {
      background: rgba(0,0,0,0.5);
      border: 1px solid var(--border-green);
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .mrz-format-card.amber { border-color: rgba(255,149,0,0.3); }
    .mrz-format-card.visa  { border-color: rgba(0,122,255,0.3); }
    .mrz-format-card.edl   { border-color: rgba(168,85,247,0.3); }
    .mf-header { display: flex; align-items: center; gap: 10px; }
    .mf-tag {
      font-size: 0.5rem; font-weight: 800; letter-spacing: 1px;
      padding: 3px 8px; border-radius: 4px;
      background: var(--green-dim); color: var(--green); border: 1px solid var(--border-green);
      flex-shrink: 0;
    }
    .mf-tag.amber { background: rgba(255,149,0,0.1); color: var(--amber); border-color: rgba(255,149,0,0.3); }
    .mf-tag.visa  { background: rgba(0,122,255,0.1); color: var(--blue); border-color: rgba(0,122,255,0.3); }
    .mf-tag.edl   { background: rgba(168,85,247,0.1); color: var(--purple); border-color: rgba(168,85,247,0.3); }
    .mf-name { font-size: 0.55rem; color: var(--text-dim); letter-spacing: 2px; flex: 1; }
    .mrz-line-wrap {
      background: rgba(0,0,0,0.4); border-radius: 4px;
      padding: 8px 12px; overflow-x: auto;
    }
    .mrz-line {
      font-size: 0.65rem; letter-spacing: 2.5px; color: var(--green);
      white-space: nowrap; display: block;
    }
    .mrz-format-card.amber .mrz-line { color: var(--amber); }
    .mrz-format-card.visa  .mrz-line { color: var(--blue); }
    .mrz-format-card.edl   .mrz-line { color: var(--purple); }
    .btn-copy.edl { background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); color: var(--purple); }
    .btn-copy.visa { background: rgba(0,122,255,0.1); border-color: rgba(0,122,255,0.3); color: var(--blue); }

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
export class TerminalComponent implements OnInit {
  store = inject(AppStore);
  i18n = inject(I18nService);
  route = inject(ActivatedRoute);
  titleSvc = inject(Title);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id') ?? '';
      if (id) {
        this.store.closeApp();
        this.store.openApp(id);
        this.titleSvc.setTitle(`${this.i18n.module(id).nav} — Ver1ff Room`);
      }
    });
  }

  getAppTitle(): string {
    const id = this.store.selectedApp() || '';
    return this.i18n.module(id).label || 'CORE_SYSTEM_DASH';
  }

  getGuideText(): string {
    const id = this.store.selectedApp() || '';
    return this.i18n.module(id).desc || 'System operational. Ready...';
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
    const app = this.store.selectedApp() || '';
    if (['ndls_mrz', 'nld_mrz', 'fra_mrz'].includes(app)) {
      const fd = new FormData();
      fd.append('type', app);
      fd.append('lines', JSON.stringify(this.store.lines()));
      this.store.executeJson<import('../store').MrzData>(fd).subscribe(res => this.store.mrzData.set(res));
    } else if (app === 'mrz_gen') {
      const fd = new FormData();
      fd.append('type', 'mrz_gen');
      fd.append('lines', JSON.stringify(this.store.lines()));
      this.store.executeJson<import('../store').MrzGenResult>(fd).subscribe(res => this.store.mrzGenResult.set(res));
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
      const results: (import('../store').BypassResult | null)[] = new Array(files.length).fill(null);
      this.store.bypassResults.set([...results]);
      this.store.batchProgress.set({ done: 0, total: files.length });

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
        this.store.batchProgress.set({ done: i + 1, total: files.length });
      }
      this.store.loading.set(false);
      this.store.batchProgress.set(null);
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

  downloadAll() {
    const results = this.store.bypassResults();
    const files = this.store.batchFiles();
    results.forEach((res, i) => {
      if (res?.IMAGE_BASE64) {
        setTimeout(() => this.download(res.IMAGE_BASE64!, files[i]?.name ?? `img_${i}.jpg`), i * 200);
      }
    });
  }

  getScore(res: import('../store').BypassResult): string {
    return res.TYPE === 'ai_batch' ? (res.BEST_SCORE ?? '—') : (res.AI_PROBABILITY ?? '—');
  }
}