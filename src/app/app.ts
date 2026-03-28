import { Component, inject, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStore } from './store';
import { DashboardComponent } from './components/dashboard';
import { TerminalComponent } from './components/terminal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent, TerminalComponent],
  template: `
    <canvas #matrixCanvas id="matrix-bg"></canvas>

    <div class="loader-overlay" *ngIf="store.loading() && !store.selectedApp()">
      <div class="spinner"></div><div class="txt">SYNCING_CORE...</div>
    </div>

    <div class="v-os-root">
      <header class="dynamic-island">
        <span class="led pulse"></span>
        <span class="hud">V_OS_MODULAR_V13 // RAM: {{ ram }}MB</span>
      </header>

      <app-dashboard *ngIf="!store.selectedApp()"></app-dashboard>
      <app-terminal *ngIf="store.selectedApp()"></app-terminal>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100vw; height: 100vh; background: #000; overflow: hidden; font-family: 'Plus Jakarta Sans', sans-serif; }
    #matrix-bg { position: fixed; inset: 0; z-index: 1; opacity: 0.15; pointer-events: none; }
    
    .loader-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .spinner { width: 50px; height: 50px; border: 3px solid transparent; border-top-color: #00ff41; border-radius: 50%; animation: s 1s linear infinite; }
    @keyframes s { to { transform: rotate(360deg); } }
    .txt { color: #00ff41; font-weight: 900; margin-top: 20px; letter-spacing: 5px; }

    .v-os-root { position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; align-items: center; padding: 40px; }
    
    .dynamic-island { background: rgba(10,10,10,0.9); border: 1px solid rgba(255,255,255,0.1); padding: 12px 40px; border-radius: 50px; display: flex; align-items: center; gap: 20px; box-shadow: 0 20px 50px #000; margin-bottom: 50px; backdrop-filter: blur(20px); }
    .led { width: 10px; height: 10px; border-radius: 50%; background: #00ff41; box-shadow: 0 0 15px #00ff41; }
    .pulse { animation: p 2s infinite; } @keyframes p { 50% { opacity: 0.2; } }
    .hud { color: #666; font-weight: 900; font-size: 0.75rem; letter-spacing: 2px; }
  `]
})
export class App implements AfterViewInit {
  store = inject(AppStore);
  ram = 128;
  @ViewChild('matrixCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit() {
    this.initMatrix();
    setInterval(() => this.ram = Math.floor(Math.random() * (260 - 210) + 210), 3000);
  }

  private initMatrix() {
    const canvas = this.canvasRef.nativeElement; const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const drops = new Array(Math.floor(canvas.width / 18)).fill(1);
    setInterval(() => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff41"; ctx.font = "16px monospace";
      drops.forEach((y, i) => {
        ctx.fillText(Math.floor(Math.random()*2).toString(), i * 18, y * 18);
        if (y * 18 > canvas.height && Math.random() > 0.985) drops[i] = 0; drops[i]++;
      });
    }, 50);
  }
}