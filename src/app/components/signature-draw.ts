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

    // Seed based on surname for reproducible but unique signatures
    const seed = sn.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const rand = (offset: number) => {
      const val = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
      return val - Math.floor(val);
    };

    // ONE continuous stroke - the whole signature
    const signature: Stroke = {
      points: [],
      width: 3,
      color: '#000000'
    };

    // Total path length
    const totalLength = 600;
    const startX = 80;
    const startY = 160;

    // Generate continuous cursive path
    for (let i = 0; i <= 200; i++) {
      const t = i / 200; // 0..1

      // Character influence - each letter adds variation
      const charIdx = Math.floor(t * sn.length);
      const charCode = sn.charCodeAt(charIdx) || 65;

      // Base X progression (left to right)
      const baseX = startX + t * totalLength;

      // Multiple sine waves layered for organic cursive
      const wave1 = Math.sin(t * Math.PI * 3 + seed / 100) * 25;         // Main wave
      const wave2 = Math.sin(t * Math.PI * 7 + charCode / 50) * 12;      // Secondary wave
      const wave3 = Math.cos(t * Math.PI * 2 + seed / 200) * 8;          // Tertiary wave
      const wobble = Math.sin(t * 15 + rand(i) * 10) * 3;               // Micro-wobble

      // Y position (up/down oscillation)
      const baseY = startY + wave1 + wave2 + wave3 + wobble;

      // Add pressure variation (line width effect through point density)
      if (i % 2 === 0 || Math.random() > 0.3) {
        signature.points.push({
          x: Math.floor(baseX),
          y: Math.floor(baseY)
        });
      }
    }

    // Final flourish - sweeping tail without lifting pen
    const flourishStart = 200;
    const flourishLength = 40;
    const flourishControl = Math.floor(rand(500) * 80 + 30);
    const flourishDir = rand(600) > 0.5 ? 1 : -1;

    for (let i = 0; i <= flourishLength; i++) {
      const t = i / flourishLength;
      const baseX = startX + totalLength + t * 80;
      const baseY = startY + 20 * flourishDir +
                    Math.sin(t * Math.PI * 3) * 35 * flourishDir +
                    Math.cos(t * Math.PI) * 10;

      signature.points.push({
        x: Math.floor(baseX),
        y: Math.floor(baseY)
      });
    }

    this.strokes.set([signature]);
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
