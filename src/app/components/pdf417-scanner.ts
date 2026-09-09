import { Component, signal, viewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Parse } from 'aamva-parser';

@Component({
  selector: 'app-pdf417-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scanner-container fade-in">
      <!-- Header -->
      <div class="header">
        <div class="header-title">
          <span class="mono title">PDF417_SCANNER</span>
          <span class="mono subtitle">Drag & drop photos · Camera capture · Multi-format decoding</span>
        </div>
        <div class="header-stats">
          <div class="stat"><span class="label mono">DECODED</span><span class="value mono">{{ scannedCodes().length }}</span></div>
          <div class="stat"><span class="label mono">MODE</span><span class="value mono" [class.active]="cameraActive()">{{ cameraActive() ? 'LIVE' : 'READY' }}</span></div>
        </div>
      </div>

      <!-- Main area -->
      <div class="main-area">
        <!-- Upload / Drag&Drop zone -->
        <div class="upload-zone"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event)"
          [class.dragover]="isDragging()">
          <input #fileInput type="file" multiple accept="image/*" style="display:none" (change)="onFileSelected($event)">

          @if (!previewImage()) {
            <div class="upload-prompt">
              <div class="upload-icon">📁</div>
              <span class="mono">DROP IMAGES OR</span>
              <button class="upload-btn mono" (click)="fileInput.click()">BROWSE</button>
            </div>
          } @else {
            <div class="preview-area">
              <img [src]="previewImage()" class="preview-img">
              <div class="preview-overlay">
                <button class="overlay-btn scan-btn mono" (click)="scanImage()" [disabled]="scanning()">
                  {{ scanning() ? '⏳ SCANNING...' : '🔍 SCAN' }}
                </button>
                <button class="overlay-btn clear-btn mono" (click)="clearPreview()">✕ CLEAR</button>
              </div>
            </div>
          }
        </div>

        <!-- Live camera section (collapse-able) -->
        <div class="camera-section" [class.active]="cameraActive()">
          <button class="camera-toggle mono" (click)="toggleCamera()">
            {{ cameraActive() ? '🎥 STOP LIVE' : '📷 START LIVE CAM' }}
          </button>

          @if (cameraActive()) {
            <div class="camera-wrapper">
              <video #videoElement autoplay playsinline></video>
              <div class="reticle"></div>
              <button class="capture-btn mono" (click)="captureFromCamera()">📸 CAPTURE</button>
            </div>
          }
        </div>
      </div>

      <!-- Results panel -->
      <div class="results-panel">
        <div class="results-header">
          <span class="mono">RESULTS</span>
          <span class="count-badge mono">{{ scannedCodes().length }}</span>
        </div>

        @if (scannedCodes().length === 0) {
          <div class="results-empty mono">
            Upload an image or start live camera to scan
          </div>
        } @else {
          <div class="results-list">
            @for (code of scannedCodes(); track $index; let i = $index) {
              <div class="result-row">
                <div class="result-index mono">{{ i + 1 }}</div>
                <div class="result-content">
                  <div class="result-meta mono">
                    <span class="format" [style.color]="getFormatColor(code.format)">{{ code.format }}</span>
                    <span class="time">{{ formatTime(code.timestamp) }}</span>
                  </div>
                  <div class="result-value mono" (click)="copyToClipboard(code.data)">
                    {{ code.data.substring(0, 100) }}{{ code.data.length > 100 ? '...' : '' }}
                  </div>
                </div>
                <button class="result-copy mono" (click)="copyToClipboard(code.data)" title="Copy">📋</button>
              </div>
            }
          </div>
        }

        <div class="results-actions">
          <button class="action-btn mono" (click)="downloadResults()" [disabled]="scannedCodes().length === 0">
            📥 EXPORT
          </button>
          <button class="action-btn danger mono" (click)="clearResults()" [disabled]="scannedCodes().length === 0">
            🗑️ CLEAR
          </button>
        </div>
      </div>

      <!-- Status bar -->
      <div class="status-bar mono">
        @if (lastError()) {
          <span class="error">⚠️ {{ lastError() }}</span>
        } @else if (cameraActive()) {
          <span class="active">● CAMERA ACTIVE</span>
        } @else {
          <span class="idle">○ IDLE</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .scanner-container {
      display: flex; flex-direction: column; gap: 6px; height: 100vh;
      padding: 10px; background: rgba(0,0,0,0.3); box-sizing: border-box;
    }

    /* Header */
    .header {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 6px; border-bottom: 1px solid rgba(255,20,147,0.15);
      flex-shrink: 0;
    }
    .header-title {
      display: flex; flex-direction: column; gap: 1px;
    }
    .title {
      font-size: 0.85rem; font-weight: 700; color: #ff1493; letter-spacing: 0.5px;
    }
    .subtitle {
      font-size: 0.5rem; color: var(--text-dim); letter-spacing: 0.3px;
    }

    .header-stats {
      display: flex; gap: 10px; font-size: 0.55rem;
    }
    .stat {
      display: flex; flex-direction: column; align-items: flex-end; gap: 0.5px;
    }
    .label {
      color: var(--text-dim); letter-spacing: 0.3px;
    }
    .value {
      font-weight: 700; color: #00ff41; font-size: 0.65rem;
    }
    .value.active {
      text-shadow: 0 0 8px rgba(0,255,65,0.3);
    }

    /* Main area */
    .main-area {
      flex: 1; display: flex; flex-direction: column; gap: 6px; overflow: hidden;
    }

    .upload-zone {
      height: 80px; position: relative;
      border: 1px dashed rgba(255,20,147,0.3); border-radius: 3px;
      background: rgba(255,20,147,0.04); transition: 0.2s;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; overflow: hidden;
      flex-shrink: 0;
    }
    .upload-zone.dragover {
      border-color: rgba(0,255,65,0.5); background: rgba(0,255,65,0.08);
    }

    .upload-prompt {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
    }
    .upload-icon {
      font-size: 1.4rem;
    }
    .upload-btn {
      background: rgba(0,255,65,0.15); border: 1px solid rgba(0,255,65,0.3);
      color: #00ff41; padding: 4px 8px; border-radius: 2px; cursor: pointer;
      font-weight: 600; transition: 0.15s; letter-spacing: 0.3px;
      font-size: 0.55rem;
    }
    .upload-btn:hover {
      background: rgba(0,255,65,0.25); border-color: rgba(0,255,65,0.5);
    }

    .preview-area {
      position: relative; width: 100%; height: 100%;
    }
    .preview-img {
      width: 100%; height: 100%; object-fit: contain;
    }
    .preview-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; gap: 6px; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); opacity: 0; transition: 0.2s;
    }
    .upload-zone:hover .preview-overlay {
      opacity: 1;
    }
    .overlay-btn {
      padding: 6px 10px; border-radius: 3px; border: none; cursor: pointer;
      font-weight: 700; font-size: 0.55rem; letter-spacing: 0.5px; font-family: monospace;
    }
    .scan-btn {
      background: rgba(0,255,65,0.75); color: #000;
    }
    .scan-btn:hover:not(:disabled) {
      background: rgba(0,255,65,0.95);
    }
    .clear-btn {
      background: rgba(255,59,48,0.75); color: #fff;
    }
    .clear-btn:hover {
      background: rgba(255,59,48,0.95);
    }
    .overlay-btn:disabled {
      opacity: 0.4; cursor: not-allowed;
    }

    /* Camera section */
    .camera-section {
      display: flex; flex-direction: column; gap: 6px;
      max-height: 70px; overflow: hidden; transition: 0.3s;
      flex-shrink: 0;
    }
    .camera-section.active {
      max-height: 240px;
    }

    .camera-toggle {
      background: rgba(255,20,147,0.12); border: 1px solid rgba(255,20,147,0.25);
      color: #ff1493; padding: 6px 10px; border-radius: 3px; cursor: pointer;
      font-weight: 600; font-size: 0.55rem; transition: 0.15s;
      letter-spacing: 0.3px;
    }
    .camera-toggle:hover {
      background: rgba(255,20,147,0.2);
    }

    .camera-wrapper {
      position: relative; border-radius: 3px; overflow: hidden;
      border: 1px solid rgba(255,20,147,0.25); background: #000;
      height: 160px;
    }
    video {
      width: 100%; height: 100%; object-fit: cover;
    }
    .reticle {
      position: absolute; top: 50%; left: 50%;
      width: 90px; height: 90px; transform: translate(-50%, -50%);
      border: 2px solid rgba(0,255,65,0.35); border-radius: 3px;
      pointer-events: none;
    }
    .capture-btn {
      position: absolute; bottom: 7px; right: 7px;
      background: rgba(0,255,65,0.7); color: #000;
      border: none; padding: 4px 7px; border-radius: 2px;
      cursor: pointer; font-weight: 700; font-size: 0.5rem;
      font-family: monospace; transition: 0.15s;
    }
    .capture-btn:hover {
      background: rgba(0,255,65,0.9);
    }

    /* Results panel */
    .results-panel {
      flex: 1; display: flex; flex-direction: column; gap: 6px;
      border: 1px solid rgba(255,20,147,0.25); border-radius: 3px;
      background: rgba(0,0,0,0.35); padding: 8px; overflow: hidden;
    }

    .results-header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.55rem; font-weight: 700; color: var(--text-dim);
      letter-spacing: 0.3px; padding-bottom: 5px;
      border-bottom: 1px solid rgba(255,20,147,0.15);
      flex-shrink: 0;
    }
    .count-badge {
      background: rgba(255,20,147,0.15); border: 1px solid rgba(255,20,147,0.25);
      padding: 1px 5px; border-radius: 2px; color: #ff1493; font-size: 0.5rem;
    }

    .results-empty {
      flex: 1; display: flex; align-items: center; justify-content: center;
      color: var(--text-dim); font-size: 0.6rem; text-align: center;
    }

    .results-list {
      flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 3px;
    }

    .result-row {
      display: flex; gap: 5px; align-items: center;
      background: rgba(255,20,147,0.07); border: 1px solid rgba(255,20,147,0.15);
      border-radius: 2px; padding: 5px; font-size: 0.5rem;
    }

    .result-index {
      background: rgba(255,20,147,0.2); padding: 2px 4px; border-radius: 2px;
      color: #ff1493; font-weight: 700; min-width: 16px; text-align: center; flex-shrink: 0;
      font-size: 0.48rem;
    }

    .result-content {
      flex: 1; overflow: hidden;
    }
    .result-meta {
      display: flex; gap: 3px; font-size: 0.48rem; margin-bottom: 1px;
    }
    .format {
      font-weight: 700;
    }
    .time {
      color: var(--text-dim); margin-left: auto;
    }

    .result-value {
      background: rgba(0,0,0,0.35); padding: 2px 4px; border-radius: 2px;
      color: #00ff41; font-size: 0.48rem; cursor: pointer;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .result-value:hover {
      background: rgba(0,0,0,0.5);
    }

    .result-copy {
      background: rgba(255,20,147,0.12); border: none;
      color: #ff1493; padding: 2px 4px; border-radius: 2px;
      cursor: pointer; font-weight: 600; font-family: monospace;
      font-size: 0.48rem; transition: 0.15s; flex-shrink: 0;
    }
    .result-copy:hover {
      background: rgba(255,20,147,0.25);
    }

    .results-actions {
      display: flex; gap: 3px; flex-shrink: 0;
    }
    .action-btn {
      flex: 1; background: rgba(255,20,147,0.1);
      border: 1px solid rgba(255,20,147,0.2); color: #ff1493;
      padding: 3px; border-radius: 2px; cursor: pointer; font-weight: 600;
      font-size: 0.5rem; transition: 0.15s; letter-spacing: 0.2px;
    }
    .action-btn:hover:not(:disabled) {
      background: rgba(255,20,147,0.18);
    }
    .action-btn.danger {
      background: rgba(255,59,48,0.1); border-color: rgba(255,59,48,0.2);
      color: #ff3b30;
    }
    .action-btn.danger:hover:not(:disabled) {
      background: rgba(255,59,48,0.18);
    }
    .action-btn:disabled {
      opacity: 0.25; cursor: not-allowed;
    }

    /* Status bar */
    .status-bar {
      font-size: 0.55rem; font-weight: 700; letter-spacing: 0.2px;
      padding: 5px 8px; border-top: 1px solid rgba(255,20,147,0.15);
      color: var(--text-mid);
      flex-shrink: 0;
    }
    .error { color: #ff3b30; }
    .active { color: #00ff41; }
    .idle { color: var(--text-dim); }

    /* Scrollbar */
    .results-list::-webkit-scrollbar { width: 4px; }
    .results-list::-webkit-scrollbar-track { background: transparent; }
    .results-list::-webkit-scrollbar-thumb {
      background: rgba(255,20,147,0.25); border-radius: 2px;
    }
  `]
})
export class Pdf417ScannerComponent implements OnInit, OnDestroy {
  videoElement = viewChild<ElementRef>('videoElement');
  fileInput = viewChild<ElementRef>('fileInput');

  isDragging = signal(false);
  previewImage = signal<string | null>(null);
  scanning = signal(false);
  cameraActive = signal(false);
  scannedCodes = signal<Array<{ format: string; data: string; timestamp: Date }>>([]);
  lastError = signal<string | null>(null);

  private mediaStream: MediaStream | null = null;
  private codeReader: BrowserMultiFormatReader | null = null;
  aamvaInput = signal('');
  aamvaParsed = signal<Record<string, any> | null>(null);

  ngOnInit() {}

  ngOnDestroy() {
    this.stopCamera();
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave() {
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    const files = e.dataTransfer?.files;
    if (files) {
      this.loadImages(files);
    }
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      this.loadImages(input.files);
    }
  }

  private loadImages(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (typeof e.target?.result === 'string') {
            this.previewImage.set(e.target.result);
            // Auto-scan
            setTimeout(() => this.scanImage(), 300);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }

  scanImage() {
    this.scanning.set(true);
    const img = new Image();
    img.onload = () => {
      this.decodeImageWithZXing(img);
    };
    img.onerror = () => {
      this.lastError.set('Failed to load image');
      this.scanning.set(false);
    };
    img.src = this.previewImage()!;
  }

  private decodeImageWithZXing(img: HTMLImageElement) {
    try {
      const reader = new BrowserMultiFormatReader();
      let foundCodes: Array<{format: string; data: string; timestamp: Date}> = [];

      // Enhanced strategies with denoising and adaptive thresholding
      const strategies = [
        { scale: 1, contrast: 1.0, threshold: -1, denoise: false },      // Original
        { scale: 2, contrast: 1.2, threshold: -1, denoise: false },      // 2x scale
        { scale: 1, contrast: 1.5, threshold: -1, denoise: false },      // High contrast
        { scale: 1.5, contrast: 1.8, threshold: -1, denoise: true },     // 1.5x + strong contrast + denoise
        { scale: 2, contrast: 2.0, threshold: -1, denoise: true },       // 2x aggressive + denoise
        { scale: 1, contrast: 1.0, threshold: -2, denoise: true },       // Adaptive Otsu + denoise
        { scale: 2, contrast: 1.3, threshold: -2, denoise: true },       // 2x + Otsu + denoise
        { scale: 1, contrast: 2.5, threshold: 100, denoise: true },      // Very high contrast + aggressive binary
        { scale: 3, contrast: 1.5, threshold: -1, denoise: true },       // 3x scale (for small codes)
      ];

      for (const strategy of strategies) {
        try {
          const canvas = this.processImageAdvanced(img, strategy.scale, strategy.contrast, strategy.threshold, strategy.denoise);

          // Try full image
          try {
            const result = reader.decodeFromCanvas(canvas);
            if (result) {
              const text = (result as any).getText?.() || (result as any).text || result.toString();
              const format = (result as any).getFormatName?.() || (result as any).format?.toString() || 'BARCODE';
              const isDuplicate = foundCodes.some(c => c.data === text && c.format === format);
              if (!isDuplicate) {
                foundCodes.push({ format, data: text, timestamp: new Date() });
              }
            }
          } catch (e) {
            // Continue to region scanning
          }

          // Scan vertical strips (optimized for PDF417)
          const regions = this.getRegionsToScan(canvas.width, canvas.height);
          for (const region of regions) {
            try {
              const regionCanvas = this.extractRegion(canvas, region);
              const result = reader.decodeFromCanvas(regionCanvas);
              if (result) {
                const text = (result as any).getText?.() || (result as any).text || result.toString();
                const format = (result as any).getFormatName?.() || (result as any).format?.toString() || 'BARCODE';
                const isDuplicate = foundCodes.some(c => c.data === text && c.format === format);
                if (!isDuplicate) {
                  foundCodes.push({ format, data: text, timestamp: new Date() });
                }
              }
            } catch (e) {
              // Continue to next region
            }
          }

          // Early exit if found multiple codes
          if (foundCodes.length > 0) {
            this.scannedCodes.update(codes => [...codes, ...foundCodes]);
            this.lastError.set(null);
            this.scanning.set(false);
            return;
          }
        } catch (e) {
          continue;
        }
      }

      this.lastError.set('⚠️ No barcode detected. Try: 1) Better lighting/angle 2) Higher resolution photo 3) START LIVE CAM');
    } catch (err: any) {
      this.lastError.set('Error: ' + (err.message || 'Unknown'));
    } finally {
      this.scanning.set(false);
    }
  }

  private getRegionsToScan(width: number, height: number): Array<{x: number; y: number; w: number; h: number}> {
    const regions: Array<{x: number; y: number; w: number; h: number}> = [];

    // Horizontal bands (for QR, CODE_128)
    regions.push({ x: 0, y: 0, w: width, h: height / 3 });
    regions.push({ x: 0, y: height / 3, w: width, h: height / 3 });
    regions.push({ x: 0, y: (2 * height) / 3, w: width, h: height / 3 });

    // Vertical strips (optimized for PDF417 which is typically taller)
    const stripWidth = Math.max(100, width / 4);
    for (let i = 0; i < 4; i++) {
      const x = (width * i) / 4;
      regions.push({ x, y: 0, w: stripWidth, h: height });
    }

    // Left/Right halves
    regions.push({ x: 0, y: 0, w: width / 2, h: height });
    regions.push({ x: width / 2, y: 0, w: width / 2, h: height });

    // Center region (most likely spot)
    const margin = width / 8;
    regions.push({ x: margin, y: 0, w: width - 2 * margin, h: height });

    // Diagonal regions (for rotated codes)
    const quarter = width / 4;
    regions.push({ x: quarter, y: 0, w: width / 2, h: height });
    regions.push({ x: 0, y: quarter, w: width, h: height / 2 });

    return regions;
  }

  private extractRegion(canvas: HTMLCanvasElement, region: {x: number; y: number; w: number; h: number}): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');

    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = region.w;
    regionCanvas.height = region.h;
    const regionCtx = regionCanvas.getContext('2d');
    if (!regionCtx) throw new Error('Cannot get region context');

    const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
    regionCtx.putImageData(imageData, 0, 0);

    return regionCanvas;
  }

  private processImageAdvanced(img: HTMLImageElement, scale: number, contrast: number, threshold: number, denoise: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const width = img.width * scale;
    const height = img.height * scale;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');

    ctx.drawImage(img, 0, 0, width, height);
    let imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Step 1: Convert to grayscale
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // Step 2: Denoise if requested (median filter)
    let denoised: Uint8Array | Uint8ClampedArray = gray;
    if (denoise) {
      denoised = this.medianFilter(gray as any, width, height);
    }

    // Step 3: Apply contrast
    const contrasted = new Uint8Array(width * height);
    for (let i = 0; i < denoised.length; i++) {
      let val = denoised[i];
      val = 128 + (val - 128) * contrast;
      contrasted[i] = Math.max(0, Math.min(255, val));
    }

    // Step 4: Apply threshold
    let finalData: Uint8Array = contrasted;
    if (threshold > 0) {
      finalData = new Uint8Array(width * height);
      for (let i = 0; i < contrasted.length; i++) {
        finalData[i] = contrasted[i] > threshold ? 255 : 0;
      }
    } else if (threshold === -2) {
      // Adaptive Otsu's method for automatic thresholding
      const otsuThresh = this.calculateOtsuThreshold(contrasted);
      finalData = new Uint8Array(width * height);
      for (let i = 0; i < contrasted.length; i++) {
        finalData[i] = contrasted[i] > otsuThresh ? 255 : 0;
      }
    }

    // Convert back to RGBA
    for (let i = 0; i < finalData.length; i++) {
      const val = finalData[i];
      data[i * 4] = val;
      data[i * 4 + 1] = val;
      data[i * 4 + 2] = val;
      data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private medianFilter(gray: Uint8ClampedArray, width: number, height: number, radius: number = 2): Uint8Array {
    const filtered = new Uint8Array(gray.length);
    const kernel: number[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        kernel.length = 0;

        // Collect neighbors
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            kernel.push(gray[ny * width + nx]);
          }
        }

        // Find median
        kernel.sort((a, b) => a - b);
        const mid = kernel.length >> 1;
        filtered[y * width + x] = kernel.length % 2 ? kernel[mid] : (kernel[mid - 1] + kernel[mid]) / 2;
      }
    }

    return filtered;
  }

  private calculateOtsuThreshold(gray: Uint8Array): number {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) {
      histogram[gray[i]]++;
    }

    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0, countB = 0;
    let maxVariance = 0, threshold = 0;

    for (let t = 0; t < 256; t++) {
      countB += histogram[t];
      if (countB === 0) continue;

      const countW = total - countB;
      if (countW === 0) break;

      sumB += t * histogram[t];
      const meanB = sumB / countB;
      const meanW = (sum - sumB) / countW;

      const variance = countB * countW * (meanB - meanW) * (meanB - meanW);
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    return threshold;
  }

  private processImage(img: HTMLImageElement, scale: number, contrast: number, threshold: number): HTMLCanvasElement {
    return this.processImageAdvanced(img, scale, contrast, threshold, false);
  }

  async toggleCamera() {
    if (this.cameraActive()) {
      this.stopCamera();
    } else {
      this.startCamera();
    }
  }

  async startCamera() {
    try {
      this.lastError.set(null);
      const video = this.videoElement()?.nativeElement;
      if (!video) return;

      if (!this.codeReader) {
        this.codeReader = new BrowserMultiFormatReader();
      }

      // Use ZXing's built-in camera scanning (better for real-time)
      this.codeReader.decodeFromVideoDevice(undefined, video, (result, err) => {
        if (result) {
          const text = (result as any).getText?.() || (result as any).text || result.toString();
          const format = (result as any).getFormatName?.() || (result as any).format?.toString() || 'BARCODE';

          // Check if already scanned
          const isDuplicate = this.scannedCodes().some(c => c.data === text && c.format === format);
          if (!isDuplicate) {
            this.scannedCodes.update(codes => [
              ...codes,
              { format, data: text, timestamp: new Date() }
            ]);
          }
        }
      });

      this.cameraActive.set(true);
    } catch (err: any) {
      this.lastError.set('Camera: ' + (err.message || 'access denied'));
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  captureFromCamera() {
    const video = this.videoElement()?.nativeElement;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      this.previewImage.set(canvas.toDataURL());
      setTimeout(() => this.scanImage(), 300);
    }
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  downloadResults() {
    const data = this.scannedCodes()
      .map((c, i) => `[${i+1}] ${c.format}\n${c.data}`)
      .join('\n\n---\n\n');
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf417-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearResults() {
    this.scannedCodes.set([]);
  }

  clearPreview() {
    this.previewImage.set(null);
  }

  parseAamva(rawData: string) {
    try {
      if (!rawData.trim()) {
        this.lastError.set('Empty data');
        return;
      }

      // Parse AAMVA data using aamva-parser
      const result = Parse(rawData);

      if (result) {
        this.aamvaParsed.set(result as any);

        // Also add to scanned codes as structured data
        this.scannedCodes.update(codes => [
          ...codes,
          {
            format: 'AAMVA',
            data: JSON.stringify(result, null, 2),
            timestamp: new Date()
          }
        ]);

        this.lastError.set(null);
      } else {
        this.lastError.set('Invalid AAMVA format');
      }
    } catch (err: any) {
      this.lastError.set('Parse error: ' + (err.message || 'Unknown'));
    }
  }

  onAamvaPaste(event: ClipboardEvent) {
    const data = event.clipboardData?.getData('text') || '';
    if (data) {
      this.aamvaInput.set(data);
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }

  getFormatColor(format: string): string {
    const colors: Record<string, string> = {
      'PDF417': '#00ff41', 'QR_CODE': '#00bfff',
      'CODE_128': '#ff1493', 'CODE_39': '#ffa500',
      'AAMVA': '#00ff41',
    };
    return colors[format] || '#00ff41';
  }
}
