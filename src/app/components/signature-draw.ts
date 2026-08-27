import { Component, signal, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Stroke {
  points: Array<{ x: number; y: number }>;
  width: number;
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
          <!-- Background rect for touch -->
          <rect width="800" height="300" fill="rgba(0,0,0,0.3)" rx="4"/>

          <!-- Strokes -->
          @for (stroke of strokes(); track $index) {
            <polyline [attr.points]="formatPoints(stroke.points)"
              fill="none"
              [attr.stroke]="'#00ff41'"
              stroke-linecap="round"
              stroke-linejoin="round"
              [attr.stroke-width]="stroke.width"/>
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
    .sig-value {
      font-size: 0.55rem; color: var(--text-mid); min-width: 35px;
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
      background: rgba(0,0,0,0.5); border: 1px solid rgba(0,255,65,0.25);
      border-radius: 6px; overflow: hidden; cursor: crosshair;
      touch-action: none;
    }
    .sig-svg {
      display: block; width: 100%; height: auto;
      background: linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2));
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
  brushSize = signal(2);
  copiedSvg = signal(false);

  svgCanvas = viewChild<ElementRef>('svgCanvas');

  private isDrawing = false;
  private currentStroke: Stroke | null = null;

  setBrushSize(val: any) {
    this.brushSize.set(parseInt(val, 10));
  }

  startStroke(evt: MouseEvent | TouchEvent) {
    evt.preventDefault();
    this.isDrawing = true;
    this.currentStroke = { points: [], width: this.brushSize() };
    this.addPoint(evt);
  }

  drawStroke(evt: MouseEvent | TouchEvent) {
    if (!this.isDrawing || !this.currentStroke) return;
    evt.preventDefault();
    this.addPoint(evt);
  }

  endStroke() {
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      this.strokes.update(s => [...s, this.currentStroke!]);
    }
    this.isDrawing = false;
    this.currentStroke = null;
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
        `<polyline points="${this.formatPoints(stroke.points)}" fill="none" stroke="#00ff41" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"/>`
      )
      .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" width="800" height="300">
${lines}
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

    // Draw strokes
    ctx.strokeStyle = '#00ff41';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of this.strokes()) {
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
