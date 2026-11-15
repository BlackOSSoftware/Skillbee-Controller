'use client';

import { Info, Lock } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { Role, UpdateRoleInput } from '@/types/users';
import { useCreateRole, useUpdateRole } from '../hooks';
import { RoleIcon } from './role-visuals';

interface RoleFormDialogProps {
  mode: 'create' | 'edit';
  role?: Role;
  onClose: () => void;
  onSaved: (role: Role) => void;
}

type Errors = Partial<Record<'name' | 'slug' | 'description', string>>;

const SLUG_RE = /^[a-z0-9_]+$/;

/** Mirrors backend createRoleSchema / updateRoleSchema. Mount with a `key` per role to reset state. */
export function RoleFormDialog({ mode, role, onClose, onSaved }: RoleFormDialogProps) {
  const toast = useToast();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const pending = createRole.isPending || updateRole.isPending;
  // isPending only updates after re-render; this blocks a second submit fired in the same tick
  const inFlight = useRef(false);

  const [name, setName] = useState(role?.name ?? '');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState(role?.description ?? '');
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [errors, setErrors] = useState<Errors>({});

  function validate(): Errors {
    const next: Errors = {};
    if (name.trim().length < 2 || name.trim().length > 100) next.name = 'Name must be 2–100 characters.';
    if (mode === 'create' && slug && !SLUG_RE.test(slug.trim().toLowerCase())) {
      next.slug = 'Use lowercase letters, numbers and underscores only.';
    }
    if (description.trim().length > 500) next.description = 'Description must be 500 characters or less.';
    return next;
  }

  function onError(error: unknown) {
    const { message, code, fieldErrors } = normalizeApiError(error);
    const mapped: Errors = {};
    for (const f of fieldErrors) {
      const key = f.path.split('.')[0] as keyof Errors;
      if (key === 'name' || key === 'slug' || key === 'description') mapped[key] = f.message;
    }
    if (code === 'ROLE_EXISTS') mapped.slug = 'A role with this slug already exists.';
    setErrors(mapped);
    toast.error(mode === 'create' ? 'Could not create role' : 'Could not update role', message);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current) return;
    const found = validate();
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    const settle = () => {
      inFlight.current = false;
    };

    if (mode === 'create') {
      inFlight.current = true;
      createRole.mutate(
        {
          name: name.trim(),
          ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          permissions: [],
          isActive,
        },
        {
          onSuccess: (created) => {
            toast.success('Role created', `${created.name} has no permissions yet. Assign them next.`);
            onSaved(created);
          },
          onError,
          onSettled: settle,
        }
      );
      return;
    }

    if (!role) return;
    const body: UpdateRoleInput = {};
    if (name.trim() !== role.name) body.name = name.trim();
    if (description.trim() !== (role.description ?? '')) body.description = description.trim();
    if (!role.isSystem && isActive !== role.isActive) body.isActive = isActive;
    if (!Object.keys(body).length) {
      toast.notify({ tone: 'info', title: 'No changes to save' });
      return;
    }
    inFlight.current = true;
    updateRole.mutate(
      { id: role.id, input: body },
      {
        onSuccess: (updated) => {
          toast.success('Role updated', updated.name);
          onSaved(updated);
        },
        onError,
        onSettled: settle,
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="md"
      title={mode === 'create' ? 'Create custom role' : 'Edit role'}
      description={mode === 'create' ? 'Define the role first; assign permissions from the permission panel after saving.' : 'Update how this role is named and described.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="role-form" loading={pending}>
            {mode === 'create' ? 'Create role' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Live identity preview */}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
          <RoleIcon role={{ slug: role?.slug ?? slug }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name.trim() || 'Untitled role'}</p>
            <p className="truncate font-mono text-[11px] text-ink-subtle">
              {mode === 'edit' ? role?.slug : slug.trim().toLowerCase() || 'slug generated from name'}
            </p>
          </div>
          {role?.isSystem ? (
            <Badge tone="brand">
              <Lock className="mr-1 size-3" aria-hidden />
              Protected
            </Badge>
          ) : (
            <Badge tone="accent">Custom</Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="role-name" label="Role name" required error={errors.name}>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((x) => ({ ...x, name: undefined }));
              }}
              placeholder="Content Manager"
              aria-invalid={Boolean(errors.name)}
              aria-describedby="role-name-msg"
            />
          </Field>
          {mode === 'create' ? (
            <Field id="role-slug" label="Slug" error={errors.slug} hint="Optional · lowercase, numbers, _ · permanent">
              <Input
                id="role-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setErrors((x) => ({ ...x, slug: undefined }));
                }}
                placeholder="content_manager"
                className="font-mono"
                aria-invalid={Boolean(errors.slug)}
                aria-describedby="role-slug-msg"
              />
            </Field>
          ) : (
            <Field id="role-slug-ro" label="Slug" hint="Slugs cannot be changed after creation.">
              <Input id="role-slug-ro" value={role?.slug ?? ''} disabled className="font-mono" aria-describedby="role-slug-ro-msg" />
            </Field>
          )}
        </div>

        <Field
          id="role-description"
          label="Description"
          error={errors.description}
          hint={`${description.trim().length}/500 · shown on the role card`}
        >
          <Textarea
            id="role-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((x) => ({ ...x, description: undefined }));
            }}
            placeholder="What is this role responsible for?"
            maxLength={500}
            aria-invalid={Boolean(errors.description)}
            aria-describedby="role-description-msg"
          />
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink" id="role-active-label">
              Active role
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {role?.isSystem ? 'System roles are always active.' : 'Inactive roles cannot be assigned to users.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-labelledby="role-active-label"
            disabled={role?.isSystem}
            onClick={() => setIsActive((v) => !v)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
              isActive ? 'bg-primary' : 'bg-line'
            )}
          >
            <span
              className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', isActive ? 'translate-x-5' : 'translate-x-0.5')}
            />
          </button>
        </div>

        {mode === 'create' ? (
          <p className="flex items-start gap-2 text-xs text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden />
            New roles start with zero permissions so nothing is granted by accident.
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
