#!/usr/bin/env node
/**
 * Creates demo assessment data so grading can be tried in the admin console:
 * an assignment with two submissions, a quiz with question-bank items, and three quiz attempts
 * (two waiting for manual grading). Everything goes through the public API (no direct DB access)
 * and is labelled "[Demo]".
 *
 *   node scripts/seed-assignment-demo.mjs            create demo data
 *   node scripts/seed-assignment-demo.mjs --cleanup  remove what this script created
 *
 * Env: API_BASE (default http://localhost:5000/api/v1), ADMIN_EMAIL, ADMIN_PASSWORD (prompted when unset), COURSE_ID (optional)
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_BASE || 'http://localhost:5000/api/v1').replace(/\/$/, '');
const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), '.assignment-demo-state.json');
const cleanup = process.argv.includes('--cleanup');

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Mask typed characters so the password never appears on screen
      rl._writeToOutput = (text) => rl.output.write(text.includes(question) ? text : '*');
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function api(method, path, { token, body, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json?.error?.message ?? ''}`.trim());
  return json;
}

async function login(email, password) {
  const json = await api('POST', '/auth/login', { body: { email, password } });
  return json.data.accessToken;
}

async function adminToken() {
  const email = process.env.ADMIN_EMAIL || (await ask('Admin email: '));
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password: ', { hidden: true }));
  return login(email, password);
}

async function runCleanup() {
  if (!existsSync(STATE_FILE)) {
    console.log('Nothing to clean up (no state file found).');
    return;
  }
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const token = await adminToken();
  const steps = [
    ...(state.assignmentIds ?? []).map((id) => ['DELETE', `/admin/assignments/${id}`, 'assignment']),
    ...(state.quizIds ?? []).map((id) => ['DELETE', `/admin/quizzes/${id}`, 'quiz']),
    ...(state.bankIds ?? []).map((id) => ['DELETE', `/admin/question-bank/${id}`, 'question bank item']),
    ...(state.enrollmentIds ?? []).map((id) => ['DELETE', `/admin/enrollments/${id}`, 'enrollment']),
    ...(state.studentIds ?? []).map((id) => ['DELETE', `/admin/users/${id}`, 'demo learner']),
  ];
  for (const [method, path, label] of steps) {
    try {
      await api(method, path, { token });
      console.log(`✓ removed ${label}`);
    } catch (err) {
      console.log(`! could not remove ${label}: ${err.message}`);
    }
  }
  unlinkSync(STATE_FILE);
  console.log('Cleanup finished. (Quiz attempts have no delete API; they stay attached to the archived demo quiz.)');
}

const mcq = (questionText, options, correct, extra = {}) => ({
  questionText,
  questionType: 'multiple_choice',
  marks: 2,
  options: options.map((text, i) => ({ id: `o${i + 1}`, text, sortOrder: i })),
  correctOptionIds: [`o${correct + 1}`],
  difficulty: 'easy',
  ...extra,
});

const QUIZ_QUESTIONS = [
  mcq('What does GMP stand for?', ['Good Manufacturing Practice', 'General Medical Procedure', 'Global Marketing Plan', 'Good Measurement Process'], 0, {
    explanation: 'GMP is the set of practices that keeps products consistently produced and controlled to quality standards.',
    tags: ['gmp', 'basics'],
  }),
  {
    questionText: 'Which of these belong to the ALCOA principles of data integrity?',
    questionType: 'multiple_select',
    marks: 2,
    options: ['Attributable', 'Legible', 'Approximate', 'Contemporaneous'].map((text, i) => ({ id: `o${i + 1}`, text, sortOrder: i })),
    correctOptionIds: ['o1', 'o2', 'o4'],
    explanation: 'ALCOA: Attributable, Legible, Contemporaneous, Original, Accurate.',
    difficulty: 'medium',
    tags: ['data-integrity'],
  },
  { questionText: 'A deviation must be documented even when it has no impact on product quality.', questionType: 'true_false', marks: 1, correctAnswer: true, difficulty: 'easy', explanation: 'All deviations are recorded and assessed.' },
  { questionText: 'Name the document that captures what users need a computerized system to do (acronym).', questionType: 'short_answer', marks: 1, acceptedAnswers: ['URS'], answerMatchingMode: 'case_insensitive', difficulty: 'medium' },
  { questionText: 'CAPA stands for Corrective And _____ Action.', questionType: 'fill_in_the_blanks', marks: 1, blanks: [{ id: 'b1', acceptedAnswers: ['Preventive', 'Preventative'], marks: 1 }], difficulty: 'easy' },
  {
    questionText: 'Explain how you would investigate a line-clearance failure and prevent it from happening again.',
    questionType: 'long_answer',
    marks: 6,
    gradingRubric: [
      { criterion: 'Root cause analysis', maximumMarks: 3, description: 'Uses a structured method and identifies a plausible root cause.' },
      { criterion: 'CAPA quality', maximumMarks: 3, description: 'Corrective and preventive actions are specific and verifiable.' },
    ],
    difficulty: 'hard',
    tags: ['capa', 'essay'],
  },
];

const BANK_ITEMS = [
  { ...mcq('Which record proves that equipment was cleaned before use?', ['Cleaning log', 'Purchase order', 'Training matrix', 'Shipping label'], 0), category: 'demo-gmp', tags: ['cleaning'] },
  { questionText: 'Electronic signatures must be linked to their respective electronic records.', questionType: 'true_false', correctAnswer: true, defaultMarks: 1, difficulty: 'medium', category: 'demo-data-integrity', tags: ['part-11'] },
  {
    questionText: 'Describe the difference between corrective and preventive actions, with one example of each.',
    questionType: 'long_answer',
    defaultMarks: 4,
    gradingRubric: [{ criterion: 'Clear distinction', maximumMarks: 2 }, { criterion: 'Relevant examples', maximumMarks: 2 }],
    difficulty: 'hard',
    category: 'demo-gmp',
    tags: ['capa'],
  },
];

/** Builds answers by question text from the student start payload (ids are server-issued). */
function answersFor(questions, picks) {
  return questions
    .map((q) => {
      const pick = picks[q.questionType];
      if (pick === undefined) return null;
      const byText = (texts) => q.options.filter((o) => texts.includes(o.text)).map((o) => o.id);
      if (q.questionType === 'multiple_choice' || q.questionType === 'multiple_select') return { questionId: q.id, answer: { selectedOptionIds: byText(pick) } };
      if (q.questionType === 'true_false') return { questionId: q.id, answer: { booleanAnswer: pick } };
      if (q.questionType === 'fill_in_the_blanks') return { questionId: q.id, answer: { blankAnswers: [{ blankId: q.blanks[0].id, value: pick }] } };
      return { questionId: q.id, answer: { text: pick } };
    })
    .filter(Boolean);
}

