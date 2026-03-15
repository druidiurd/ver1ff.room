import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EngineService {
  private http = inject(HttpClient);
  loading = signal(false);

  getSchema(module: string) {
    return this.http.get<any[]>(`/api/schema/${module}`);
  }

  execute(type: string, lines: string[], scanMode: boolean) {
    this.loading.set(true);
    const responseType = type === 'ndls_mrz' ? 'json' : 'blob';
    return this.http.post<any>('/api/execute', { type, lines, scan_mode: scanMode }, { responseType: responseType as any })
      .pipe(finalize(() => this.loading.set(false)));
  }

  processFace(imageB64: string, padding: number) {
    return this.http.post<any>('/api/execute', { type: 'face_crop', image: imageB64, padding });
  }
}