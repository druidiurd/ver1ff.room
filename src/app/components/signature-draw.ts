import { Component, signal, viewChild, ElementRef, HostListener } from '@angular/core';
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
          <label class="sig-label">SURNAME (AUTO-GEN)</label>
          <input class="sig-input" type="text"
            [ngModel]="surname()" (ngModelChange)="surname.set($event)"
            placeholder="Enter surname for auto-sig"
            (keyup.enter)="generateSignature()">
          <button class="sig-btn" (click)="generateSignature()" [disabled]="!surname()" title="Generate signature from surname">
            ✎ GEN SIG
          </button>
        </div>

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

    .sig-input {
      padding: 4px 8px; background: rgba(0,0,0,0.4);
      border: 1px solid rgba(0,255,65,0.3); border-radius: 4px;
      color: var(--text); font-size: 0.75rem;
      outline: none; width: 150px;
    }
    .sig-input:focus {
      border-color: rgba(0,255,65,0.6); background: rgba(0,0,0,0.5);
    }
    .sig-input::placeholder {
      color: rgba(255,255,255,0.3);
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
  brushSize = signal(3);
  brushColor = signal('#000000');
  previewStroke = signal<Stroke | null>(null);
  surname = signal('');

  svgCanvas = viewChild<ElementRef>('svgCanvas');

  private isDrawing = false;
  private currentStroke: Stroke | null = null;

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    // Ctrl+Z (Cmd+Z on Mac) works on ANY keyboard layout
    if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyZ' || event.keyCode === 90)) {
      event.preventDefault();
      this.undo();
    }
  }

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

  generateSignature() {
    const sn = this.surname().toUpperCase().trim();
    if (!sn) return;

    this.clear();

    // Seed based on surname hash
    const seed = sn.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const seededRandom = (index: number) => {
      const x = Math.sin(seed + index) * 10000;
      return x - Math.floor(x);
    };

    // Main signature stroke
    const mainStroke: Stroke = {
      points: [],
      width: 3,
      color: '#000000'
    };

    // Generate more complex cursive signature
    const startX = 80;
    const startY = 150;
    const maxX = 750;
    const maxY = 300;

    // Character-based generation - each letter influences the signature
    let x = startX;
    let y = startY;
    let direction = 0;

    for (let i = 0; i < sn.length * 50 + 100; i++) {
      const charInfluence = sn.charCodeAt(Math.floor(i / 50) % sn.length) || 65;
      const phase = (seed + i + charInfluence) / 100;

      // Multi-layered sine waves for organic curves
      const wave1 = Math.sin(phase * 0.5) * 40;
      const wave2 = Math.cos(phase * 1.2) * 30;
      const wave3 = Math.sin(phase * 0.3 + charInfluence / 100) * 50;

      // Add some wobble for authenticity
      const wobble = Math.sin(phase * 2 + seededRandom(i)) * 15;

      x += (wave1 + wave2 + wobble) * 0.3;
      y += wave3 * 0.2 + Math.sin(phase * 1.5) * 25;

      // Keep within bounds with slight overshoot
      if (x > maxX) x = maxX - 50 - Math.abs(wave1);
      if (x < startX) x = startX + 50;
      if (y > maxY - 50) y = maxY - 100 + Math.sin(phase) * 30;
      if (y < startY - 80) y = startY - 40;

      mainStroke.points.push({ x: Math.floor(x), y: Math.floor(y) });
    }

    this.strokes.update(s => [...s, mainStroke]);

    // Add flourish (decorative line at end)
    if (Math.random() > 0.4) {
      const flourish: Stroke = {
        points: [],
        width: 2,
        color: '#1a1a1a'
      };

      const flourishStartX = x - 50;
      const flourishStartY = y + 20;
      const flourishLength = 100 + seededRandom(sn.length) * 50;

      for (let i = 0; i < 30; i++) {
        const t = i / 30;
        const fx = flourishStartX + t * flourishLength;
        const fy = flourishStartY + Math.sin(t * Math.PI * 2) * 15;
        flourish.points.push({ x: Math.floor(fx), y: Math.floor(fy) });
      }

      this.strokes.update(s => [...s, flourish]);
    }
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
