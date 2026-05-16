import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppStore } from '../store';
import { I18nService } from '../services/i18n';

interface NavItem { id: string; group: string; }

const NAV: NavItem[] = [
  { id: 'energia',      group: 'IRELAND'     },
  { id: 'ndls_mrz',    group: 'IRELAND'     },
  { id: 'nld_mrz',     group: 'NETHERLANDS' },
  { id: 'fra_mrz',     group: 'FRANCE'      },
  { id: 'exif_cleaner',group: 'TOOLS'       },
  { id: 'face_cut',    group: 'TOOLS'       },
  { id: 'ai_bypass',   group: 'TOOLS'       },
  { id: 'revolut',     group: 'GLOBAL'      },
];

const ICONS: Record<string, string> = {
  energia: '⚡', ndls_mrz: '🆔', revolut: '💳',
  nld_mrz: '🇳🇱', fra_mrz: '🇫🇷',
  exif_cleaner: '📸', face_cut: '👤', ai_bypass: '🥷',
};

const COLORS: Record<string, string> = {
  energia: '#00ff41', ndls_mrz: '#007aff', revolut: '#7c3aed',
  nld_mrz: '#ff9500', fra_mrz: '#007aff',
  exif_cleaner: '#ff9500', face_cut: '#ff3b30', ai_bypass: '#a855f7',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dash fade-in">
      <div class="dash-header">
        <h1 class="dash-title mono">{{ i18n.t().brand }}</h1>
        <p class="dash-sub mono">{{ i18n.t().selectModule }} // {{ total }} {{ i18n.t().nodesOnline(total) }}</p>
      </div>

      <div class="groups">
        @for (group of groups; track group) {
          <div class="group">
            <div class="group-header">
              <span class="group-tag mono">{{ group }}</span>
              <span class="group-name mono">{{ i18n.group(group) }}</span>
              <div class="group-line"></div>
            </div>
            <div class="cards">
              @for (item of byGroup(group); track item.id) {
                <button class="card" (click)="open(item.id)" [style.--accent]="getColor(item.id)">
                  <div class="card-glow"></div>
                  <div class="card-icon">{{ getIcon(item.id) }}</div>
                  <div class="card-label mono">{{ i18n.module(item.id).label }}</div>
                  <div class="card-desc mono">{{ i18n.module(item.id).desc }}</div>
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
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
      display: flex; flex-direction: column; gap: 8px;
    }
    .card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .card:hover .card-glow { opacity: 1; }
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
    }
    .card-desc {
      font-size: 0.55rem; color: var(--text-dim);
      letter-spacing: 0.5px; line-height: 1.5;
      flex: 1;
    }
    .card-arrow {
      font-size: 0.75rem; color: var(--text-dim);
      transition: color 0.2s;
      align-self: flex-end;
    }

    @media (max-width: 767px) {
      .cards { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
      .dash-header { margin-bottom: 32px; }
      .card-desc { display: none; }
    }
  `]
})
export class DashboardComponent {
  store = inject(AppStore);
  i18n = inject(I18nService);
  router = inject(Router);

  groups = [...new Set(NAV.map(n => n.group))];
  byGroup = (g: string) => NAV.filter(n => n.group === g);
  total = NAV.length;

  getIcon(id: string) { return ICONS[id] ?? '⬡'; }
  getColor(id: string) { return COLORS[id] ?? '#00ff41'; }

  open(id: string) {
    this.store.closeApp();
    this.store.selectedApp.set(id);
    this.router.navigate(['/tool', id]);
  }
}
