export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_FILES = 3;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Validates a list of image files against type, size, and count constraints.
 * @param incoming Files selected by the user
 * @param alreadySelected Number of images already queued (to enforce the total cap)
 */
export function validateImageFiles(
  incoming: File[],
  alreadySelected = 0
): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  const valid: File[] = [];

  for (const file of incoming) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
      errors.push(`${file.name}: tipo non supportato (PNG, JPEG, WEBP)`);
      continue;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      errors.push(`${file.name}: dimensione massima 5 MB`);
      continue;
    }
    valid.push(file);
  }

  const remaining = MAX_IMAGE_FILES - alreadySelected;
  if (valid.length > remaining) {
    const excess = valid.splice(remaining);
    for (const f of excess) {
      errors.push(`${f.name}: limite di ${MAX_IMAGE_FILES} immagini per messaggio raggiunto`);
    }
  }

  return { valid, errors };
}
