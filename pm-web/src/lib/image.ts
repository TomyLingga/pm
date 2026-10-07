/**
 * Client-side photo downscaling. Phone cameras routinely produce files above the 5 MB upload
 * limit, so large photos are resized (long edge 1920 px) and re-encoded as JPEG before upload.
 * Any failure falls back to the original file.
 */

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;
/** Smaller files are uploaded untouched. */
const SKIP_BELOW_BYTES = 1.5 * 1024 * 1024;
const COMPRESSIBLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image could not be decoded"));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!COMPRESSIBLE_TYPES.includes(file.type) || file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const image = await loadImage(file);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return file;

      // JPEG has no alpha channel: flatten transparent PNG/WEBP onto white.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image.source, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
      if (!blob || blob.size >= file.size) return file;

      const name = `${file.name.replace(/\.[^.]+$/, "") || "foto"}.jpg`;
      return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
    } finally {
      image.release();
    }
  } catch {
    return file;
  }
}
