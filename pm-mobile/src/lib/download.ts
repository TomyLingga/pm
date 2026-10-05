import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { ApiError, authHeaders } from './api';
import { API_URL } from './config';
import { safeFileName } from './format';

/**
 * Downloads an authenticated file into the cache directory and opens the system
 * share sheet (so the user can open it in a PDF viewer, WhatsApp, Drive, …).
 */
export async function downloadAndShare(url: string, fileName: string, mimeType: string): Promise<void> {
  const dir = `${FileSystem.cacheDirectory ?? ''}downloads/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const target = `${dir}${safeFileName(fileName) || `file-${Date.now()}`}`;

  let result: FileSystem.FileSystemDownloadResult;
  try {
    result = await FileSystem.downloadAsync(url, target, {
      headers: { ...authHeaders(), Accept: `${mimeType}, application/json` },
    });
  } catch {
    throw new ApiError(0, 'Gagal mengunduh file. Periksa koneksi internet Anda.');
  }

  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
    const message =
      result.status === 403
        ? 'Anda tidak berwenang mengunduh file ini.'
        : result.status === 404
          ? 'File tidak ditemukan.'
          : `Gagal mengunduh file (${result.status}).`;
    throw new ApiError(result.status, message);
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError(0, 'Fitur berbagi/membuka file tidak tersedia di perangkat ini.');
  }
  await Sharing.shareAsync(result.uri, {
    mimeType,
    dialogTitle: fileName,
    UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
  });
}

export function downloadWorkOrderPdf(id: number, woNumber: string): Promise<void> {
  return downloadAndShare(`${API_URL}/work-orders/${id}/pdf`, `${safeFileName(woNumber)}.pdf`, 'application/pdf');
}

export function downloadRequestPdf(id: number, requestNumber: string | null): Promise<void> {
  const name = requestNumber ? safeFileName(requestNumber) : `Form-Request-draft-${id}`;
  return downloadAndShare(`${API_URL}/service-requests/${id}/pdf`, `${name}.pdf`, 'application/pdf');
}
