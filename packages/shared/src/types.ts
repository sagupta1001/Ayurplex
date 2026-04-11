// Domain type stubs for Ayurplex. Expanded in later plans.
//
// We use branded primitive types (nominal typing) so IDs cannot be accidentally
// mixed (e.g. passing a MedicationId where a UserId is expected).

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;

export const makeUserId = (value: string): UserId => value as UserId;
