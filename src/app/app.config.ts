import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Стабільний Zoneless [cite: 2026-02-05]
    provideZonelessChangeDetection(), 
    provideRouter(routes),
    provideHttpClient()
  ]
};