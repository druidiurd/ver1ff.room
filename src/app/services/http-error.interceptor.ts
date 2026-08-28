import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AppStore } from '../store';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AppStore);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle specific error codes
      if (error.status === 530) {
        store.apiError.set('SERVER_UNREACHABLE');
      } else if (error.status === 504 || error.status === 503) {
        store.apiError.set('SERVER_TIMEOUT');
      } else if (error.status === 0) {
        // Network error or CORS issue
        store.apiError.set('NETWORK_ERROR');
      } else if (error.status >= 500) {
        store.apiError.set('SERVER_ERROR');
      }

      return throwError(() => error);
    })
  );
};
