import { notFound } from 'next/navigation';
import { ModuleGate } from '@/components/layout/module-gate';
import { ModuleWorkspace } from '@/components/layout/module-workspace';
import { findModuleBySlug, MODULES } from '@/lib/navigation';

/** Admin pages render only after the client verifies the session. */
export const instant = false;

/** Modules with dedicated route folders are excluded so they are not generated twice. */
const DEDICATED_ROUTES = new Set(['dashboard', 'users', 'roles', 'profile', 'instructors', 'instructor-applications', 'referrals', 'courses', 'categories', 'enrollments', 'assignments', 'quizzes', 'questions', 'newsletter', 'faqs', 'blogs', 'seo', 'notifications', 'email', 'site-settings', 'reports', 'audit-logs']);

export function generateStaticParams() {
  return MODULES.filter((m) => !DEDICATED_ROUTES.has(m.slug)).map((m) => ({ module: m.slug }));
}

export default async function ModulePage(props: PageProps<'/[module]'>) {
  const { module: slug } = await props.params;
  const definition = findModuleBySlug(slug);
  if (!definition) notFound();

  return (
    <ModuleGate slug={definition.slug}>
      {/* Reading params in generateMetadata would block prefetching under Cache Components */}
      <title>{`${definition.label} · SkillBee Admin`}</title>
      <ModuleWorkspace module={definition} />
    </ModuleGate>
  );
}
