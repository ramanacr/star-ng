import { HttpEvent, HttpEventType } from '@angular/common/http';
import { catchError, filter, map, Observable, of } from 'rxjs';
import type { StarFileStatus } from './file-upload';

/** Upload state of one file, with the server response when the upload is done. */
export interface StarUploadResult<T> extends StarFileStatus {
  readonly response?: T;
}

/**
 * Turns the events of one `HttpClient` upload into `StarFileStatus` values for
 * `<star-file-upload [fileStatus]>`: progress while the body is sent, then `done` with the
 * response body, or `error` with a message. The observable does not fail.
 *
 * The control does not upload. The page sends the request with
 * `{ reportProgress: true, observe: 'events' }` and pipes it here:
 *
 * ```ts
 * this.api.upload(file).pipe(toUploadStatus()).subscribe((status) =>
 *   this.uploads.update((map) => new Map(map).set(file, status)));
 * ```
 *
 * @param errorMessage Text for a failed upload. The default uses the HTTP status text.
 */
export function toUploadStatus<T>(
  errorMessage: (error: unknown) => string = defaultErrorMessage,
): (events: Observable<HttpEvent<T>>) => Observable<StarUploadResult<T>> {
  return (events) =>
    events.pipe(
      map((event): StarUploadResult<T> | null => {
        switch (event.type) {
          case HttpEventType.Sent:
            return { state: 'uploading', progress: 0 };
          case HttpEventType.UploadProgress:
            return {
              state: 'uploading',
              progress: event.total ? (100 * event.loaded) / event.total : 0,
            };
          case HttpEventType.Response:
            return { state: 'done', progress: 100, response: event.body ?? undefined };
          default:
            return null;
        }
      }),
      filter((status): status is StarUploadResult<T> => status !== null),
      catchError((error: unknown) => of({ state: 'error', message: errorMessage(error) } as const)),
    );
}

function defaultErrorMessage(error: unknown): string {
  const status = (error as { status?: number; statusText?: string } | null) ?? {};
  if (status.status) return `${status.status} ${status.statusText ?? ''}`.trim();
  return error instanceof Error ? error.message : String(error);
}
