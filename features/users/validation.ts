import type { UserStatus } from '@/types/auth';

/** Mirrors backend `passwordSchema`, `phoneSchema` and `createUserSchema` / `updateUserSchema`. */
export interface UserFormValues {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
  status: UserStatus;
}

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]+$/;

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push('at least 8 characters');
  if (password.length > 128) issues.push('at most 128 characters');
  if (!/[A-Z]/.test(password)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('a lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('a number');
  return issues;
}

export function validateUserForm(values: UserFormValues, mode: 'create' | 'edit'): UserFormErrors {
  const errors: UserFormErrors = {};
  const { firstName, lastName } = splitFullName(values.fullName);
  if (!firstName || !lastName) errors.fullName = 'Enter first and last name.';
  else if (firstName.length > 80 || lastName.length > 80) errors.fullName = 'First and last name must be 80 characters or less.';

  if (!EMAIL_RE.test(values.email.trim())) errors.email = 'Enter a valid email address.';

  const phone = values.phone.trim();
  if (phone && (phone.length < 7 || phone.length > 20 || !PHONE_RE.test(phone))) {
    errors.phone = 'Use 7–20 digits; +, spaces, ( ) and - are allowed.';
  }

  if (mode === 'create' || values.password) {
    const issues = passwordIssues(values.password);
    if (issues.length) errors.password = `Password needs ${issues.join(', ')}.`;
  }

  if (!values.roleId) errors.roleId = 'Select a role.';
  return errors;
}

/** Maps backend Zod issue paths (firstName, lastName, …) onto form fields. */
export function mapServerField(path: string): keyof UserFormValues | null {
  const key = path.split('.')[0];
  if (key === 'firstName' || key === 'lastName') return 'fullName';
  if (key === 'email' || key === 'phone' || key === 'password' || key === 'roleId' || key === 'status') return key;
  return null;
}
