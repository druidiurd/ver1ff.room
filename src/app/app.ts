import { Component, signal, inject } from '@angular/core';
import { EngineService } from './services/engine';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container neu-convex" [class.system-failure]="engine.error()">
      <header>
        <div class="logo">VER1FF<span>.TOOLS</span></div>
        <p class="tagline">Anonymity is a right, not a privilege.</p>
      </header>

      @if (engine.error()) {
        <div class="error-zone">
          <div class="error-label">SYSTEM_BREACH_DETECTED</div>
          <div class="error-msg">{{ engine.error() }}</div>
          <button class="retry-btn" (click)="engine.clearError()">ACKNOWLEDGE_AND_RESET</button>
        </div>
      }

      <div class="form-grid" [class.blurred]="engine.error()">
        @for (line of lines(); track $index) {
          <div class="input-group neu-concave">
            <input [(ngModel)]="lines()[$index]" [placeholder]="'SECURE_DATA_FIELD_' + ($index + 1)" spellcheck="false">
          </div>
        }
      </div>

      <div class="actions">
        <button class="burn-btn" [disabled]="engine.loading() || engine.error()" (click)="burn()">
          <span class="btn-text">{{ engine.loading() ? 'ENCRYPTING...' : 'EXECUTE GENERATION' }}</span>
          <div class="btn-glow"></div>
        </button>
      </div>

      <footer>
        <code class="status" [class.err-text]="engine.error()">
          STATUS: {{ engine.error() ? 'CRITICAL_FAILURE' : (engine.loading() ? 'ACTIVE_PROCESS' : 'READY_TO_DEPLOY') }}
        </code>
      </footer>
    </div>
  `,
  styles: [`
    .container {
      width: 100%;
      max-width: 450px; /* Контейнер тепер адаптивний */
      margin: 20px;
      padding: 40px 25px;
      text-align: center;
      position: relative;
      border: 1px solid rgba(212, 175, 55, 0.1);
      z-index: 20;
    }

    .neu-convex {
      background: var(--surface);
      box-shadow: 10px 10px 20px var(--shadow-dark), -10px -10px 20px var(--shadow-light);
      border-radius: 30px;
    }

    .logo {
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--gold);
      text-shadow: 0 0 15px var(--gold-glow);
      margin-bottom: 5px;
    }

    .tagline { font-size: 0.65rem; opacity: 0.5; margin-bottom: 30px; letter-spacing: 1px; }

    .tool-selector { 
      display: flex; 
      gap: 12px; 
      margin-bottom: 30px; 
    }

    .tool-selector button {
      flex: 1;
      padding: 12px;
      border: none;
      background: var(--surface);
      color: #555;
      border-radius: 12px;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 0.6rem;
      font-weight: 800;
      transition: all 0.2s ease;
      box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
    }

    .tool-selector button.active { 
      color: var(--gold); 
      box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
    }

    .form-grid { 
      display: flex; 
      flex-direction: column; 
      gap: 20px; 
      margin-bottom: 40px; 
    }

    .input-group { 
      padding: 2px 15px; 
      background: var(--surface);
      box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
      border-radius: 12px;
    }

    input {
      width: 100%;
      background: transparent;
      border: none;
      padding: 15px 0;
      color: var(--gold);
      font-family: var(--font-mono);
      outline: none;
      font-size: 0.85rem;
    }

    .burn-btn {
      width: 100%;
      padding: 22px;
      border: none;
      background: var(--gold);
      color: #000;
      font-weight: 900;
      font-size: 0.9rem;
      border-radius: 18px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: transform 0.1s, box-shadow 0.2s;
      box-shadow: 0 10px 20px rgba(0,0,0,0.4);
    }

    .burn-btn:active { transform: scale(0.97); }

    .error-zone {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 100;
      width: 90%;
      padding: 30px;
      background: rgba(10, 10, 10, 0.98);
      border: 2px solid #ff4444;
      border-radius: 20px;
      backdrop-filter: blur(10px);
    }
  `]
})
export class App {
  engine = inject(EngineService);
  lines = signal<string[]>(new Array(6).fill(''));

  burn() {
    this.engine.run('energia', this.lines()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VER1FF_DOC_${Date.now()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        // Помилка вже оброблена сигналом у сервісі
      }
    });
  }
}