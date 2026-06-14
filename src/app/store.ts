import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable } from 'rxjs';

export interface SchemaField {
  id: string;
  label: string;
  p: string;
  type?: 'text' | 'select' | 'range';
  opts?: string[];
  min?: number;
  max?: number;
  desc?: string;
}

export interface MrzData {
  GEN_2_ISO?: string;
  GEN_1_LEGACY?: string;
  L1?: string;
  L2?: string;
  L3?: string;
  STATUS?: 'SYNC_OK' | 'VALIDATION_ERR';
  ERR_MSG?: string;
}

export interface MrzGenResult {
  STATUS: string;
  DOC_TYPE?: string;
  MRP?: string[];
  TD1?: string[];
  TD2?: string[];
  MRV_A?: string[];
  EDL?: string[];
}

export interface CfData {
  STATUS: string;
  CF_CODE: string;
  BARCODE_B64: string;
}

export interface TaxData {
  STATUS: string;
  TAX_ID: string;
}

export interface BypassResult {
  STATUS: string;
  TYPE?: string;
  IMAGE_BASE64?: string;
  AI_PROBABILITY?: string;
  BEST_SCORE?: string;
  USED_PROFILE?: string;
}

@Injectable({ providedIn: 'root' })
export class AppStore {
  private http = inject(HttpClient);

  loading = signal<boolean>(false);
  selectedApp = signal<string | null>(null);
  schema = signal<SchemaField[]>([]);
  lines = signal<string[]>([]);
  scanMode = signal<boolean>(false);

  // Single mode files
  selectedFile = signal<File | null>(null);
  mrzData = signal<MrzData | null>(null);
  mrzGenResult = signal<MrzGenResult | null>(null);
  cfData = signal<CfData | null>(null);
  taxData = signal<TaxData | null>(null);
  previewUrl = signal<string | null>(null);

  // Batch mode files (AI_BYPASS)
  batchFiles = signal<File[]>([]);
  batchUrls = signal<string[]>([]);
  bypassResults = signal<(BypassResult | null)[]>([]);
  batchProgress = signal<{ done: number; total: number } | null>(null);

  isMediaApp = computed(() => ['exif_cleaner', 'face_cut', 'ai_bypass'].includes(this.selectedApp() || ''));
  hasPreview = computed(() => ['face_cut'].includes(this.selectedApp() || ''));
  requiresFile = computed(() => this.isMediaApp());

  openApp(name: string) {
    this.selectedApp.set(name);
    this.http.get<SchemaField[]>(`/api/schema/${name}`).subscribe(s => {
      this.schema.set(s);
      this.lines.set(s.map(f => f.type === 'select' && f.opts?.length ? f.opts[0] : ''));
    });
  }

  closeApp() {
    this.selectedApp.set(null);
    this.selectedFile.set(null);
    this.mrzData.set(null);
    this.mrzGenResult.set(null);
    this.cfData.set(null);
    this.taxData.set(null);
    this.bypassResults.set([]);
    this.batchFiles.set([]);
    this.batchProgress.set(null);
    
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.previewUrl.set(null);
    
    this.batchUrls().forEach(url => URL.revokeObjectURL(url));
    this.batchUrls.set([]);
  }

  executeJson<T>(fd: FormData): Observable<T> {
    this.loading.set(true);
    return this.http.post<T>('/api/execute', fd).pipe(
      finalize(() => this.loading.set(false))
    );
  }

  executeBlob(fd: FormData): Observable<Blob> {
    this.loading.set(true);
    return this.http.post('/api/execute', fd, { responseType: 'blob' }).pipe(
      finalize(() => this.loading.set(false))
    );
  }

  executeSilentJson<T>(fd: FormData): Observable<T> {
    return this.http.post<T>('/api/execute', fd);
  }
}