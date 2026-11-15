'use client';

import { BadgeCheck, ChevronDown, KeyRound, Mail, Phone, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { formatDate, titleCase } from '@/lib/format';
import { displayName, initialsOf, isSuperAdmin } from '@/lib/roles';

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

export function ProfileDetails() {
  const { user } = useAuth();
  if (!user) return null;

  const superAdmin = isSuperAdmin(user);
  const permissions = user.role?.permissions ?? [];
  const roleName = user.role?.name || titleCase(user.role?.slug || 'User');

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
      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-linear-to-r from-primary/80 via-primary to-accent/80" aria-hidden />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
          <span className="-mt-10 flex size-20 shrink-0 items-center justify-center rounded-2xl border-4 border-surface bg-primary/15 text-xl font-bold text-primary shadow-sm">
            {initialsOf(user)}
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
          <p className="text-xs text-ink-subtle">Member since {formatDate(user.createdAt)}</p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Account information */}
        <Card className="lg:col-span-2">
          <CardHeader title="Account information" description="Read-only details from your signed-in session." />
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
            Your profile information is managed by your administrator. Contact your system administrator if you need to
            update your account details.
          </p>
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
