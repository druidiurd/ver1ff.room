import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppStore {
  private http = inject(HttpClient);

  loading = signal<boolean>(false);
  selectedApp = signal<string | null>(null);
  schema = signal<any[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal<boolean>(false);
  
  // Single mode files
  selectedFile = signal<File | null>(null);
  mrzData = signal<any>(null);
  previewUrl = signal<string | null>(null);

  // Batch mode files (AI_BYPASS) [cite: 2026-02-21]
  batchFiles = signal<File[]>([]);
  batchUrls = signal<string[]>([]);
  bypassResults = signal<any[]>([]); 

  isMediaApp = computed(() => ['exif_cleaner', 'face_cut', 'ai_bypass'].includes(this.selectedApp() || ''));
  hasPreview = computed(() => ['face_cut'].includes(this.selectedApp() || ''));
  requiresFile = computed(() => this.isMediaApp());

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
    this.bypassResults.set([]);
    this.batchFiles.set([]);
    
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.previewUrl.set(null);
    
    this.batchUrls().forEach(url => URL.revokeObjectURL(url));
    this.batchUrls.set([]);
  }

  executeCommand(fd: FormData, isJson: boolean): Observable<any> {
    this.loading.set(true);
    return this.http.post('/api/execute', fd, {
      responseType: (isJson ? 'json' : 'blob') as 'json'
    }).pipe(finalize(() => this.loading.set(false)));
  }

  // Для пакетної обробки без глобального лоадера [cite: 2026-02-05]
  executeSilent(fd: FormData, isJson: boolean): Observable<any> {
    return this.http.post('/api/execute', fd, {
      responseType: (isJson ? 'json' : 'blob') as 'json'
    });
  }
}