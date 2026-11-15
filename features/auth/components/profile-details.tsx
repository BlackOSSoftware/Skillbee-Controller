'use client';

import {
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { formatDate, titleCase } from '@/lib/format';
import { displayName, initialsOf, isSuperAdmin } from '@/lib/roles';
import { useUpdateProfileMutation } from '../hooks';

function statusTone(status: string | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'danger';
  if (status === 'inactive') return 'warning';
  return 'neutral';
}

/** Groups raw permission strings into human categories. Only categories with matches render. */
const PERMISSION_GROUPS: Array<{ label: string; match: (p: string) => boolean }> = [
  { label: 'User Management', match: (p) => p.startsWith('users:') },
  { label: 'Roles & Permissions', match: (p) => p.startsWith('roles:') || p.startsWith('permissions:') },
  { label: 'Course Management', match: (p) => p.startsWith('courses.') && !/courses\.(curriculum|lessons|media)\./.test(p) },
  { label: 'Curriculum & Lessons', match: (p) => p.startsWith('courses.curriculum.') || p.startsWith('courses.lessons.') },
  { label: 'Media Management', match: (p) => p.startsWith('courses.media.') || p.startsWith('media.') },
  { label: 'Quiz Management', match: (p) => p.startsWith('quizzes.') },
  { label: 'Assignment Management', match: (p) => p.startsWith('assignments.') },
  { label: 'Instructor Management', match: (p) => p.startsWith('instructor.') },
  { label: 'Enquiries & Support', match: (p) => p.startsWith('enquiries.') },
  { label: 'SEO & Categories', match: (p) => p.startsWith('seo.') || p.startsWith('categories.') },
];

function PermissionGroups({ permissions }: { permissions: string[] }) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PERMISSION_GROUPS.map((g) => ({
      ...g,
      items: permissions.filter((p) => g.match(p) && (!q || p.toLowerCase().includes(q))),
    })).filter((g) => g.items.length > 0);
  }, [permissions, query]);

  function toggle(label: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  if (!permissions.length) {
    return <p className="p-5 text-xs text-ink-muted">No explicit permissions are assigned to this role.</p>;
  }

  return (
    <div>
      <div className="border-b border-line px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter permissions…"
            className="pl-8"
            aria-label="Filter permissions"
          />
        </div>
      </div>
      <div className="divide-y divide-line">
        {groups.length ? (
          groups.map((g) => {
            const open = !collapsed.has(g.label) || query.trim().length > 0;
            return (
              <div key={g.label}>
                <button
                  type="button"
                  onClick={() => toggle(g.label)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-surface-2/40"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <ChevronDown className={cn('size-3.5 text-ink-subtle transition-transform', !open && '-rotate-90')} aria-hidden />
                    {g.label}
                  </span>
                  <Badge tone="neutral">{g.items.length}</Badge>
                </button>
                {open ? (
                  <div className="flex flex-wrap gap-1.5 px-5 pb-4">
                    {g.items.map((p) => (
                      <code key={p} className="rounded-md border border-line bg-surface-2/60 px-2 py-0.5 font-mono text-[11px] text-ink-muted">
                        {p}
                      </code>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="px-5 py-6 text-center text-xs text-ink-muted">No permissions match “{query}”.</p>
        )}
      </div>
    </div>
  );
}

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // mirrors backend IMAGE_MAX_SIZE_MB default
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function validatePhoto(file: File): string | null {
  if (!PHOTO_TYPES.has(file.type)) return 'Photo must be JPEG, PNG, WebP or AVIF.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo must be 10 MB or smaller.';
  return null;
}

export function ProfileDetails() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfileMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Revoke the staged object URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  if (!user) return null;

  const superAdmin = isSuperAdmin(user);
  const permissions = user.role?.permissions ?? [];
  const roleName = user.role?.name || titleCase(user.role?.slug || 'User');

  const startEdit = () => {
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setFormError(null);
    setSaved(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemovePhoto(false);
    setFormError(null);
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const problem = validatePhoto(file);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setRemovePhoto(false);
    setSaved(false);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRemovePhoto(true);
    setSaved(false);
  };

  const save = async () => {
    setFormError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('First name and last name are required.');
      return;
    }
    try {
      await updateProfile.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        photo: photoFile,
        removePhoto: removePhoto && !photoFile,
      });
      setEditing(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setRemovePhoto(false);
      setSaved(true);
    } catch (error) {
      setFormError(normalizeApiError(error).message || 'Could not save your profile. Please try again.');
    }
  };

  const avatarSrc = editing
    ? (photoPreview ?? (removePhoto ? null : user.profileImage))
    : user.profileImage;

  const accountRows: Array<{ label: string; value: string; icon?: typeof Mail }> = [
    { label: 'Full name', value: displayName(user) },
    { label: 'Email', value: user.email, icon: Mail },
    { label: 'Phone', value: user.phone || '—', icon: Phone },
    { label: 'Role', value: roleName },
    { label: 'Account status', value: titleCase(user.status) },
    { label: 'Email verification', value: user.emailVerified ? 'Verified' : 'Not verified' },
    { label: 'Last login', value: formatDate(user.lastLogin) },
    { label: 'Member since', value: formatDate(user.createdAt) },
  ];

  return (
    <div className="space-y-6">
      {saved ? (
        <p className="rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-xs font-medium text-success" role="status">
          Profile updated successfully.
        </p>
      ) : null}

      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-linear-to-r from-primary/80 via-primary to-accent/80" aria-hidden />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
          <span className="-mt-10 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface bg-primary/15 text-xl font-bold text-primary shadow-sm">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="size-full object-cover" />
            ) : (
              initialsOf(user)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-ink">{displayName(user)}</h2>
              <Badge tone={superAdmin ? 'brand' : 'neutral'}>{roleName}</Badge>
              <Badge tone={statusTone(user.status)}>{titleCase(user.status)}</Badge>
              {user.emailVerified ? (
                <Badge tone="success">
                  <BadgeCheck className="mr-1 size-3" aria-hidden />
                  Email verified
                </Badge>
              ) : (
                <Badge tone="warning">Email not verified</Badge>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-ink-muted">{user.email}</p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <p className="text-xs text-ink-subtle">Member since {formatDate(user.createdAt)}</p>
            {editing ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="size-3.5" aria-hidden />
                    {avatarSrc ? 'Replace photo' : 'Add photo'}
                  </Button>
                  {avatarSrc ? (
                    <Button size="sm" variant="danger" onClick={clearPhoto}>
                      <Trash2 className="size-3.5" aria-hidden />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-[11px] text-ink-subtle">JPG, PNG, WebP or AVIF · max 10 MB</p>
              </>
            ) : (
              <Button size="sm" onClick={startEdit}>
                <Pencil className="size-3.5" aria-hidden />
                Edit profile
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              pickPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account information */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Account information"
            description={
              editing
                ? 'Edit your name and photo, then save. Email and mobile stay read-only.'
                : 'Your account details. Use Edit profile to update your name and photo.'
            }
            action={editing ? <Badge tone="brand">Editing</Badge> : undefined}
          />
          {editing ? (
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="profile-first-name" label="First name" required>
                  <Input
                    id="profile-first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={80}
                    autoComplete="given-name"
                  />
                </Field>
                <Field id="profile-last-name" label="Last name" required>
                  <Input
                    id="profile-last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={80}
                    autoComplete="family-name"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="profile-email" label="Email" hint="Email is tied to your sign-in and cannot be changed.">
                  <Input id="profile-email" value={user.email} disabled />
                </Field>
                <Field id="profile-phone" label="Mobile number" hint="Contact an administrator to update your mobile number.">
                  <Input id="profile-phone" value={user.phone || ''} disabled placeholder="Not added" />
                </Field>
              </div>
              {formError ? (
                <p className="rounded-lg border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-xs font-medium text-danger" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
                <Button variant="secondary" onClick={cancelEdit} disabled={updateProfile.isPending}>
                  <X className="size-4" aria-hidden />
                  Cancel
                </Button>
                <Button onClick={() => void save()} loading={updateProfile.isPending}>
                  <Check className="size-4" aria-hidden />
                  Save changes
                </Button>
              </div>
            </div>
          ) : (
            <>
              <dl className="divide-y divide-line">
                {accountRows.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 sm:grid-cols-3">
                    <dt className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
                      {label}
                    </dt>
                    <dd className="col-span-1 break-words text-right text-sm font-medium text-ink sm:col-span-2 sm:text-left">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-line px-5 py-3 text-[11px] leading-relaxed text-ink-subtle">
                Your name and profile photo can be updated with Edit profile. Email and mobile number are managed by
                your administrator for security.
              </p>
            </>
          )}
        </Card>

        {/* Account security */}
        <Card>
          <CardHeader title="Account security" description="Authentication overview — no sensitive data is shown." />
          <ul className="space-y-3 p-5 text-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
                <KeyRound className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink">Session security</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                  Access tokens are short-lived and refreshed automatically. Passwords and tokens are never displayed here.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
                <BadgeCheck className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink">Email verification</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                  {user.emailVerified ? 'Your email address has been verified.' : 'Your email address is not verified yet.'}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
                <UserRound className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink">Last login</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{formatDate(user.lastLogin)}</p>
              </div>
            </li>
          </ul>
        </Card>
      </div>

      {/* Permissions */}
      <Card>
        <CardHeader
          title="Permissions"
          description={
            superAdmin
              ? 'Super Admin has unrestricted access — the backend bypasses permission checks for this role.'
              : `${permissions.length} permission${permissions.length === 1 ? '' : 's'} granted by your role`
          }
          action={superAdmin ? <Badge tone="brand">Full access</Badge> : undefined}
        />
        {superAdmin ? (
          <div className="flex items-start gap-3 p-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">Full administrative access</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                As a Super Admin you can access every module in this dashboard. Permissions are enforced by the backend
                and do not need to be managed manually for this role.
              </p>
            </div>
          </div>
        ) : (
          <PermissionGroups permissions={permissions} />
        )}
      </Card>
    </div>
  );
}