async function runSeed() {
  if (existsSync(STATE_FILE)) {
    console.log('Demo data already exists. Run with --cleanup first to recreate it.');
    return;
  }
  console.log(`API: ${API}`);
  const token = await adminToken();

  let course;
  if (process.env.COURSE_ID) {
    course = (await api('GET', `/admin/courses/${process.env.COURSE_ID}`, { token })).data.course;
  } else {
    const published = (await api('GET', '/admin/courses?status=published&limit=1', { token })).data;
    course = published[0] ?? (await api('GET', '/admin/courses?status=draft&limit=1', { token })).data[0];
  }
  if (!course) throw new Error('No course found. Create a course first or pass COURSE_ID.');
  const courseId = course.id;
  console.log(`Course: ${course.title} (${course.status})`);

  const roles = (await api('GET', '/admin/roles', { token })).data.roles;
  const studentRole = roles.find((r) => r.slug === 'student');
  if (!studentRole) throw new Error('Student role not found.');

  const stamp = Date.now().toString(36);
  const learners = [
    { firstName: 'Aarav', lastName: 'Demo', email: `demo.learner1.${stamp}@example.com` },
    { firstName: 'Meera', lastName: 'Demo', email: `demo.learner2.${stamp}@example.com` },
  ].map((l) => ({ ...l, password: `Demo#${randomBytes(6).toString('hex')}A1` }));

  const state = { createdAt: new Date().toISOString(), courseId, studentIds: [], enrollmentIds: [], assignmentIds: [], quizIds: [], bankIds: [] };
  const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  const summary = [];

  try {
    for (const l of learners) {
      const user = (await api('POST', '/admin/users', { token, body: { firstName: l.firstName, lastName: l.lastName, email: l.email, password: l.password, roleId: studentRole.id, status: 'active' } })).data.user;
      l.id = user.id;
      state.studentIds.push(user.id);
      save();
      const enrollment = (await api('POST', '/admin/enrollments', { token, body: { studentId: user.id, courseId, enrollmentType: 'admin_granted', allowUnpublished: true, reason: 'Demo data for grading practice' } })).data.enrollment;
      state.enrollmentIds.push(enrollment.id);
      save();
      l.token = await login(l.email, l.password);
    }

    // Assignment with two submissions
    const assignment = (
      await api('POST', '/admin/assignments', {
        token,
        body: {
          courseId,
          title: `[Demo] CAPA plan – grading practice ${stamp}`,
          instructions: 'Write a short corrective and preventive action (CAPA) plan for a line-clearance deviation.\n\n1. Root cause\n2. Corrective action\n3. Preventive action\n\nAttach your report as a PDF or TXT file.',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          maximumMarks: 100,
          submissionType: 'file_and_text',
          allowedFileTypes: ['.pdf', '.txt'],
          allowLateSubmission: true,
          allowResubmission: true,
          maxSubmissions: 3,
        },
      })
    ).data.assignment;
    state.assignmentIds.push(assignment.id);
    save();
    await api('PATCH', `/admin/assignments/${assignment.id}/status`, { token, body: { status: 'published' } });
    const essays = [
      'Root cause: the previous batch label was not removed during line clearance.\nCorrective: quarantine affected units and re-inspect.\nPreventive: add a second-person verification step to the clearance checklist.',
      'Root cause: operator skipped the checklist under time pressure.\nCorrective: retrain the shift.\nPreventive: make the electronic checklist mandatory before batch start.',
    ];
    for (const [i, l] of learners.entries()) {
      const form = new FormData();
      form.append('textContent', essays[i]);
      form.append('files', new Blob([`CAPA report — ${l.firstName} ${l.lastName}\n\n${essays[i]}\n`], { type: 'text/plain' }), `capa-report-${i + 1}.txt`);
      await api('POST', `/student/assignments/${assignment.id}/submit`, { token: l.token, form });
    }
    summary.push(`Assignment "${assignment.title}" with 2 submissions awaiting review`);

    // Question bank
    for (const item of BANK_ITEMS) {
      const q = (await api('POST', '/admin/question-bank', { token, body: item })).data.question;
      state.bankIds.push(q.id);
      save();
    }
    summary.push(`${BANK_ITEMS.length} question bank items (categories demo-gmp, demo-data-integrity)`);

    // Quiz with mixed question types, including one from the bank
    const quiz = (
      await api('POST', '/admin/quizzes', {
        token,
        body: {
          courseId,
          title: `[Demo] GMP essentials check ${stamp}`,
          description: 'Short assessment covering GMP basics, data integrity and CAPA.',
          instructions: 'Answer every question. The final question is graded manually by your instructor.',
          timeLimitSeconds: 1800,
          passingPercentage: 60,
          maximumAttempts: 3,
          showResults: 'after_manual_grading',
          showCorrectAnswers: true,
          showExplanation: true,
          allowResume: true,
          tags: ['demo', 'gmp'],
        },
      })
    ).data.quiz;
    state.quizIds.push(quiz.id);
    save();
    for (const q of QUIZ_QUESTIONS) await api('POST', `/admin/quizzes/${quiz.id}/questions`, { token, body: q });
    await api('POST', `/admin/quizzes/${quiz.id}/questions/from-bank`, { token, body: { questionBankIds: [state.bankIds[0]] } });
    await api('PATCH', `/admin/quizzes/${quiz.id}/status`, { token, body: { status: 'published' } });
    summary.push(`Quiz "${quiz.title}" (${QUIZ_QUESTIONS.length + 1} questions, published)`);

    if (course.status !== 'published') {
      summary.push('Quiz attempts skipped: learners can only start quizzes on a published course');
    } else {
      const runs = [
        {
          learner: learners[0],
          picks: {
            multiple_choice: ['Good Manufacturing Practice', 'Cleaning log'],
            multiple_select: ['Attributable', 'Legible', 'Contemporaneous'],
            true_false: true,
            short_answer: 'URS',
            fill_in_the_blanks: 'Preventive',
            long_answer:
              'I would start with a 5-Whys and fishbone analysis with the line operators and QA. The likely root cause is that the clearance checklist allowed a single signature. Corrective: segregate and re-inspect the affected batch. Preventive: add independent second-person verification, update the SOP and retrain the shift, then trend line-clearance deviations for three months to confirm effectiveness.',
          },
        },
        {
          learner: learners[1],
          picks: {
            multiple_choice: ['General Medical Procedure', 'Cleaning log'],
            multiple_select: ['Attributable', 'Approximate'],
            true_false: true,
            short_answer: 'SRS',
            fill_in_the_blanks: 'preventive',
            long_answer: 'Check what went wrong and tell the operators to be more careful next time.',
          },
        },
        {
          learner: learners[1],
          picks: { multiple_choice: ['Good Manufacturing Practice', 'Purchase order'], multiple_select: ['Attributable', 'Legible', 'Contemporaneous'], true_false: false, short_answer: 'URS' },
        },
      ];
      for (const run of runs) {
        const started = (await api('POST', `/student/quizzes/${quiz.id}/start`, { token: run.learner.token })).data;
        await api('POST', `/student/quiz-attempts/${started.attemptId}/submit`, { token: run.learner.token, body: { answers: answersFor(started.questions, run.picks) } });
      }
      summary.push('3 quiz attempts: 2 waiting for manual grading, 1 fully auto-graded');
    }

    console.log('\n✓ Demo data created');
    for (const line of summary) console.log(`  - ${line}`);
    console.log('\n  Demo learner logins (to try the student side):');
    for (const l of learners) console.log(`  - ${l.email}  /  ${l.password}`);
    console.log('\n  Remove everything later with: node scripts/seed-assignment-demo.mjs --cleanup');
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    if (summary.length) console.error(`  Created before the failure: ${summary.join('; ')}`);
    console.error('  Partially created records are tracked; run with --cleanup to remove them.');
    process.exitCode = 1;
  }
}

(cleanup ? runCleanup() : runSeed()).catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
});
