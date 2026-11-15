'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { displayName, ROLE_SLUGS } from '@/lib/roles';
import { titleCase } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import type { AdminUser, CreateUserInput, UpdateUserInput } from '@/types/users';
import { useCreateUser, useRolesList, useUpdateUser } from '../hooks';
import { userPolicy } from '../policy';
import {
  mapServerField,
  passwordIssues,
  splitFullName,
  validateUserForm,
  type UserFormErrors,
  type UserFormValues,
} from '../validation';
import { RoleSummary } from './role-summary';
import { USER_STATUSES } from './user-status-badge';

interface UserFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  user?: AdminUser | null;
  onClose: () => void;
}

function initialValues(user?: AdminUser | null): UserFormValues {
  return {
    fullName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    password: '',
    roleId: user?.role?.id ?? user?.roleId ?? '',
    status: user?.status ?? 'active',
  };
}

/** Rendered with a `key` per user so form state resets when the target changes. */
export function UserFormDialog({ open, mode, user, onClose }: UserFormDialogProps) {
  const { user: actor } = useAuth();
  const toast = useToast();
  const roles = useRolesList(open);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const pending = createUser.isPending || updateUser.isPending;
  // isPending only updates after re-render; this blocks a second submit fired in the same tick
  const inFlight = useRef(false);

  const [values, setValues] = useState<UserFormValues>(() => initialValues(user));
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isSelf = mode === 'edit' && user?.id === actor?.id;

  const roleOptions = useMemo(() => {
    const assignable = userPolicy.assignableRoles(actor, roles.data ?? []);
    // Keep the user's current role selectable on edit even if it is no longer assignable by this actor
    const current = (roles.data ?? []).find((r) => r.id === values.roleId);
    return current && !assignable.some((r) => r.id === current.id) ? [current, ...assignable] : assignable;
  }, [actor, roles.data, values.roleId]);

  const selectedRole = (roles.data ?? []).find((r) => r.id === values.roleId);

  function set<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function buildUpdate(): UpdateUserInput {
    if (!user) return {};
    const { firstName, lastName } = splitFullName(values.fullName);
    const body: UpdateUserInput = {};
    if (firstName !== user.firstName) body.firstName = firstName;
    if (lastName !== user.lastName) body.lastName = lastName;
    if (values.email.trim().toLowerCase() !== user.email) body.email = values.email.trim();
    const phone = values.phone.trim();
    if (phone !== (user.phone ?? '')) body.phone = phone || null;
    if (values.password) body.password = values.password;
    if (values.roleId && values.roleId !== (user.role?.id ?? user.roleId)) body.roleId = values.roleId;
    return body;
  }

  function applyServerError(error: unknown) {
    const { message, fieldErrors, code } = normalizeApiError(error);
    const mapped: UserFormErrors = {};
    for (const issue of fieldErrors) {
      const field = mapServerField(issue.path);
      if (field && !mapped[field]) mapped[field] = issue.message;
    }
    if (code === 'EMAIL_EXISTS' || (code === 'DUPLICATE_KEY' && /email/i.test(message))) {
      mapped.email = 'This email is already registered.';
    }
    setErrors(mapped);
    setFormError(Object.keys(mapped).length ? null : message);
    toast.error(mode === 'create' ? 'Could not create user' : 'Could not update user', message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current) return;
    setFormError(null);
    const found = validateUserForm(values, mode);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    if (mode === 'create') {
      const { firstName, lastName } = splitFullName(values.fullName);
      const body: CreateUserInput = {
        firstName,
        lastName,
        email: values.email.trim(),
        password: values.password,
        roleId: values.roleId,
        status: values.status,
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      };
      inFlight.current = true;
      createUser.mutate(body, {
        onSuccess: (created) => {
          toast.success('User created', `${displayName(created)} was added as ${created.role?.name ?? 'user'}.`);
          onClose();
        },
        onError: applyServerError,
        onSettled: () => {
          inFlight.current = false;
        },
      });
      return;
    }

    if (!user) return;
    const body = buildUpdate();
    if (!Object.keys(body).length) {
      toast.notify({ tone: 'info', title: 'No changes to save' });
      return;
    }
    inFlight.current = true;
    updateUser.mutate(
      { id: user.id, input: body },
      {
        onSuccess: (updated) => {
          toast.success('User updated', displayName(updated));
          onClose();
        },
        onError: applyServerError,
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  const pwIssues = values.password ? passwordIssues(values.password) : [];
  const formId = `user-form-${mode}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={pending}
      size="lg"
      title={mode === 'create' ? 'Create user' : `Edit ${user ? displayName(user) : 'user'}`}
      description={
        mode === 'create'
          ? 'Accounts are created active unless you choose another status.'
          : 'Status is changed from the actions menu. A new password signs the user out everywhere.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {mode === 'create' ? 'Create user' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {formError ? (
            <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              {formError}
            </p>
          ) : null}

          <Field id="user-fullName" label="Full name" required error={errors.fullName}>
            <Input
              id="user-fullName"
              value={values.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              autoComplete="name"
              placeholder="Priya Sharma"
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby="user-fullName-msg"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="user-email"
              label="Email"
              required
              error={errors.email}
              hint={mode === 'edit' ? 'Changing email marks it unverified.' : undefined}
            >
              <Input
                id="user-email"
                type="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                autoComplete="off"
                placeholder="name@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby="user-email-msg"
              />
            </Field>
            <Field id="user-phone" label="Phone" error={errors.phone} hint="Optional">
              <Input
                id="user-phone"
                type="tel"
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
                autoComplete="off"
                placeholder="+91 98765 43210"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby="user-phone-msg"
              />
            </Field>
          </div>

          <Field
            id="user-password"
            label={mode === 'create' ? 'Password' : 'New password'}
            required={mode === 'create'}
            error={errors.password}
            hint={
              mode === 'edit' && !values.password
                ? 'Leave blank to keep the current password.'
                : pwIssues.length
                  ? `Needs ${pwIssues.join(', ')}.`
                  : values.password
                    ? 'Password meets requirements.'
                    : '8+ characters with uppercase, lowercase and a number.'
            }
          >
            <div className="relative">
              <Input
                id="user-password"
                type={showPassword ? 'text' : 'password'}
                value={values.password}
                onChange={(e) => set('password', e.target.value)}
                autoComplete="new-password"
                className="pr-10"
                aria-invalid={Boolean(errors.password)}
                aria-describedby="user-password-msg"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-subtle hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="user-role"
              label="Role"
              required
              error={errors.roleId}
              hint={isSelf ? 'You cannot change your own role.' : undefined}
            >
              {roles.isPending ? (
                <Skeleton className="h-10 w-full" />
              ) : roles.isError ? (
                <p className="text-xs text-danger">{normalizeApiError(roles.error).message}</p>
              ) : (
                <Select
                  id="user-role"
                  value={values.roleId}
                  onChange={(e) => set('roleId', e.target.value)}
                  disabled={isSelf}
                  aria-invalid={Boolean(errors.roleId)}
                  aria-describedby="user-role-msg"
                >
                  <option value="">Select a role</option>
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.id} disabled={r.slug === ROLE_SLUGS.SUPER_ADMIN && !userPolicy.assignableRoles(actor, [r]).length}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {mode === 'create' ? (
              <Field id="user-status" label="Status">
                <Select id="user-status" value={values.status} onChange={(e) => set('status', e.target.value as UserFormValues['status'])}>
                  {USER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </div>

        <aside className="lg:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Role access</p>
          <RoleSummary role={selectedRole} />
        </aside>
      </form>
    </Dialog>
  );
}
