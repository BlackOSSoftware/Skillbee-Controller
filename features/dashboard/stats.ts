import {
  BookOpen,
  CreditCard,
  FileUser,
  GraduationCap,
  IndianRupee,
  Inbox,
  MessagesSquare,
  ShieldCheck,
  UserPlus,
  Users,
  BadgeCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StatSource {
  path: string;
  params?: Record<string, string>;
}

export interface DashboardStatDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Summed when more than one source is listed. */
  sources: StatSource[];
  hint?: string;
  /** Set when no backend endpoint can provide this number. */
  unavailableReason?: string;
}

export const DASHBOARD_STATS: DashboardStatDefinition[] = [
  {
    id: 'students',
    label: 'Total students',
    icon: Users,
    href: '/users',
    sources: [{ path: '/admin/users', params: { role: 'student' } }],
  },
  {
    id: 'instructors',
    label: 'Total instructors',
    icon: GraduationCap,
    href: '/instructors',
    sources: [{ path: '/admin/users', params: { role: 'instructor' } }],
  },
  {
    id: 'admins',
    label: 'Total admins',
    icon: ShieldCheck,
    href: '/users',
    sources: [
      { path: '/admin/users', params: { role: 'admin' } },
      { path: '/admin/users', params: { role: 'super_admin' } },
    ],
    hint: 'Admins + super admins',
  },
  {
    id: 'courses',
    label: 'Total courses',
    icon: BookOpen,
    href: '/courses',
    sources: [{ path: '/admin/courses' }],
  },
  {
    id: 'published-courses',
    label: 'Published courses',
    icon: BadgeCheck,
    href: '/courses',
    sources: [{ path: '/admin/courses', params: { status: 'published' } }],
  },
  {
    id: 'enrollments',
    label: 'Total enrollments',
    icon: UserPlus,
    href: '/enrollments',
    sources: [{ path: '/admin/enrollments' }],
  },
  {
    id: 'revenue',
    label: 'Total revenue',
    icon: IndianRupee,
    sources: [],
    unavailableReason: 'No revenue aggregate endpoint. Summing paginated orders client-side would be inaccurate.',
  },
  {
    id: 'pending-payments',
    label: 'Pending payments',
    icon: CreditCard,
    href: '/orders',
    sources: [{ path: '/admin/orders', params: { paymentStatus: 'pending' } }],
    hint: 'Orders with payment status pending',
  },
  {
    id: 'pending-applications',
    label: 'Pending instructor applications',
    icon: FileUser,
    href: '/instructor-applications',
    sources: [{ path: '/admin/instructor-applications', params: { status: 'pending' } }],
  },
  {
    id: 'pending-enquiries',
    label: 'Pending enquiries',
    icon: Inbox,
    sources: [],
    unavailableReason: 'No contact/enquiry endpoints exist in the backend.',
  },
  {
    id: 'unanswered-questions',
    label: 'Unanswered questions',
    icon: MessagesSquare,
    href: '/questions',
    sources: [{ path: '/admin/questions-answers', params: { answered: 'unanswered' } }],
    hint: 'Questions with no replies',
  },
];
