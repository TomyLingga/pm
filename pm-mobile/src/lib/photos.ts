import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import { MAX_UPLOAD_BYTES } from './config';
import { workOrderApi, type UploadFile } from './endpoints';
import type { AttachmentCollection } from './types';

/** A local file picked from the camera, gallery or document picker, ready to upload. */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

/** @deprecated alias kept for readability in photo-only screens. */
export type PhotoAsset = PickedFile;

const PICKER_QUALITY = 0.6;
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const isImageFile = (f: Pick<PickedFile, 'type'>) => f.type.startsWith('image/');

function fromImageAsset(asset: ImagePicker.ImagePickerAsset, index: number): PickedFile {
  const ext = asset.mimeType?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName ?? `foto_${Date.now()}_${index}.${ext}`,
    type: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize,
  };
}

function rejectOversized(files: PickedFile[]): PickedFile[] {
  const ok = files.filter((p) => !p.size || p.size <= MAX_UPLOAD_BYTES);
  if (ok.length < files.length) {
    Alert.alert('File terlalu besar', 'Ukuran maksimal per file adalah 5 MB. File yang terlalu besar dilewati.');
  }
  return ok;
}

export async function takePhoto(): Promise<PickedFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Izin kamera diperlukan', 'Aktifkan izin kamera untuk PrevenTech di pengaturan perangkat.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Buka Pengaturan', onPress: () => void Linking.openSettings() },
    ]);
    return [];
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: PICKER_QUALITY, exif: false });
  if (result.canceled) return [];
  return rejectOversized(result.assets.map(fromImageAsset));
}

export async function pickFromGallery(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: PICKER_QUALITY,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    exif: false,
  });
  if (result.canceled) return [];
  return rejectOversized(result.assets.slice(0, limit).map(fromImageAsset));
}

/** PDF (or image) files from storage / Drive via the system document picker. */
export async function pickDocuments(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return [];
  const result = await DocumentPicker.getDocumentAsync({
    type: ALLOWED_DOCUMENT_TYPES,
    multiple: limit > 1,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  const files = result.assets.slice(0, limit).map<PickedFile>((a, i) => ({
    uri: a.uri,
    name: a.name || `dokumen_${Date.now()}_${i}.pdf`,
    type: a.mimeType ?? 'application/pdf',
    size: a.size,
  }));
  const allowed = files.filter((f) => ALLOWED_DOCUMENT_TYPES.includes(f.type));
  if (allowed.length < files.length) {
    Alert.alert('Format tidak didukung', 'Hanya file PDF, JPG, PNG atau WEBP yang dapat dilampirkan.');
  }
  return rejectOversized(allowed);
}

/**
 * Lets the user choose the source. Android alerts support at most three buttons, so the
 * dialog is dismissed with back / tap outside instead of a "Batal" button when documents are allowed.
 */
export function chooseFileSource(limit: number, options: { allowDocuments?: boolean } = {}): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const safe = (p: Promise<PickedFile[]>) => void p.then(resolve, () => resolve([]));
    const buttons = options.allowDocuments
      ? [
          // Android: neutral / negative / positive (left → right).
          { text: 'Dokumen', onPress: () => safe(pickDocuments(limit)) },
          { text: 'Galeri', onPress: () => safe(pickFromGallery(limit)) },
          { text: 'Kamera', onPress: () => safe(takePhoto()) },
        ]
      : [
          { text: 'Batal', style: 'cancel' as const, onPress: () => resolve([]) },
          { text: 'Galeri', onPress: () => safe(pickFromGallery(limit)) },
          { text: 'Kamera', onPress: () => safe(takePhoto()) },
        ];
    Alert.alert(
      options.allowDocuments ? 'Tambah Lampiran' : 'Tambah Foto',
      options.allowDocuments ? 'Ambil dari kamera, galeri, atau file PDF:' : 'Ambil foto dari:',
      buttons,
      { cancelable: true, onDismiss: () => resolve([]) },
    );
  });
}

/** Camera or gallery only (work orders accept photos from the field). */
export function choosePhotoSource(limit: number): Promise<PickedFile[]> {
  return chooseFileSource(limit);
}

type Uploader = (file: UploadFile, collection: AttachmentCollection) => Promise<unknown>;

/** Uploads files one by one through `upload`; returns the number of failures. */
export async function uploadEach(
  files: PickedFile[],
  upload: (file: UploadFile, picked: PickedFile) => Promise<unknown>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ failed: number; firstError?: unknown }> {
  let failed = 0;
  let firstError: unknown;
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    const f = files[i];
    try {
      await upload({ uri: f.uri, name: f.name, type: f.type }, f);
    } catch (e) {
      failed++;
      firstError ??= e;
    }
  }
  onProgress?.(files.length, files.length);
  return { failed, firstError };
}

/** Uploads files that need a `collection` (work orders, Form Requests). */
export function uploadFiles(
  upload: Uploader,
  files: PickedFile[],
  collection: AttachmentCollection | ((file: PickedFile) => AttachmentCollection),
  onProgress?: (done: number, total: number) => void,
): Promise<{ failed: number; firstError?: unknown }> {
  return uploadEach(
    files,
    (file, picked) => upload(file, typeof collection === 'function' ? collection(picked) : collection),
    onProgress,
  );
}

/** Work order photos. */
export function uploadPhotos(
  workOrderId: number,
  photos: PickedFile[],
  collection: AttachmentCollection,
  onProgress?: (done: number, total: number) => void,
) {
  return uploadFiles((file, c) => workOrderApi.uploadAttachment(workOrderId, file, c), photos, collection, onProgress);
}
