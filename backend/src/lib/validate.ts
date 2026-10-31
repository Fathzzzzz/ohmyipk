import type { ZodType } from 'zod';
import { HttpError } from './httpError.js';

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.length ? i.path.join('.') : 'body'}: ${i.message}`)
      .join('; ');
    throw new HttpError(400, message);
  }
  return result.data;
}