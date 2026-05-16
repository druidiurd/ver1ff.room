import { Component, inject } from '@angular/core';
import { AppStore } from '../store';

interface AppCard { id: string; icon: string; label: string; color: string; }
interface Group { name: string; tag: string; apps: AppCard[]; }

const GROUPS: Group[] = [
  {
    name: 'IRELAND', tag: 'IE',
    apps: [
      { id: 'energia',   icon: '⚡', label: 'IE-BILL-GEN',  color: '#00ff41' },
      { id: 'ndls_mrz',  icon: '🆔', label: 'IE-NDLS-MRZ',  color: '#007aff' },
      { id: 'revolut',   icon: '💳', label: 'REVOLUT-STMT', color: '#7c3aed' },
    ]
  },
  {
    name: 'NETHERLANDS', tag: 'NL',
    apps: [
      { id: 'nld_mrz', icon: '🇳🇱', label: 'NL-ID-MRZ', color: '#ff9500' },
    ]
  },
  {
    name: 'FRANCE', tag: 'FR',
    apps: [
      { id: 'fra_mrz', icon: '🇫🇷', label: 'FR-CNI-MRZ', color: '#007aff' },
    ]
  },
  {
    name: 'GLOBAL TOOLS', tag: 'SYS',
    apps: [
      { id: 'exif_cleaner', icon: '📸', label: 'EXIF-SNIPER',  color: '#ff9500' },
      { id: 'face_cut',     icon: '👤', label: 'FACE-VISION',  color: '#ff3b30' },
      { id: 'ai_bypass',    icon: '🥷', label: 'AI-STEALTH',   color: '#a855f7' },
    ]
  },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dash">
      <div class="dash-header">
        <h1 class="dash-title mono">VER1FF_ROOM</h1>
        <p class="dash-sub mono">SELECT_MODULE // {{ total }} NODES ONLINE</p>
      </div>

      <div class="groups">
        @for (group of groups; track group.name) {
          <div class="group">
            <div class="group-header">
              <span class="group-tag mono">{{ group.tag }}</span>
              <span class="group-name mono">{{ group.name }}</span>
              <div class="group-line"></div>
            </div>
            <div class="cards">
              @for (app of group.apps; track app.id) {
                <button class="card" (click)="store.openApp(app.id)"
                  [style.--accent]="app.color">
                  <div class="card-glow"></div>
                  <div class="card-icon">{{ app.icon }}</div>
                  <div class="card-label mono">{{ app.label }}</div>
                  <div class="card-arrow mono">→</div>
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dash { max-width: 900px; margin: 0 auto; }

    .dash-header { margin-bottom: 48px; }
    .dash-title {
      font-size: clamp(1.6rem, 4vw, 2.4rem);
      font-weight: 800; color: var(--green);
      letter-spacing: 6px;
      text-shadow: 0 0 30px var(--green-glow);
      margin-bottom: 8px;
    }
    .dash-sub {
      font-size: 0.65rem; color: var(--text-dim);
      letter-spacing: 3px;
    }

    .groups { display: flex; flex-direction: column; gap: 40px; }

    .group-header {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 16px;
    }
    .group-tag {
      font-size: 0.55rem; font-weight: 700;
      background: var(--green); color: #000;
      padding: 3px 8px; border-radius: 4px;
      letter-spacing: 1px;
    }
    .group-name {
      font-size: 0.65rem; font-weight: 700;
      color: var(--text-dim); letter-spacing: 3px;
    }
    .group-line {
      flex: 1; height: 1px;
      background: linear-gradient(to right, var(--border-green), transparent);
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }

    .card {
      position: relative; overflow: hidden;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 18px;
      cursor: pointer; text-align: left;
      transition: border-color 0.2s, transform 0.15s;
      display: flex; flex-direction: column; gap: 10px;
    }
    .card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .card:hover .card-glow {
      opacity: 1;
    }
    .card:hover .card-arrow { color: var(--accent); }

    .card-glow {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%);
      opacity: 0; transition: opacity 0.3s;
      pointer-events: none;
    }

    .card-icon { font-size: 1.6rem; }
    .card-label {
      font-size: 0.6rem; font-weight: 700;
      color: var(--text); letter-spacing: 2px;
      flex: 1;
    }
    .card-arrow {
      font-size: 0.75rem; color: var(--text-dim);
      transition: color 0.2s;
      align-self: flex-end;
    }

    @media (max-width: 767px) {
      .cards { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
      .dash-header { margin-bottom: 32px; }
    }
  `]
})
export class DashboardComponent {
  store = inject(AppStore);
  groups = GROUPS;
  total = GROUPS.reduce((s, g) => s + g.apps.length, 0);
}
