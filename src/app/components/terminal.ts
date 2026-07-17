import { Component, inject, signal, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AppStore } from '../store';
import { I18nService } from '../services/i18n';
import { MapComponent } from './map';
import { MrzForgeComponent } from './mrz-forge';
import { UkDlGenComponent } from './uk-dl-gen';
import { FraCinComponent } from './fra-cin';
import { PtIdMrzComponent } from './pt-id-mrz';
import { lastValueFrom } from 'rxjs';
import { zipSync } from 'fflate';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent, MrzForgeComponent, UkDlGenComponent, FraCinComponent, PtIdMrzComponent],
  template: `
    <div class="shell fade-in">

      @if (fromIdLab()) {
        <div class="breadcrumb mono">
          <button class="bc-back" (click)="router.navigate(['/id-lab'], { queryParams: fromCountry() ? { country: fromCountry()!.code } : {} })">← ID_LAB</button>
          @if (fromCountry(); as c) {
            <span class="bc-sep">›</span>
            <img class="bc-flag" [src]="'https://flagcdn.com/20x15/' + c.iso2 + '.png'" [alt]="c.code">
            <span class="bc-country">{{ c.name }}</span>
            <span class="bc-sep">›</span>
          }
          <span class="bc-tool">{{ getAppTitle() }}</span>
        </div>
      }

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
          @if (store.selectedApp() === 'revolut') {
            <label class="toggle" [class.scan-active]="customTx()">
              <input type="checkbox" [ngModel]="customTx()" (ngModelChange)="customTx.set($event)">
              <span class="scan-icon">✏️</span>
              <span class="toggle-track" [class.on]="customTx()">
                <span class="toggle-thumb"></span>
              </span>
              <span class="mono toggle-label">CUSTOM_TX</span>
            </label>
          }
        </div>
        <div class="shell-desc mono">{{ getGuideText() }}</div>
      </div>

      <div class="shell-body" [class.forge-mode]="store.selectedApp() === 'mrz_gen' || store.selectedApp() === 'uk_dl_gen' || store.selectedApp() === 'fra_cin' || store.selectedApp() === 'pt_id_mrz'">
        <!-- LEFT: form -->
        <div class="panel-form">
          @if (store.selectedApp() !== 'mrz_gen' && store.selectedApp() !== 'uk_dl_gen' && store.selectedApp() !== 'fra_cin' && store.selectedApp() !== 'pt_id_mrz') {

          @if (store.selectedApp() === 'ai_bypass') {
            <div class="ai-preset-bar">
              @for (p of AI_PRESETS; track p.id) {
                <button class="ai-preset-btn mono"
                  [class.active]="aiPreset() === p.id"
                  [style.--ap-color]="p.color"
                  (click)="setAiPreset(p.id)">
                  <span class="ap-id">{{ p.id }}</span>
                  <span class="ap-sub">{{ p.sub }}</span>
                </button>
              }
            </div>
          }

          <div class="fields">
            @for (field of store.schema(); track field.id) {
              @if (!(store.selectedApp() === 'ndls_mrz' && field.id === 'dr' && mrzVersion() === 'G2') && !(store.selectedApp() === 'ai_bypass' && field.id === 'preset')) {
              <div class="field">
                <div class="field-label-row">
                  <label class="mono field-label">{{ field.label }}</label>
                  @if (field.desc) {
                    <span class="info-btn" [attr.data-tip]="field.desc">i</span>
                  }
                </div>
                @if (!field.type || field.type === 'text') {
                  <div class="field-input">
                    <input [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()"
                      [placeholder]="field.p" autocomplete="off" spellcheck="false" class="mono">
                  </div>
                }
                @if (field.type === 'select') {
                  <div class="field-input field-input-select">
                    <select class="mono" [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()">
                      @for (opt of field.opts; track opt) {
                        <option [value]="opt">{{ opt }}</option>
                      }
                    </select>
                    <span class="select-arrow mono">▾</span>
                  </div>
                }
                @if (field.type === 'range') {
                  <div class="field-input field-range">
                    <input type="range" [(ngModel)]="store.lines()[$index]" (ngModelChange)="onInput()"
                      [min]="field.min" [max]="field.max">
                    <span class="mono range-val">{{ store.lines()[$index] !== '' && store.lines()[$index] != null ? store.lines()[$index] : field.p }}</span>
                  </div>
                }
              </div>
              }
            }
          </div>

          @if (store.selectedApp() === 'revolut' && customTx()) {
            <div class="custom-tx-fields fields">
              <div class="field">
                <label class="mono field-label">MERCHANT_NAME</label>
                <div class="field-input">
                  <input class="mono" [ngModel]="customMerchant()" (ngModelChange)="customMerchant.set($event)"
                    placeholder="e.g. Tesco" autocomplete="off">
                </div>
              </div>
              <div class="field">
                <label class="mono field-label">TO_FIELD</label>
                <div class="field-input">
                  <input class="mono" [ngModel]="customTo()" (ngModelChange)="customTo.set($event)"
                    placeholder="e.g. Tesco, Dublin" autocomplete="off">
                </div>
              </div>
              <div class="field">
                <label class="mono field-label">CARD_FIELD</label>
                <div class="field-input">
                  <input class="mono" [ngModel]="customCard()" (ngModelChange)="customCard.set($event)"
                    placeholder="e.g. 416598******1234" autocomplete="off">
                </div>
              </div>
              <div class="field">
                <label class="mono field-label">AMOUNT_EUR</label>
                <div class="field-input">
                  <input class="mono" [ngModel]="customAmount()" (ngModelChange)="customAmount.set($event)"
                    placeholder="e.g. 42.50" autocomplete="off" type="number" min="0" step="0.01">
                </div>
              </div>
              <div class="field">
                <label class="mono field-label">TX_DATE <span style="color:var(--text-dim);font-weight:400">(opt)</span></label>
                <div class="field-input">
                  <input class="mono" [ngModel]="customDate()" (ngModelChange)="customDate.set($event)"
                    type="date" autocomplete="off">
                </div>
              </div>
            </div>
          }

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

          @if (MRZ_APPS.has(store.selectedApp() || '')) {
            <div class="mrz-actions">
              <button class="btn-reset mono" (click)="resetFields()">↺ RESET</button>
            </div>
          }

          @if (!['ndls_mrz','nld_mrz','fra_mrz','mrz_gen','uk_dl_gen','ita_cf','fra_cin','pt_id_mrz'].includes(store.selectedApp() || '')) {
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
                  <button class="btn-exec btn-dl-zip mono" (click)="downloadAllZip()">
                    ↓ ZIP
                  </button>
                }
              }
            </div>
          }
          }
        </div>

        <!-- RIGHT: visuals -->
        <div class="panel-visuals">
          @if (store.selectedApp() === 'exif_cleaner') {
            <app-map></app-map>
          }

          @if (store.selectedApp() === 'mrz_gen') {
            <app-mrz-forge></app-mrz-forge>
          }

          @if (store.selectedApp() === 'uk_dl_gen') {
            <app-uk-dl-gen></app-uk-dl-gen>
          }

          @if (store.selectedApp() === 'fra_cin') {
            <app-fra-cin></app-fra-cin>
          }

          @if (store.selectedApp() === 'pt_id_mrz') {
            <app-pt-id-mrz></app-pt-id-mrz>
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
            <div class="mrz-version-row">
              <button class="mrz-ver-btn mono" [class.active]="mrzVersion() === 'G2'" (click)="mrzVersion.set('G2')">GEN 2 — ISO</button>
              <button class="mrz-ver-btn mono" [class.active]="mrzVersion() === 'G1'" (click)="mrzVersion.set('G1')">GEN 1 — LEGACY</button>
            </div>
            <div class="mrz-card">
              @if (mrzVersion() === 'G2') {
                <div class="mrz-row">
                  <span class="mrz-tag mono">G2</span>
                  <code class="mono">{{ store.mrzData()?.GEN_2_ISO || '——————————————————————————————' }}</code>
                  @if (store.mrzData()?.GEN_2_ISO) {
                    <button class="btn-copy mono" (click)="copy(store.mrzData()!.GEN_2_ISO || '')">CPY</button>
                  }
                </div>
              }
              @if (mrzVersion() === 'G1') {
                <div class="mrz-row">
                  <span class="mrz-tag mono">G1</span>
                  <code class="mono">{{ store.mrzData()?.GEN_1_LEGACY || '———————————————————————————————' }}</code>
                  @if (store.mrzData()?.GEN_1_LEGACY) {
                    <button class="btn-copy mono" (click)="copy(store.mrzData()!.GEN_1_LEGACY || '')">CPY</button>
                  }
                </div>
              }
            </div>
            <ng-container *ngTemplateOutlet="historyTpl"></ng-container>
          }

          @if (store.selectedApp() === 'nld_mrz') {
            <div class="mrz-card">
              <div class="mrz-row">
                <span class="mrz-tag mono">L1</span>
                <code class="mono">{{ store.mrzData()?.L1 || '——————————————————————————————' }}</code>
                @if (store.mrzData()?.L1) {
                  <button class="btn-copy mono" (click)="copy((store.mrzData()!.L1||'')+'\n'+(store.mrzData()!.L2||'')+'\n'+(store.mrzData()!.L3||''))">ALL</button>
                }
              </div>
              <div class="mrz-row"><span class="mrz-tag mono">L2</span><code class="mono">{{ store.mrzData()?.L2 || '——————————————————————————————' }}</code></div>
              <div class="mrz-row"><span class="mrz-tag mono">L3</span><code class="mono">{{ store.mrzData()?.L3 || '——————————————————————————————' }}</code></div>
            </div>
            <ng-container *ngTemplateOutlet="historyTpl"></ng-container>
          }

          @if (store.selectedApp() === 'fra_mrz') {
            <div class="mrz-card">
              @if (!store.mrzData() || store.mrzData()?.STATUS === 'SYNC_OK') {
                <div class="mrz-row">
                  <span class="mrz-tag mono">L1</span>
                  <code class="mono">{{ store.mrzData()?.L1 || '——————————————————————————————' }}</code>
                  @if (store.mrzData()?.L1) {
                    <button class="btn-copy mono" (click)="copy((store.mrzData()!.L1||'')+'\n'+(store.mrzData()!.L2||''))">ALL</button>
                  }
                </div>
                <div class="mrz-row"><span class="mrz-tag mono">L2</span><code class="mono">{{ store.mrzData()?.L2 || '——————————————————————————————' }}</code></div>
              }
              @if (store.mrzData()?.STATUS === 'VALIDATION_ERR') {
                <div class="mrz-row err">
                  <span class="mrz-tag mono err">ERR</span>
                  <code class="mono err">{{ store.mrzData()?.ERR_MSG }}</code>
                </div>
              }
            </div>
            <ng-container *ngTemplateOutlet="historyTpl"></ng-container>
          }

          <ng-template #historyTpl>
            @if (mrzHistory().length > 0) {
              <div class="mrz-history">
                <div class="mrz-history-label mono">// RECENT</div>
                @for (h of mrzHistory(); track $index) {
                  <button class="mrz-hist-item mono" (click)="restoreHistory(h)">
                    <span class="mhi-lines">{{ h.lines[0] }}{{ h.lines[1] ? ' · ' + h.lines[1] : '' }}</span>
                    <span class="mhi-idx">#{{ $index + 1 }}</span>
                  </button>
                }
              </div>
            }
          </ng-template>

          @if (store.selectedApp() === 'ita_cf') {
            @if (store.cfData(); as cf) {
              @if (cf.STATUS === 'OK') {
                <div class="mrz-card cf-card">
                  <div class="mrz-row">
                    <span class="mrz-tag mono">CF</span>
                    <code class="mono cf-code">{{ cf.CF_CODE }}</code>
                    <button class="btn-copy mono" (click)="copy(cf.CF_CODE)">CPY</button>
                  </div>
                </div>
                @if (cf.BARCODE_B64) {
                  <div class="cf-barcode-wrap">
                    <img [src]="'data:image/png;base64,' + cf.BARCODE_B64" class="cf-barcode">
                    <button class="btn-dl-bar mono" (click)="downloadBarcode(cf.BARCODE_B64, cf.CF_CODE)">↓ PNG</button>
                  </div>
                }
              }
              @if (cf.STATUS === 'INCOMPLETE') {
                <div class="cf-empty mono">FILL_ALL_FIELDS</div>
              }
              @if (cf.STATUS === 'ERR') {
                <div class="cf-empty mono err">{{ cf.CF_CODE }}</div>
              }
            } @else {
              <div class="cf-empty mono">AWAITING_INPUT</div>
            }
          }

          @if (store.selectedApp() === 'deu_tax') {
            @if (store.taxData(); as tx) {
              @if (tx.STATUS === 'OK') {
                <div class="mrz-card cf-card">
                  <div class="mrz-row">
                    <span class="mrz-tag mono">STEUER-ID</span>
                    <code class="mono cf-code" style="letter-spacing:4px">{{ tx.TAX_ID }}</code>
                    <button class="btn-copy mono" (click)="copy(tx.TAX_ID)">CPY</button>
                  </div>
                </div>
              }
            } @else {
              <div class="cf-empty mono">PRESS_EXECUTE</div>
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

      @if (imageHistory().length > 0) {
        <div class="img-history">
          <div class="ih-label mono">// SESSION_HISTORY</div>
          <div class="ih-row">
            @for (h of imageHistory(); track h.url) {
              <div class="ih-item">
                <img [src]="h.url" class="ih-thumb">
                <span class="mono ih-name">{{ h.name }}</span>
              </div>
            }
          </div>
        </div>
      }
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

    /* breadcrumb */
    .breadcrumb {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 16px;
      background: rgba(0,255,65,0.04); border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .bc-back {
      background: none; border: none; cursor: pointer;
      color: var(--green); font-size: 0.55rem; font-weight: 700;
      letter-spacing: 1px; padding: 3px 8px;
      border: 1px solid var(--border-green); border-radius: 4px;
      transition: background 0.15s;
    }
    .bc-back:hover { background: rgba(0,255,65,0.1); }
    .bc-sep { color: var(--text-dim); font-size: 0.6rem; }
    .bc-flag { width: 20px; height: 15px; object-fit: cover; border-radius: 2px; border: 1px solid rgba(255,255,255,0.1); }
    .bc-country { font-size: 0.55rem; color: var(--text-mid); letter-spacing: 1px; }
    .bc-tool { font-size: 0.55rem; color: var(--green); letter-spacing: 1px; }

    /* header */
    .shell-header {
      display: flex; flex-direction: column; gap: 8px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .shell-title-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .shell-title { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .shell-dot {
      width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
      background: var(--green); box-shadow: 0 0 6px var(--green);
      animation: pulse-green 2s infinite;
    }
    .shell-name { font-size: 0.7rem; font-weight: 700; color: var(--green); letter-spacing: 3px; }
    .shell-desc {
      font-size: 0.58rem; color: rgba(255,255,255,0.3); letter-spacing: 0.3px;
      line-height: 1.6; padding: 8px 12px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-left: 2px solid rgba(0,255,65,0.2);
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
    .shell-body.forge-mode .panel-form { display: none; }
    .shell-body.forge-mode .panel-visuals {
      width: 100%; max-width: 100%;
      overflow: hidden;
    }
    .shell-body.forge-mode .panel-visuals app-mrz-forge,
    .shell-body.forge-mode .panel-visuals app-uk-dl-gen {
      display: flex; flex-direction: column;
      height: 100%;
    }

    /* form panel */
    .panel-form {
      width: 300px; flex-shrink: 0;
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      overflow-y: auto; overflow-x: hidden;
    }

    .fields {
      padding: 16px; display: flex; flex-direction: column; gap: 10px;
      box-sizing: border-box; width: 100%;
    }

    .field { width: 100%; box-sizing: border-box; }

    .field-label {
      display: block; font-size: 0.5rem; font-weight: 700;
      color: var(--text-dim); letter-spacing: 2px; text-transform: uppercase;
    }
    .field-input {
      background: rgba(0,0,0,0.35);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 9px 12px;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box; width: 100%;
    }
    .field-input:focus-within {
      border-color: var(--border-green);
      box-shadow: 0 0 0 1px rgba(0,255,65,0.1);
    }
    .field-input input, .field-input select {
      width: 100%; background: none; border: none; outline: none;
      color: var(--green); font-size: 0.78rem; font-weight: 600;
      appearance: none; box-sizing: border-box; min-width: 0;
    }
    .field-input select option { background: #0d1a0d; color: var(--green); }
    .field-input-select { display: flex; align-items: center; gap: 6px; padding-right: 8px; }
    .field-input-select select { flex: 1; min-width: 0; cursor: pointer; }
    .select-arrow { font-size: 0.6rem; color: var(--green); opacity: 0.6; pointer-events: none; flex-shrink: 0; }
    .field-label-row {
      display: flex; align-items: center; gap: 5px; margin-bottom: 5px;
    }
    .field-label-row .field-label { margin-bottom: 0; }

    .info-btn {
      width: 13px; height: 13px; border-radius: 50%;
      background: transparent; border: 1px solid rgba(0,255,65,0.25);
      color: rgba(0,255,65,0.45); font-size: 0.45rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      cursor: default; flex-shrink: 0; position: relative; font-style: normal;
      font-family: var(--mono); letter-spacing: 0; transition: 0.15s;
    }
    .info-btn:hover { border-color: var(--green); color: var(--green); }
    .info-btn::after {
      content: attr(data-tip);
      position: absolute; left: calc(100% + 8px); top: 50%; transform: translateY(-50%);
      background: #060f06; border: 1px solid rgba(0,255,65,0.2);
      color: rgba(255,255,255,0.55); font-size: 0.52rem; line-height: 1.7;
      padding: 8px 12px; border-radius: var(--radius-sm);
      width: 210px; white-space: normal; z-index: 200;
      pointer-events: none; opacity: 0; transition: opacity 0.15s;
      box-shadow: 0 8px 24px rgba(0,0,0,0.7);
    }
    .info-btn:hover::after { opacity: 1; }

    .mrz-version-row {
      display: flex; gap: 6px; margin-bottom: 10px;
    }
    .mrz-ver-btn {
      flex: 1; padding: 7px 10px;
      background: transparent; border: 1px solid var(--border);
      color: var(--text-dim); font-size: 0.55rem; font-weight: 700;
      letter-spacing: 1.5px; border-radius: var(--radius-sm);
      cursor: pointer; transition: 0.15s;
    }
    .mrz-ver-btn:hover { border-color: var(--border-green); color: var(--green); }
    .mrz-ver-btn.active {
      border-color: var(--green); color: var(--green);
      background: var(--green-dim);
    }

    .field-range { display: flex; align-items: center; gap: 10px; padding: 8px 14px; }
    .field-range input[type=range] { flex: 1; accent-color: var(--green); cursor: pointer; }
    .range-val { font-size: 0.75rem; color: var(--text); font-weight: 700; width: 28px; text-align: right; }

    .custom-tx-fields {
      border-top: 1px solid var(--border);
      padding-top: 10px;
    }

    .dropzone {
      margin: 0 16px 16px;
      border: 1px dashed rgba(255,255,255,0.08);
      border-radius: var(--radius-sm);
      padding: 20px 12px;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      cursor: pointer; transition: 0.2s;
    }
    .dropzone:hover { border-color: rgba(0,255,65,0.3); background: rgba(0,255,65,0.02); }
    .dz-icon {
      font-size: 1.2rem; font-weight: 900;
      color: var(--text-dim); font-family: var(--mono);
      transition: 0.2s;
    }
    .dz-icon.ok { color: var(--green); text-shadow: 0 0 10px var(--green-glow); }
    .dz-label { font-size: 0.55rem; color: var(--text-dim); letter-spacing: 2px; }

    .actions {
      margin: 0 16px 16px;
      display: grid; grid-template-columns: 1fr; gap: 6px;
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

    /* AI-STEALTH preset bar */
    .ai-preset-bar {
      display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;
    }
    .ai-preset-btn {
      flex: 1; min-width: 80px; display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer;
      border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.4);
      transition: 0.15s;
    }
    .ai-preset-btn:hover {
      border-color: var(--ap-color, #00ff41);
      background: color-mix(in srgb, var(--ap-color, #00ff41) 10%, transparent);
    }
    .ai-preset-btn.active {
      border-color: var(--ap-color, #00ff41);
      background: color-mix(in srgb, var(--ap-color, #00ff41) 14%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--ap-color, #00ff41) 25%, transparent);
    }
    .ap-id {
      font-size: 0.6rem; font-weight: 900; letter-spacing: 1.5px;
      color: var(--ap-color, #00ff41);
    }
    .ap-sub {
      font-size: 0.42rem; color: var(--text-dim); letter-spacing: 0.5px; text-align: center;
    }
    .ai-preset-btn:not(.active) .ap-id { color: var(--text-mid); }

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
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
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
      position: relative;
      overflow: hidden;
    }
    .mrz-card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--green), transparent);
      opacity: 0.6;
    }
    .mrz-row {
      display: flex; align-items: center; gap: 16px;
      margin-bottom: 10px;
    }
    .mrz-row:last-child { margin-bottom: 0; }
    .mrz-row.err code, .mrz-row.err .mrz-tag { color: var(--red); }
    .mrz-tag { font-size: 0.55rem; font-weight: 700; color: var(--green); width: 20px; letter-spacing: 1px; }
    code { color: var(--text); font-size: 0.7rem; letter-spacing: 3px; flex: 1; word-break: break-all; }
    .btn-copy {
      background: var(--green-dim); border: 1px solid var(--border-green);
      color: var(--green); font-size: 0.55rem; font-weight: 700;
      padding: 4px 10px; border-radius: 4px; cursor: pointer; letter-spacing: 1px;
      white-space: nowrap; flex-shrink: 0;
    }

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

    /* MRZ actions row */
    .mrz-actions {
      padding: 0 16px 10px; display: flex; justify-content: flex-end;
    }
    .btn-reset {
      background: transparent; border: 1px solid var(--border);
      color: var(--text-dim); font-size: 0.55rem; font-weight: 700;
      padding: 5px 12px; border-radius: var(--radius-sm);
      cursor: pointer; letter-spacing: 1.5px; transition: 0.15s;
    }
    .btn-reset:hover { border-color: var(--border-green); color: var(--green); }

    /* MRZ history */
    .mrz-history { display: flex; flex-direction: column; gap: 4px; }
    .mrz-history-label {
      font-size: 0.5rem; color: var(--text-dim); letter-spacing: 2px;
      margin-bottom: 4px; padding-left: 2px;
    }
    .mrz-hist-item {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      background: rgba(0,0,0,0.3); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 7px 12px;
      cursor: pointer; text-align: left; transition: 0.15s; width: 100%;
    }
    .mrz-hist-item:hover { border-color: var(--border-green); background: var(--green-dim); }
    .mhi-lines {
      font-size: 0.6rem; color: var(--text); font-weight: 600;
      letter-spacing: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
    }
    .mhi-idx { font-size: 0.5rem; color: var(--text-dim); flex-shrink: 0; }

    /* CF */
    .cf-card { border-color: rgba(0,122,255,0.4); }
    .cf-code { font-size: 0.85rem; letter-spacing: 4px; color: var(--blue, #007aff); }
    .cf-barcode-wrap {
      display: flex; flex-direction: column; align-items: stretch; gap: 10px;
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 16px;
    }
    .cf-barcode {
      width: 100%; height: auto;
      background: white;
      border-radius: 4px;
      image-rendering: pixelated;
    }
    .btn-dl-bar {
      align-self: flex-end;
      background: rgba(0,122,255,0.1); border: 1px solid rgba(0,122,255,0.3);
      color: #007aff; font-size: 0.6rem; font-weight: 700;
      padding: 5px 14px; border-radius: 4px; cursor: pointer;
      letter-spacing: 1px; transition: 0.15s;
    }
    .btn-dl-bar:hover { background: rgba(0,122,255,0.2); }
    .cf-empty {
      font-size: 0.65rem; color: var(--text-dim); letter-spacing: 3px;
      padding: 20px; text-align: center;
      border: 1px dashed var(--border); border-radius: var(--radius-sm);
    }
    .cf-empty.err { color: var(--red); border-color: rgba(255,59,48,0.3); }

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

    /* ZIP button */
    .btn-dl-zip {
      background: rgba(0,188,212,0.1); border-color: rgba(0,188,212,0.3);
      color: #00bcd4;
    }
    .btn-dl-zip:hover { background: rgba(0,188,212,0.2); }

    /* image session history */
    .img-history {
      border-top: 1px solid var(--border);
      padding: 12px 16px 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .ih-label { font-size: 0.5rem; color: var(--text-dim); letter-spacing: 2px; }
    .ih-row {
      display: flex; gap: 10px; overflow-x: auto;
      padding-bottom: 4px;
    }
    .ih-item {
      display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
    }
    .ih-thumb {
      width: 72px; height: 54px; object-fit: cover;
      border: 1px solid var(--border); border-radius: 4px;
      cursor: pointer; transition: border-color 0.15s;
    }
    .ih-thumb:hover { border-color: var(--border-green); }
    .ih-name {
      font-size: 0.42rem; color: var(--text-dim); letter-spacing: 0.5px;
      max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
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
export class TerminalComponent implements OnInit {
  store = inject(AppStore);
  i18n = inject(I18nService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  titleSvc = inject(Title);

  fromIdLab = signal(false);
  fromCountry = signal<{ code: string; name: string; iso2: string } | null>(null);

  customTx = signal(false);
  mrzVersion = signal<'G2' | 'G1'>('G2');
  customMerchant = signal('');
  customTo = signal('');
  customCard = signal('');
  customAmount = signal('');
  customDate = signal('');

  private readonly FRONTEND_ONLY = new Set(['uk_dl_gen', 'fra_cin', 'pt_id_mrz']);
  readonly MRZ_APPS = new Set(['ndls_mrz', 'nld_mrz', 'fra_mrz', 'ita_cf']);

  readonly AI_PRESETS = [
    { id: 'LITE',     sub: 'blur + noise',        color: '#4caf50' },
    { id: 'STANDARD', sub: 'full camera pipeline', color: '#007aff' },
    { id: 'GHOST',    sub: 'signal-level / no EXIF', color: '#9c27b0' },
    { id: 'MAX',      sub: 'all techniques',       color: '#ff6b00' },
    { id: 'DENOISE',  sub: 'NLM cleanup',          color: '#00bcd4' },
  ];

  setAiPreset(preset: string) {
    const lines = [...this.store.lines()];
    lines[0] = preset;
    this.store.lines.set(lines);
  }

  aiPreset(): string {
    return this.store.lines()[0] || 'STANDARD';
  }

  imageHistory = signal<{ url: string; app: string; name: string }[]>([]);

  mrzHistory = signal<{ lines: string[]; result: any }[]>([]);
  private historyTimer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('document:dragover', ['$event'])
  onDocDragOver(e: DragEvent) { if (this.store.isMediaApp()) e.preventDefault(); }

  @HostListener('document:drop', ['$event'])
  onDocDrop(e: DragEvent) {
    if (!this.store.isMediaApp()) return;
    e.preventDefault();
    if (e.dataTransfer?.files.length) this.handleFiles(e.dataTransfer.files);
  }

  private historyKey() { return `mrz_hist_${this.store.selectedApp()}`; }

  private loadHistory() {
    try { return JSON.parse(localStorage.getItem(this.historyKey()) || '[]'); } catch { return []; }
  }

  private pushHistory(lines: string[], result: any) {
    if (this.historyTimer) clearTimeout(this.historyTimer);
    const allFilled = lines.every(v => v.trim().length > 0);
    if (!allFilled) return;
    this.historyTimer = setTimeout(() => {
      const current = this.store.lines();
      const same = current.every((v, i) => v === lines[i]);
      if (!same) return;
      const next = [{ lines: [...lines], result }, ...this.mrzHistory()
        .filter(h => h.lines.join('|') !== lines.join('|'))].slice(0, 5);
      this.mrzHistory.set(next);
      localStorage.setItem(this.historyKey(), JSON.stringify(next));
    }, 5000);
  }

  restoreHistory(h: { lines: string[]; result: any }) {
    this.store.lines.set([...h.lines]);
    this.store.mrzData.set(h.result);
    this.store.cfData.set(h.result);
  }

  resetFields() {
    const schema = this.store.schema();
    this.store.lines.set(schema.map(f => f.type === 'select' && f.opts?.length ? f.opts[0] : ''));
    this.store.mrzData.set(null);
    this.store.cfData.set(null);
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe(qp => {
      if (qp.get('from') === 'id_lab') {
        this.fromIdLab.set(true);
        const code = qp.get('country') ?? '';
        const name = qp.get('cname') ?? '';
        const iso2 = qp.get('iso2') ?? '';
        if (code) this.fromCountry.set({ code, name, iso2 });
      }
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id') ?? '';
      if (id) {
        this.store.closeApp();
        if (!this.FRONTEND_ONLY.has(id)) {
          this.store.openApp(id);
        } else {
          this.store.selectedApp.set(id);
        }
        this.titleSvc.setTitle(`${this.i18n.module(id).nav} — Ver1ff Room`);
        if (this.MRZ_APPS.has(id)) {
          this.mrzHistory.set(this.loadHistory());
        }
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
      this.store.executeJson<import('../store').MrzData>(fd).subscribe(res => {
        this.store.mrzData.set(res);
        if (res.STATUS === 'SYNC_OK') this.pushHistory(this.store.lines(), res);
      });
    } else if (app === 'ita_cf') {
      const fd = new FormData();
      fd.append('type', 'ita_cf');
      fd.append('lines', JSON.stringify(this.store.lines()));
      this.store.executeJson<import('../store').CfData>(fd).subscribe(res => {
        this.store.cfData.set(res);
        if (res.STATUS === 'OK') this.pushHistory(this.store.lines(), res);
      });
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
      return;
    }

    const fd = new FormData();
    fd.append('type', this.store.selectedApp()!);
    fd.append('lines', JSON.stringify(this.store.lines()));
    fd.append('scan_mode', this.store.scanMode().toString());
    if (this.store.selectedFile()) fd.append('file', this.store.selectedFile()!);
    if (this.store.selectedApp() === 'revolut' && this.customTx()) {
      fd.append('custom_tx', 'true');
      fd.append('custom_merchant', this.customMerchant());
      fd.append('custom_to', this.customTo());
      fd.append('custom_card', this.customCard());
      fd.append('custom_amount', this.customAmount());
      fd.append('custom_date', this.customDate());
    }
    
    if (this.store.selectedApp() === 'deu_tax') {
      this.store.executeJson<import('../store').TaxData>(fd).subscribe(res => this.store.taxData.set(res));
      return;
    }

    const isJson = ['ndls_mrz', 'nld_mrz', 'fra_mrz'].includes(this.store.selectedApp() || '');

    if (isJson) {
      this.store.executeJson<import('../store').MrzData>(fd).subscribe(res => this.store.mrzData.set(res));
    } else {
      this.store.executeBlob(fd).subscribe(res => {
        const fname = this.getFileName();
        const dlUrl = URL.createObjectURL(res);
        const anchor = document.createElement('a');
        anchor.href = dlUrl; anchor.download = fname; anchor.click();
        URL.revokeObjectURL(dlUrl);
        const histUrl = URL.createObjectURL(res);
        const prev = this.imageHistory();
        if (prev.length >= 6) URL.revokeObjectURL(prev[prev.length - 1].url);
        this.imageHistory.set([{ url: histUrl, app: this.store.selectedApp() || '', name: fname }, ...prev.slice(0, 5)]);
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
    const n1 = String(Math.floor(Math.random() * 9000 + 1000));
    const n2 = String(Math.floor(Math.random() * 9000 + 1000));
    return `IMG_${n1}_${n2}.${ext}`;
  }

  download(base64Data: string, originalName: string) {
    const a = document.createElement('a');
    a.href = `data:image/jpeg;base64,${base64Data}`;
    const n1 = String(Math.floor(Math.random() * 9000 + 1000));
    const n2 = String(Math.floor(Math.random() * 9000 + 1000));
    a.download = `IMG_${n1}_${n2}.jpg`;
    a.click();
  }

  copy(t: string) { navigator.clipboard.writeText(t); }

  downloadBarcode(b64: string, cf: string) {
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${b64}`;
    a.download = `CF_${cf}_barcode.png`;
    a.click();
  }

  downloadAll() {
    const results = this.store.bypassResults();
    const files = this.store.batchFiles();
    results.forEach((res, i) => {
      if (res?.IMAGE_BASE64) {
        setTimeout(() => this.download(res.IMAGE_BASE64!, files[i]?.name ?? ''), i * 200);
      }
    });
  }

  downloadAllZip() {
    const results = this.store.bypassResults();
    const entries: Record<string, Uint8Array> = {};
    results.forEach(res => {
      if (!res?.IMAGE_BASE64) return;
      const bin = atob(res.IMAGE_BASE64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const n1 = String(Math.floor(Math.random() * 9000 + 1000));
      const n2 = String(Math.floor(Math.random() * 9000 + 1000));
      entries[`IMG_${n1}_${n2}.jpg`] = arr;
    });
    const zipped = zipSync(entries);
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `STEALTH_BATCH.zip`; a.click();
    URL.revokeObjectURL(url);
  }

  getScore(res: import('../store').BypassResult): string {
    return res.TYPE === 'ai_batch' ? (res.BEST_SCORE ?? '—') : (res.AI_PROBABILITY ?? '—');
  }
}