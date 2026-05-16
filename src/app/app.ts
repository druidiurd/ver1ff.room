import { Component, inject, AfterViewInit, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStore } from './store';
import { DashboardComponent } from './components/dashboard';
import { TerminalComponent } from './components/terminal';

interface NavItem { id: string; icon: string; label: string; group: string; }

const NAV: NavItem[] = [
  { id: 'energia',    icon: '⚡', label: 'IE-Bill',     group: 'IRELAND'  },
  { id: 'ndls_mrz',  icon: '🆔', label: 'IE-MRZ',      group: 'IRELAND'  },
  { id: 'revolut',   icon: '💳', label: 'Revolut',     group: 'IRELAND'  },
  { id: 'nld_mrz',   icon: '🇳🇱', label: 'NL-MRZ',      group: 'NETHERLANDS' },
  { id: 'fra_mrz',   icon: '🇫🇷', label: 'FR-MRZ',      group: 'FRANCE'   },
  { id: 'exif_cleaner', icon: '📸', label: 'EXIF',      group: 'TOOLS'    },
  { id: 'face_cut',  icon: '👤', label: 'Face-Cut',    group: 'TOOLS'    },
  { id: 'ai_bypass', icon: '🥷', label: 'AI-Stealth',  group: 'TOOLS'    },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent, TerminalComponent],
  template: `
    <canvas #mc id="matrix-bg"></canvas>

    <!-- Mobile topbar -->
    <header class="topbar">
      <button class="burger" (click)="drawerOpen.set(!drawerOpen())">
        <span></span><span></span><span></span>
      </button>
      <div class="topbar-brand mono">
        <span class="brand-dot"></span>VER1FF_ROOM
      </div>
      <div class="topbar-hud mono">RAM:{{ ram }}MB</div>
    </header>

    <!-- Mobile drawer backdrop -->
    <div class="drawer-backdrop" [class.open]="drawerOpen()" (click)="drawerOpen.set(false)"></div>

    <div class="layout">
      <!-- Sidebar -->
      <nav class="sidebar" [class.drawer-open]="drawerOpen()">
        <div class="sidebar-brand mono">
          <span class="brand-dot"></span>
          <span>VER1FF_ROOM</span>
        </div>

        <div class="nav-scroll">
          @for (group of groups; track group) {
            <div class="nav-group">
              <span class="nav-group-label mono">{{ group }}</span>
              @for (item of byGroup(group); track item.id) {
                <button class="nav-item" [class.active]="store.selectedApp() === item.id"
                  (click)="open(item.id)">
                  <span class="nav-icon">{{ item.icon }}</span>
                  <span class="nav-label mono">{{ item.label }}</span>
                  @if (store.selectedApp() === item.id) {
                  <span class="nav-active-bar"></span>
                }
                </button>
              }
            </div>
          }
        </div>

        <div class="sidebar-footer mono">
          <span class="led"></span>SYS_ONLINE
        </div>
      </nav>

      <!-- Workspace -->
      <main class="workspace">
        <div class="workspace-inner fade-in">
          @if (!store.selectedApp()) {
            <app-dashboard></app-dashboard>
          } @else {
            <app-terminal></app-terminal>
          }
        </div>
      </main>
    </div>

    <!-- Global loader -->
    @if (store.loading() && !store.selectedApp()) {
      <div class="g-loader">
        <div class="g-spinner"></div>
        <div class="mono g-txt">SYNCING_CORE...</div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    #matrix-bg {
      position: fixed; inset: 0; z-index: 1;
      opacity: 0.07; pointer-events: none;
    }

    /* ── TOPBAR (mobile only) ── */
    .topbar {
      display: none;
      position: fixed; top: 0; left: 0; right: 0;
      height: var(--topbar-h);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(20px);
      align-items: center;
      padding: 0 16px;
      gap: 12px;
      z-index: 200;
    }
    .burger {
      background: none; border: none; cursor: pointer;
      display: flex; flex-direction: column; gap: 5px; padding: 4px;
    }
    .burger span {
      display: block; width: 20px; height: 1.5px;
      background: var(--green); border-radius: 2px;
    }
    .topbar-brand {
      flex: 1; font-size: 0.75rem; font-weight: 700;
      color: var(--green); letter-spacing: 2px;
      display: flex; align-items: center; gap: 8px;
    }
    .topbar-hud {
      font-size: 0.6rem; color: var(--text-dim); letter-spacing: 1px;
    }

    /* ── DRAWER BACKDROP ── */
    .drawer-backdrop {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      z-index: 299;
    }

    /* ── LAYOUT ── */
    .layout {
      position: fixed; inset: 0; z-index: 10;
      display: flex;
    }

    /* ── SIDEBAR ── */
    .sidebar {
      width: var(--sidebar-w);
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .sidebar-brand {
      padding: 28px 20px 20px;
      font-size: 0.7rem; font-weight: 700;
      color: var(--green); letter-spacing: 3px;
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid var(--border);
    }
    .nav-scroll {
      flex: 1; overflow-y: auto; padding: 12px 0;
    }
    .nav-group { margin-bottom: 8px; }
    .nav-group-label {
      display: block;
      font-size: 0.55rem; font-weight: 700;
      color: var(--text-dim); letter-spacing: 2px;
      padding: 12px 20px 6px;
    }
    .nav-item {
      position: relative;
      width: 100%; display: flex; align-items: center; gap: 10px;
      padding: 9px 20px;
      background: none; border: none; cursor: pointer;
      color: var(--text-mid); transition: color 0.15s, background 0.15s;
      text-align: left;
    }
    .nav-item:hover { color: var(--text); background: rgba(255,255,255,0.03); }
    .nav-item.active { color: var(--green); background: var(--green-dim); }
    .nav-icon { font-size: 1rem; width: 20px; text-align: center; }
    .nav-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 1px; }
    .nav-active-bar {
      position: absolute; right: 0; top: 4px; bottom: 4px;
      width: 2px; background: var(--green);
      border-radius: 2px 0 0 2px;
      box-shadow: 0 0 8px var(--green-glow);
    }
    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      font-size: 0.6rem; color: var(--text-dim);
      letter-spacing: 2px;
      display: flex; align-items: center; gap: 8px;
    }

    /* ── WORKSPACE ── */
    .workspace {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      display: flex; flex-direction: column;
    }
    .workspace-inner {
      flex: 1; padding: 32px;
      min-height: 100%;
    }

    /* ── SHARED ── */
    .brand-dot, .led {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
      flex-shrink: 0;
      animation: pulse-green 2s infinite;
    }

    /* ── GLOBAL LOADER ── */
    .g-loader {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 20px;
    }
    .g-spinner {
      width: 40px; height: 40px;
      border: 2px solid var(--border);
      border-top-color: var(--green);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .g-txt { font-size: 0.7rem; color: var(--green); letter-spacing: 4px; }

    /* ── MOBILE ── */
    @media (max-width: 767px) {
      .topbar { display: flex; }
      .layout { top: var(--topbar-h); }
      .sidebar {
        position: fixed; left: 0; top: var(--topbar-h); bottom: 0;
        z-index: 300;
        transform: translateX(-100%);
        transition: transform 0.25s ease;
        width: 260px;
      }
      .sidebar.drawer-open { transform: translateX(0); }
      .drawer-backdrop.open { display: block; }
      .sidebar-brand { display: none; }
      .workspace-inner { padding: 16px; }
    }
  `]
})
export class App implements AfterViewInit {
  store = inject(AppStore);
  ram = 210;
  drawerOpen = signal(false);

  @ViewChild('mc') canvasRef!: ElementRef<HTMLCanvasElement>;

  groups = [...new Set(NAV.map(n => n.group))];
  byGroup = (g: string) => NAV.filter(n => n.group === g);

  open(id: string) {
    this.store.openApp(id);
    this.drawerOpen.set(false);
  }

  ngAfterViewInit() {
    this.initMatrix();
    setInterval(() => this.ram = Math.floor(Math.random() * 50 + 210), 3000);
  }

  private initMatrix() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const drops: number[] = [];
    const cols = Math.floor(canvas.width / 20);
    for (let i = 0; i < cols; i++) drops[i] = Math.random() * -50;
    setInterval(() => {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff41';
      ctx.font = '13px JetBrains Mono';
      drops.forEach((y, i) => {
        ctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), i * 20, y * 20);
        if (y * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 0.5;
      });
    }, 60);
  }
}
