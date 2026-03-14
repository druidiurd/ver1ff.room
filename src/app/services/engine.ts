import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EngineService {
  private http = inject(HttpClient);
  
  loading = signal(false);
  error = signal<string | null>(null); // Сигнал для стану помилки [cite: 2026-02-05]

  run(type: string, lines: string[]) {
    this.loading.set(true);
    this.error.set(null); // Скидаємо перед новим запуском

    return this.http.post('/api/generate', { type, lines }, { responseType: 'blob' })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          // Сніфаємо помилку: якщо сервер лежить або 500
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