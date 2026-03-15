import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EngineService {
  private http = inject(HttpClient);
  loading = signal<boolean>(false);

  getSchema(module: string): Observable<any[]> {
    return this.http.get<any[]>(`/api/schema/${module}`);
  }

  /** Уніфікований FormData шлюз з фіксом перевантажень TS [cite: 2026-03-16] */
  execute(fd: FormData, isJson: boolean): Observable<any> {
    this.loading.set(true);
    const options = {
      // Senior Fix: кастуємо динамічний responseType до 'json', щоб задовольнити HttpClient [cite: 2026-03-16]
      responseType: (isJson ? 'json' : 'blob') as 'json'
    };
    return this.http.post('/api/execute', fd, options).pipe(
      finalize(() => this.loading.set(false))
    );
  }
}