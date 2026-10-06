import { z } from 'zod';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const coordinatesSchema = z.object({
  lat: z
    .number()
    .finite()
    .min(4.5, 'Latitude must be at least 4.5.')
    .max(11.5, 'Latitude must be at most 11.5.'),
  lng: z
    .number()
    .finite()
    .min(-3.5, 'Longitude must be at least −3.5.')
    .max(1.5, 'Longitude must be at most 1.5.'),
  device_id: z.string().trim().max(100, 'Device ID is too long.').default('manual'),
});
export const detectionFormSchema = coordinatesSchema.extend({
  image: z
    .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, 'Choose a road image.')
    .refine(
      (f) =>
        f &&
        (f.type.startsWith('image/') ||
          /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff)$/i.test(f.name)),
      'Choose a valid image file (JPEG, PNG, WebP, GIF, BMP, HEIC, etc.).',
    )
    .refine(
      (f) => f && f.size > 0 && f.size <= MAX_IMAGE_BYTES,
      'Image must be between 1 byte and 10 MiB.',
    ),
});
export type DetectionFormValues = z.input<typeof detectionFormSchema>;
