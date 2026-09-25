import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { FieldError } from '../api/errors';

export type ApiFieldMap<T extends FieldValues> = Readonly<Record<string, Path<T>>>;

export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: readonly FieldError[],
  fieldMap: ApiFieldMap<T>,
): FieldError[] {
  const unmatched: FieldError[] = [];
  for (const fieldError of fieldErrors) {
    const formField = Object.hasOwn(fieldMap, fieldError.field)
      ? fieldMap[fieldError.field]
      : undefined;
    if (formField === undefined) unmatched.push(fieldError);
    else setError(formField, { message: fieldError.message });
  }
  return unmatched;
}
