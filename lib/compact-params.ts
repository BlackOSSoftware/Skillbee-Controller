/** Drops empty values so they are not sent as query params (Zod rejects `status=` etc.). */
export function compactParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  ) as Partial<T>;
}
