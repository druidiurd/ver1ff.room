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

  /** * Уніфікований метод для FormData з фіксом оверлоадів TS [cite: 2026-03-16]
   * Вирішує помилку TS2769 через примусове кастування типу
   */
  execute(fd: FormData, isJson: boolean): Observable<any> {
    this.loading.set(true);
    
    // Senior Fix: кастуємо динамічний responseType до any або 'json', 
    // щоб задовольнити сигнатуру HttpClient.post [cite: 2026-03-16]
    const options = {
      responseType: (isJson ? 'json' : 'blob') as 'json'
    };

    return this.http.post('/api/execute', fd, options).pipe(
      finalize(() => this.loading.set(false))
    );
  }
}