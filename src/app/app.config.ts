import { ApplicationConfig, provideZonelessChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { httpErrorInterceptor } from './services/http-error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([httpErrorInterceptor])),
    provideServiceWorker('ngsw-worker.js', { enabled: false }), // TEMP DISABLED
  ],
};
