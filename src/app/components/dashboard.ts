import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AppStore } from '../store';
import { I18nService } from '../services/i18n';

interface NavItem { id: string; group: string; }
interface ChangelogEntry { version: string; date: string; title: string; items: string[]; }

const NAV: NavItem[] = [
  { id: 'id_lab',       group: 'ID LAB' },
  { id: 'mrz_gen',      group: 'GLOBAL' },
  { id: 'revolut',      group: 'GLOBAL' },
  { id: 'exif_cleaner', group: 'TOOLS'  },
  { id: 'face_cut',     group: 'TOOLS'  },
  { id: 'ai_bypass',    group: 'TOOLS'  },
];

const ICONS: Record<string, string> = {
  id_lab: '🧪', mrz_gen: '🔏', revolut: '💳',
  exif_cleaner: '📸', face_cut: '👤', ai_bypass: '🥷',
};

const COLORS: Record<string, string> = {
  id_lab: '#00ff41', mrz_gen: '#00ff41', revolut: '#7c3aed',
  exif_cleaner: '#ff9500', face_cut: '#ff3b30', ai_bypass: '#a855f7',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dash fade-in">
      <div class="dash-header">
        <div class="dash-header-row">
          <div>
            <h1 class="dash-title mono">{{ i18n.t().brand }}</h1>
            <p class="dash-sub mono">{{ i18n.t().selectModule }} // {{ total }} {{ i18n.t().nodesOnline(total) }}</p>
          </div>
          <button class="news-btn mono" (click)="toggleNews()" [class.active]="showNews()">
            <span class="news-icon">📡</span>
            <span class="news-label">UPDATES</span>
            @if (changelog().length > 0) {
              <span class="news-badge">{{ changelog().length }}</span>
            }
          </button>
        </div>
      </div>

      <!-- Changelog modal -->
      @if (showNews()) {
        <div class="news-backdrop" (click)="showNews.set(false)"></div>
        <div class="news-modal">
          <div class="news-modal-header">
            <span class="mono news-modal-title">// CHANGELOG</span>
            <button class="news-close mono" (click)="showNews.set(false)">✕</button>
          </div>
          <div class="news-modal-body">
            @for (entry of changelog(); track entry.version) {
              <div class="cl-entry">
                <div class="cl-meta">
                  <span class="cl-version mono">v{{ entry.version }}</span>
                  <span class="cl-date mono">{{ entry.date }}</span>
                  <span class="cl-title mono">{{ entry.title }}</span>
                </div>
                <ul class="cl-items">
                  @for (item of entry.items; track $index) {
                    <li class="mono cl-item">{{ item }}</li>
                  }
                </ul>
              </div>
            }
          </div>
        </div>
      }

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
    .dash-header-row {
      display: flex; align-items: flex-start;
      justify-content: space-between; gap: 16px;
    }
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

    /* News button */
    .news-btn {
      position: relative;
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-dim);
      font-size: 0.6rem; font-weight: 700; letter-spacing: 1px;
      cursor: pointer; transition: 0.15s; flex-shrink: 0;
    }
    .news-btn:hover, .news-btn.active {
      border-color: var(--green); color: var(--green);
    }
    .news-icon { font-size: 0.85rem; }
    .news-badge {
      background: var(--green); color: #000;
      font-size: 0.5rem; font-weight: 800;
      padding: 1px 5px; border-radius: 10px;
    }

    /* Backdrop */
    .news-backdrop {
      position: fixed; inset: 0; z-index: 400;
      background: rgba(0,0,0,0.5);
    }

    /* Modal */
    .news-modal {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 401;
      width: min(520px, 90vw);
      max-height: 70vh;
      background: var(--surface);
      border: 1px solid var(--border-green);
      border-radius: var(--radius);
      display: flex; flex-direction: column;
      box-shadow: 0 0 40px rgba(0,255,65,0.1);
    }
    .news-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .news-modal-title {
      font-size: 0.65rem; font-weight: 700;
      color: var(--green); letter-spacing: 3px;
    }
    .news-close {
      background: none; border: none; cursor: pointer;
      color: var(--text-dim); font-size: 0.75rem;
      padding: 4px 8px; border-radius: 4px;
      transition: 0.15s;
    }
    .news-close:hover { color: var(--text); background: var(--surface2); }

    .news-modal-body {
      overflow-y: auto; padding: 20px;
      display: flex; flex-direction: column; gap: 24px;
    }

    /* Changelog entry */
    .cl-entry { display: flex; flex-direction: column; gap: 10px; }
    .cl-meta {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .cl-version {
      font-size: 0.6rem; font-weight: 800;
      background: var(--green); color: #000;
      padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;
    }
    .cl-date {
      font-size: 0.55rem; color: var(--text-dim); letter-spacing: 1px;
    }
    .cl-title {
      font-size: 0.6rem; color: var(--text); font-weight: 700; letter-spacing: 1px;
    }
    .cl-items {
      margin: 0; padding: 0 0 0 0;
      list-style: none;
      display: flex; flex-direction: column; gap: 5px;
    }
    .cl-item {
      font-size: 0.6rem; color: var(--text-dim);
      letter-spacing: 0.5px; line-height: 1.5;
      padding-left: 14px; position: relative;
    }
    .cl-item::before {
      content: '›'; position: absolute; left: 0;
      color: var(--green);
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
      .news-label { display: none; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  store = inject(AppStore);
  i18n = inject(I18nService);
  router = inject(Router);
  http = inject(HttpClient);

  groups = [...new Set(NAV.map(n => n.group))];
  byGroup = (g: string) => NAV.filter(n => n.group === g);
  total = NAV.length;

  showNews = signal(false);
  changelog = signal<ChangelogEntry[]>([]);

  ngOnInit() {
    this.http.get<ChangelogEntry[]>('/changelog.json').subscribe({
      next: data => this.changelog.set(data),
      error: () => {}
    });
  }

  toggleNews() { this.showNews.set(!this.showNews()); }

  getIcon(id: string) { return ICONS[id] ?? '⬡'; }
  getColor(id: string) { return COLORS[id] ?? '#00ff41'; }

  open(id: string) {
    this.store.closeApp();
    this.store.selectedApp.set(id);
    if (id === 'id_lab') {
      this.router.navigate(['/id-lab']);
    } else {
      this.router.navigate(['/tool', id]);
    }
  }
}
