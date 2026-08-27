import { Component, signal, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Stroke {
  points: Array<{ x: number; y: number }>;
  width: number;
  color: string;
}

@Component({
  selector: 'app-signature-draw',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sig-container">
      <div class="sig-tools">
        <div class="sig-tool-group">
          <label class="sig-label">SIZE</label>
          <input class="sig-range" type="range" min="1" max="10"
            [ngModel]="brushSize()" (ngModelChange)="setBrushSize($event)">
          <span class="sig-value mono">{{ brushSize() }}px</span>
        </div>

        <div class="sig-tool-group">
          <label class="sig-label">COLOR</label>
          <input class="sig-color" type="color"
            [ngModel]="brushColor()" (ngModelChange)="brushColor.set($event)">
          <span class="sig-value mono" [style.color]="brushColor()">■</span>
        </div>

        <div class="sig-tool-group">
          <button class="sig-btn" (click)="undo()" [disabled]="strokes().length === 0" title="Undo last stroke">
            ↶ UNDO
          </button>
          <button class="sig-btn" (click)="clear()" [disabled]="strokes().length === 0" title="Clear all">
            🗑️ CLEAR
          </button>
        </div>

        <div class="sig-tool-group">
          <button class="sig-btn" (click)="downloadSVG()" [disabled]="strokes().length === 0">
            📥 SVG
          </button>
          <button class="sig-btn" (click)="downloadPNG()" [disabled]="strokes().length === 0">
            📥 PNG
          </button>
          <button class="sig-btn mono" (click)="copySVG()" [disabled]="strokes().length === 0">
            {{ copiedSvg() ? '✓' : '⎘ SVG' }}
          </button>
        </div>
      </div>

      <div class="sig-canvas-wrapper">
        <svg class="sig-svg"
          #svgCanvas
          [attr.viewBox]="'0 0 800 300'"
          [attr.width]="'800'"
          [attr.height]="'300'"
          (mousedown)="startStroke($event)"
          (mousemove)="drawStroke($event)"
          (mouseup)="endStroke()"
          (mouseleave)="endStroke()"
          (touchstart)="startStroke($event)"
          (touchmove)="drawStroke($event)"
          (touchend)="endStroke()">
          <defs>
            <!-- Checkerboard pattern for transparency indicator -->
            <pattern id="checker" x="20" y="20" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="10" height="10" fill="#f5f5f5"/>
              <rect x="10" y="0" width="10" height="10" fill="#d0d0d0"/>
              <rect x="0" y="10" width="10" height="10" fill="#d0d0d0"/>
              <rect x="10" y="10" width="10" height="10" fill="#f5f5f5"/>
            </pattern>
          </defs>

          <!-- White background for drawing visibility -->
          <rect width="800" height="300" fill="#ffffff" rx="4"/>
          <!-- Subtle checkerboard for transparency hint -->
          <rect width="800" height="300" fill="url(#checker)" opacity="0.15" rx="4"/>

          <!-- Strokes -->
          @for (stroke of strokes(); track $index) {
            <polyline [attr.points]="formatPoints(stroke.points)"
              fill="none"
              [attr.stroke]="stroke.color"
              stroke-linecap="round"
              stroke-linejoin="round"
              [attr.stroke-width]="stroke.width"/>
          }

          <!-- Preview stroke (real-time) -->
          @if (previewStroke(); as preview) {
            <polyline [attr.points]="formatPoints(preview.points)"
              fill="none"
              [attr.stroke]="preview.color"
              stroke-linecap="round"
              stroke-linejoin="round"
              [attr.stroke-width]="preview.width"
              opacity="0.7"/>
          }
        </svg>
      </div>

      <div class="sig-info mono">
        {{ strokes().length }} {{ strokes().length === 1 ? 'stroke' : 'strokes' }}
      </div>
    </div>
  `,
  styles: [`
    .sig-container {
      display: flex; flex-direction: column; gap: 12px;
      padding: 16px; background: rgba(0,0,0,0.3); border-radius: 8px;
    }

    /* Tools */
    .sig-tools {
      display: flex; gap: 12px; align-items: center;
      flex-wrap: wrap;
    }
    .sig-tool-group {
      display: flex; align-items: center; gap: 8px;
    }

    .sig-label {
      font-size: 0.55rem; color: var(--text-dim); letter-spacing: 1px;
    }
    .sig-range {
      width: 80px; height: 4px; cursor: pointer;
      accent-color: #00ff41;
    }
    .sig-color {
      width: 36px; height: 24px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 2px;
    }
    .sig-value {
      font-size: 0.55rem; color: var(--text-mid); min-width: 35px;
      font-size: 1rem; line-height: 1;
    }

    .sig-btn {
      background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3);
      color: #00ff41; font-size: 0.55rem; font-weight: 700;
      padding: 6px 10px; border-radius: 4px; cursor: pointer;
      transition: 0.15s; white-space: nowrap;
      font-family: 'Monaco', 'Courier New', monospace;
    }
    .sig-btn:hover:not(:disabled) {
      background: rgba(0,255,65,0.2); border-color: rgba(0,255,65,0.6);
    }
    .sig-btn:disabled {
      opacity: 0.4; cursor: not-allowed;
    }

    /* Canvas */
    .sig-canvas-wrapper {
      border: 1px solid rgba(0,255,65,0.35);
      border-radius: 6px; overflow: hidden; cursor: crosshair;
      touch-action: none;
    }
    .sig-svg {
      display: block; width: 100%; height: auto;
    }

    /* Info */
    .sig-info {
      font-size: 0.5rem; color: var(--text-dim); letter-spacing: 1px;
      text-align: right;
    }
  `]
})
export class SignatureDrawComponent {
  strokes = signal<Stroke[]>([]);
  brushSize = signal(4);
  brushColor = signal('#000000');
  copiedSvg = signal(false);
  previewStroke = signal<Stroke | null>(null);

  svgCanvas = viewChild<ElementRef>('svgCanvas');

  private isDrawing = false;
  private currentStroke: Stroke | null = null;

  setBrushSize(val: any) {
    this.brushSize.set(parseInt(val, 10));
  }

  startStroke(evt: MouseEvent | TouchEvent) {
    evt.preventDefault();
    this.isDrawing = true;
    this.currentStroke = { points: [], width: this.brushSize(), color: this.brushColor() };
    this.addPoint(evt);
    this.updatePreview();
  }

  drawStroke(evt: MouseEvent | TouchEvent) {
    if (!this.isDrawing || !this.currentStroke) return;
    evt.preventDefault();
    this.addPoint(evt);
    this.updatePreview();
  }

  endStroke() {
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      this.strokes.update(s => [...s, this.currentStroke!]);
    }
    this.isDrawing = false;
    this.currentStroke = null;
    this.previewStroke.set(null);
  }

  private updatePreview() {
    if (this.currentStroke) {
      this.previewStroke.set({ ...this.currentStroke });
    }
  }

  private addPoint(evt: MouseEvent | TouchEvent) {
    if (!this.currentStroke) return;

    const canvas = this.svgCanvas()?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = evt instanceof MouseEvent ? evt.clientX : evt.touches[0].clientX;
    const clientY = evt instanceof MouseEvent ? evt.clientY : evt.touches[0].clientY;

    const x = ((clientX - rect.left) / rect.width) * 800;
    const y = ((clientY - rect.top) / rect.height) * 300;

    // Smooth drawing: only add point if moved enough
    const last = this.currentStroke.points[this.currentStroke.points.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 1) {
      this.currentStroke.points.push({ x, y });
    }
  }

  formatPoints(points: Array<{ x: number; y: number }>): string {
    return points.map(p => `${p.x},${p.y}`).join(' ');
  }

  undo() {
    this.strokes.update(s => s.slice(0, -1));
  }

  clear() {
    this.strokes.set([]);
  }

  private generateSVG(): string {
    const lines = this.strokes()
      .map(stroke =>
        `<polyline points="${this.formatPoints(stroke.points)}" fill="none" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" width="800" height="300">
<g>
${lines}
</g>
</svg>`;
  }

  copySVG() {
    const svg = this.generateSVG();
    navigator.clipboard.writeText(svg);
    this.copiedSvg.set(true);
    setTimeout(() => this.copiedSvg.set(false), 1500);
  }

  downloadSVG() {
    const svg = this.generateSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signature-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadPNG() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw strokes with their colors
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of this.strokes()) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();

      for (let i = 0; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signature-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
