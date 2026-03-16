import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStore } from '../store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="springboard fade-in">
      <div class="folder glass">
        <div class="f-header"><span class="f-tag">SEC</span><h2 class="f-name">IRELAND_NODES</h2></div>
        <div class="app-grid">
          <div class="app-card" (click)="store.openApp('energia')"><div class="icon glass-inset neon-green">⚡</div><span class="label">IE-bill-gen</span></div>
          <div class="app-card" (click)="store.openApp('ndls_mrz')"><div class="icon glass-inset neon-blue">🆔</div><span class="label">IE-NDLS-MRZ</span></div>
        </div>
      </div>

      <div class="folder glass">
        <div class="f-header"><span class="f-tag">SYS</span><h2 class="f-name">GLOBAL_TOOLS</h2></div>
        <div class="app-grid">
          <div class="app-card" (click)="store.openApp('exif_cleaner')"><div class="icon glass-inset neon-amber">📸</div><span class="label">EXIF-Sniper</span></div>
          <div class="app-card" (click)="store.openApp('face_cut')"><div class="icon glass-inset neon-red">👤</div><span class="label">Face-Cut</span></div>
          <div class="app-card" (click)="store.openApp('ai_bypass')"><div class="icon glass-inset neon-purple">🥷</div><span class="label">AI-Stealth</span></div>
        </div>
      </div>
    </section>
  `,
  // ... styles залишаються без змін з минулого кроку
  styles: [`
    .fade-in { animation: fIn 0.4s ease-out; } @keyframes fIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .springboard { width: 100%; max-width: 950px; display: flex; gap: 40px; margin: 0 auto; }
    .folder { flex: 1; padding: 45px; border-radius: 45px; background: rgba(10,10,10,0.9); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(40px); }
    .f-header { display: flex; align-items: center; gap: 15px; margin-bottom: 40px; }
    .f-tag { background: #00ff41; color: #000; font-size: 0.6rem; font-weight: 900; padding: 4px 8px; border-radius: 4px; }
    .f-name { font-size: 1.1rem; font-weight: 900; color: #fff; letter-spacing: 4px; }
    .app-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 35px; }
    .app-card { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: 0.3s; }
    .app-card:hover { transform: scale(1.1) translateY(-5px); }
    .icon { width: 90px; height: 90px; border-radius: 28px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; background: rgba(20,20,20,0.8); border: 1px solid rgba(255,255,255,0.05); }
    .label { font-size: 0.75rem; font-weight: 800; color: #777; margin-top: 15px; text-transform: uppercase; }
    .neon-green { color: #00ff41; text-shadow: 0 0 15px rgba(0,255,65,0.5); }
    .neon-blue { color: #007aff; text-shadow: 0 0 15px rgba(0,122,255,0.5); }
    .neon-amber { color: #ff9500; text-shadow: 0 0 15px rgba(255,149,0,0.5); }
    .neon-red { color: #ff3b30; text-shadow: 0 0 15px rgba(255,59,48,0.5); }
    .neon-purple { color: #a855f7; text-shadow: 0 0 15px rgba(168,85,247,0.5); }
  `]
})
export class DashboardComponent {
  store = inject(AppStore);
}