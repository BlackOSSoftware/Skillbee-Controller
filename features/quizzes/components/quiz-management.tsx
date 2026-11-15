'use client';

import { BookCheck, CircleCheckBig, Hourglass, Library, ListChecks, Megaphone, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { AttemptStatus, QuizStatus } from '@/types/quizzes';
import { quizPolicy, useQuizStats, type QuizStatKey } from '../hooks';
import { AttemptsPanel } from './attempts-panel';
import { QuestionBankPanel } from './question-bank-panel';
import { QuizzesPanel } from './quizzes-panel';

type Tab = 'quizzes' | 'attempts' | 'bank';

export interface AttemptPreset {
  quizId?: string;
  status?: AttemptStatus;
}

const KPIS: Array<{ key: QuizStatKey; label: string; hint: string; icon: LucideIcon; tone: KpiTone; tab: Tab; quizStatus?: QuizStatus; attemptStatus?: AttemptStatus }> = [
  { key: 'quizzes', label: 'Quizzes', hint: 'All statuses', icon: ListChecks, tone: 'purple', tab: 'quizzes' },
  { key: 'published', label: 'Published', hint: 'Open to learners', icon: Megaphone, tone: 'teal', tab: 'quizzes', quizStatus: 'published' },
  { key: 'attempts', label: 'Attempts', hint: 'All learners', icon: BookCheck, tone: 'sky', tab: 'attempts' },
  { key: 'pending', label: 'Pending grading', hint: 'Manual review', icon: Hourglass, tone: 'coral', tab: 'attempts', attemptStatus: 'evaluating' },
  { key: 'evaluated', label: 'Completed', hint: 'Fully evaluated', icon: CircleCheckBig, tone: 'amber', tab: 'attempts', attemptStatus: 'evaluated' },
  { key: 'bank', label: 'Question bank', hint: 'Active items', icon: Library, tone: 'purple', tab: 'bank' },
];

export function QuizManagement() {
  const { user } = useAuth();
  const stats = useQuizStats(user);
  const canAttempts = quizPolicy.canReadAttempts(user);
  const canBank = quizPolicy.canReadBank(user);
  const [selectedTab, setTabState] = useState<Tab>('quizzes');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['quizzes']));
  /** Permissions can be revoked mid-session; fall back to the always-available tab. */
  const tab: Tab = (selectedTab === 'attempts' && !canAttempts) || (selectedTab === 'bank' && !canBank) ? 'quizzes' : selectedTab;

  function setTab(next: Tab) {
    setTabState(next);
    setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
  }
  const [quizPreset, setQuizPreset] = useState<{ status?: QuizStatus; v: number }>({ v: 0 });
  const [attemptPreset, setAttemptPreset] = useState<AttemptPreset & { v: number }>({ v: 0 });

  const tabs: Array<{ id: Tab; label: string; count: number | null; show: boolean }> = [
    { id: 'quizzes', label: 'Quizzes', count: stats.quizzes.value, show: true },
    { id: 'attempts', label: 'Attempts & results', count: stats.attempts.value, show: canAttempts },
    { id: 'bank', label: 'Question bank', count: stats.bank.value, show: canBank },
  ];

  function openAttempts(preset: AttemptPreset) {
    setAttemptPreset((p) => ({ ...preset, v: p.v + 1 }));
    setTab('attempts');
  }

  return (
    <>
      <PageHeader
        title="Quizzes & Results"
        description="Assessments, learner attempts, manual grading and the shared question bank."
        actions={<RefreshButton queryKeys={[queryKeys.quizzes.all]} />}
      />

      <section aria-label="Assessment overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {KPIS.filter((k) => stats[k.key].allowed).map(({ key, label, hint, icon, tone, tab: target, quizStatus, attemptStatus }) => {
          const stat = stats[key];
          return (
            <KpiCard
              key={key}
              label={label}
              icon={icon}
              tone={tone}
              hint={hint}
              value={stat.value}
              isLoading={stat.isLoading}
              error={stat.error}
              onClick={() => {
                if (target === 'quizzes') {
                  setQuizPreset((p) => ({ status: quizStatus, v: p.v + 1 }));
                  setTab('quizzes');
                } else if (target === 'attempts') openAttempts({ status: attemptStatus });
                else setTab('bank');
              }}
            />
          );
        })}
      </section>

      <div role="tablist" aria-label="Quiz sections" className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none]">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`quiz-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`quiz-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35',
                tab === t.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              {t.label}
              {t.count !== null ? (
                <span className={cn('rounded px-1.5 py-px text-[11px] tabular-nums', tab === t.id ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-muted')}>{formatNumber(t.count)}</span>
              ) : null}
            </button>
          ))}
      </div>

      {/* Visited panels stay mounted (hidden) so their filters and pages survive tab switches. */}
      <div role="tabpanel" id="quiz-panel-quizzes" aria-labelledby="quiz-tab-quizzes" hidden={tab !== 'quizzes'}>
        <QuizzesPanel key={`q-${quizPreset.v}`} initialStatus={quizPreset.status} />
      </div>
      {canAttempts && visited.has('attempts') ? (
        <div role="tabpanel" id="quiz-panel-attempts" aria-labelledby="quiz-tab-attempts" hidden={tab !== 'attempts'}>
          <AttemptsPanel key={`a-${attemptPreset.v}`} preset={attemptPreset} />
        </div>
      ) : null}
      {canBank && visited.has('bank') ? (
        <div role="tabpanel" id="quiz-panel-bank" aria-labelledby="quiz-tab-bank" hidden={tab !== 'bank'}>
          <QuestionBankPanel />
        </div>
      ) : null}
    </>
  );
}
