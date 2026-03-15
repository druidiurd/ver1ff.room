import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EngineService {
  private http = inject(HttpClient);
  loading = signal(false);

  /** Отримання динамічної схеми полів з бекенду [cite: 2026-02-21] */
  getSchema(module: string) {
    return this.http.get<any[]>(`/api/schema/${module}`);
  }

  /** Універсальний запуск ядра [cite: 2026-02-21] */
  execute(type: string, lines: string[], scanMode: boolean) {
    this.loading.set(true);
    // Якщо модуль MRZ — чекаємо JSON, якщо PDF — чекаємо Blob [cite: 2026-02-05]
    const responseType = type === 'ndls_mrz' ? 'json' : 'blob';
    
    return this.http.post<any>('/api/execute', 
      { type, lines, scan_mode: scanMode }, 
      { responseType: responseType as any }
    ).pipe(finalize(() => this.loading.set(false)));
  }
}