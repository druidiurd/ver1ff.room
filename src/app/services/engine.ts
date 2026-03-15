import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EngineService {
  private http = inject(HttpClient);
  
  /** Стан завантаження ядра [cite: 2026-02-05] */
  loading = signal<boolean>(false);

  /** * Отримання динамічної схеми полів модуля 
   * [cite: 2026-02-21]
   */
  getSchema(module: string): Observable<any[]> {
    return this.http.get<any[]>(`/api/schema/${module}`);
  }

  /** * Стандартний запуск (JSON Payload) 
   * [cite: 2026-02-21]
   */
  execute(type: string, lines: string[], scanMode: boolean): Observable<any> {
    this.loading.set(true);
    const responseType = type === 'ndls_mrz' ? 'json' : 'blob';
    
    return this.http.post<any>('/api/execute', 
      { type, lines, scan_mode: scanMode }, 
      { responseType: responseType as any }
    ).pipe(
      finalize(() => this.loading.set(false))
    );
  }

  /** * UPLOAD EXECUTION: Для EXIF-Sniper та великих файлів
   * Вирішує помилку TS2339 [cite: 2026-03-15]
   */
  uploadExecute(fd: FormData): Observable<Blob> {
    this.loading.set(true);
    // Використовуємо responseType: 'blob', бо на виході завжди файл [cite: 2026-02-05]
    return this.http.post('/api/execute', fd, { 
      responseType: 'blob' 
    }).pipe(
      finalize(() => this.loading.set(false))
    );
  }
}