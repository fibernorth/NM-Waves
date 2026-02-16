const RESIZABLE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Check if a file is a resizable image type.
 */
export const isResizableImage = (file: File): boolean => {
  return RESIZABLE_TYPES.includes(file.type);
};

/**
 * Resize an image file using the Canvas API.
 * Returns a new File with the resized image (JPEG for non-PNG, PNG preserved).
 */
export const resizeImage = async (
  file: File,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<File> => {
  const { maxDimension = 1920, quality = 0.85 } = options;

  if (!isResizableImage(file)) return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Skip resize if already within bounds
  if (width <= maxDimension && height <= maxDimension) {
    bitmap.close();
    return file;
  }

  const scale = maxDimension / Math.max(width, height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  // Preserve PNG format, otherwise use JPEG for smaller size
  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await canvas.convertToBlob({ type: outputType, quality });

  return new File([blob], file.name, { type: outputType, lastModified: Date.now() });
};

/**
 * Generate a smaller thumbnail version of an image.
 */
export const generateThumbnail = async (
  file: File,
  maxDimension = 400
): Promise<File> => {
  if (!isResizableImage(file)) return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const scale = maxDimension / Math.max(width, height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
  const thumbName = file.name.replace(/\.[^.]+$/, '_thumb.jpg');
  return new File([blob], thumbName, { type: 'image/jpeg', lastModified: Date.now() });
};
