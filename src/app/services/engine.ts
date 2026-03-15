import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EngineService {
  private http = inject(HttpClient);
  
  loading = signal(false);
  error = signal<string | null>(null);

  /**
   * Виконання генерації PDF через API.
   * @param type - Тип документа (напр. 'energia')
   * @param lines - Масив рядків для заповнення
   * @param scanMode - Чи застосовувати ефект артефактів сканування [cite: 2026-02-21]
   */
  run(type: string, lines: string[], scanMode: boolean) {
    this.loading.set(true);
    this.error.set(null);

    // Шлемо всі три параметри на Vercel Python Function [cite: 2026-02-21]
    return this.http.post('/api/generate', { type, lines, scan_mode: scanMode }, { responseType: 'blob' })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const msg = err.status === 0 ? 'CONNECTION_LOST' : `SERVER_ERROR_CODE_${err.status}`;
          this.error.set(msg);
          return throwError(() => new Error(msg));
        }),
        finalize(() => this.loading.set(false))
      );
  }

  clearError() {
    this.error.set(null);
  }
}