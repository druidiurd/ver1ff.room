import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppStore {
  private http = inject(HttpClient);

  // Global State
  loading = signal<boolean>(false);
  selectedApp = signal<string | null>(null);
  schema = signal<any[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal<boolean>(false);
  selectedFile = signal<File | null>(null);
  mrzData = signal<any>(null);
  previewUrl = signal<string | null>(null);

  // Computed Selectors (Fixed TS2339) [cite: 2026-03-16]
  isMediaApp = computed(() => ['exif_cleaner', 'face_cut', 'ai_refiner'].includes(this.selectedApp() || ''));
  hasPreview = computed(() => ['face_cut', 'ai_refiner'].includes(this.selectedApp() || ''));
  requiresFile = computed(() => this.isMediaApp());

  // Actions
  openApp(name: string) {
    this.selectedApp.set(name);
    this.http.get<any[]>(`/api/schema/${name}`).subscribe(s => {
      this.schema.set(s);
      this.lines.set(new Array(s.length).fill(''));
    });
  }

  closeApp() {
    this.selectedApp.set(null);
    this.selectedFile.set(null);
    this.mrzData.set(null);
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.previewUrl.set(null);
  }

  // API Execution
  executeCommand(fd: FormData, isJson: boolean): Observable<any> {
    this.loading.set(true);
    return this.http.post('/api/execute', fd, {
      responseType: (isJson ? 'json' : 'blob') as 'json'
    }).pipe(finalize(() => this.loading.set(false)));
  }
}