import { isAxiosError } from 'axios';
import { apiClient } from './api-client';
import type { ApiEnvelope } from '@/types/api';

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

function filenameFrom(disposition: string | undefined, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Authenticated file download through the shared client. Some endpoints answer with a JSON
 * `{ url }` (external resources) instead of a file. Blob error bodies are parsed back into JSON so
 * normalizeApiError can read the backend message.
 */
export async function fetchDownload(path: string, fallbackName: string): Promise<DownloadedFile | { url: string }> {
  try {
    const res = await apiClient.get<Blob>(path, { responseType: 'blob', timeout: 120_000 });
    if (res.data.type.includes('application/json')) {
      const body = JSON.parse(await res.data.text()) as ApiEnvelope<{ url: string }>;
      return { url: body.data.url };
    }
    return { blob: res.data, filename: filenameFrom(res.headers['content-disposition'] as string | undefined, fallbackName) };
  } catch (error) {
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* keep original */
      }
    }
    throw error;
  }
}

export function saveBlob({ blob, filename }: DownloadedFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
