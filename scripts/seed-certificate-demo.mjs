#!/usr/bin/env node
/**
 * Creates demo data for trying certificate templates and issuance in the admin console:
 * a draft "[Demo]" course with certificates enabled, two published lessons, and two demo learners:
 * one who completed both lessons (eligible) and one halfway through (not eligible).
 * Templates are intentionally not created so they can be designed in the console.
 * Everything goes through the public API (no direct DB access).
 *
 *   node scripts/seed-certificate-demo.mjs            create demo data
 *   node scripts/seed-certificate-demo.mjs --cleanup  remove what this script created
 *
 * Env: API_BASE (default http://localhost:5000/api/v1), ADMIN_EMAIL, ADMIN_PASSWORD (prompted when unset)
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_BASE || 'http://localhost:5000/api/v1').replace(/\/$/, '');
const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), '.certificate-demo-state.json');
const cleanup = process.argv.includes('--cleanup');

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (text) => rl.output.write(text.includes(question) ? text : '*');
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function api(method, path, { token, body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json?.error?.message ?? ''}`.trim());
  return json;
}

const login = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).data.accessToken;

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
  // Issued certificates have no delete API; revoking keeps their history intact.
  if (state.courseId) {
    try {
      const certs = (await api('GET', `/admin/certificates?courseId=${state.courseId}&status=issued&limit=100`, { token })).data.certificates;
      for (const c of certs) {
        await api('POST', `/admin/certificates/${c.id}/revoke`, { token, body: { reason: 'Demo data cleanup' } });
        console.log(`✓ revoked demo certificate ${c.certificateNumber}`);
      }
    } catch (err) {
      console.log(`! could not revoke demo certificates: ${err.message}`);
    }
  }
  const steps = [
    ...(state.enrollmentIds ?? []).map((id) => ['DELETE', `/admin/enrollments/${id}`, 'enrollment']),
    ...(state.studentIds ?? []).map((id) => ['DELETE', `/admin/users/${id}`, 'demo learner']),
    ...(state.courseId ? [['DELETE', `/admin/courses/${state.courseId}`, 'demo course']] : []),
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
  console.log('Cleanup finished. Templates you created yourself are left untouched.');
}

async function runSeed() {
  if (existsSync(STATE_FILE)) {
    console.log('Demo data already exists. Run with --cleanup first to recreate it.');
    return;
  }
  console.log(`API: ${API}`);
  const token = await adminToken();
  const stamp = Date.now().toString(36);
  const state = { createdAt: new Date().toISOString(), courseId: null, studentIds: [], enrollmentIds: [] };
  const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  try {
    // Publishing needs a thumbnail, category and instructor: reuse those of an existing published course.
    const donor = (await api('GET', '/admin/courses?status=published&limit=1', { token })).data[0];
    const thumbnail = donor?.thumbnail?.publicId ? Object.fromEntries(Object.entries(donor.thumbnail).filter(([, v]) => v !== null && v !== undefined)) : undefined;
    const course = (
      await api('POST', '/admin/courses', {
        token,
        body: {
          title: `[Demo] Certificate Practice ${stamp}`,
          shortDescription: 'Demo course for trying certificate templates and issuance.',
          description: '<p>Two short lessons. Complete both to become eligible for a certificate.</p>',
          level: 'beginner',
          ...(thumbnail ? { thumbnail } : {}),
          ...(donor?.categoryIds?.length ? { categoryIds: donor.categoryIds } : {}),
          ...(donor?.instructorIds?.length ? { instructorIds: donor.instructorIds } : {}),
          certificate: { enabled: true, minimumCompletionPercentage: 80, autoIssue: false },
        },
      })
    ).data.course;
    state.courseId = course.id;
    save();

    const topic = (await api('POST', `/admin/courses/${course.id}/topics`, { token, body: { title: 'Getting started', status: 'published' } })).data.topic;
    const lessonDefs = [
      ['Welcome to GMP', '<p>Good Manufacturing Practice keeps every batch consistent, documented and safe.</p>'],
      ['Documentation essentials', '<p>If it is not written down, it did not happen: records must be attributable, legible and contemporaneous.</p>'],
    ];
    const lessons = [];
    for (const [title, body] of lessonDefs) {
      const lesson = (await api('POST', `/admin/topics/${topic.id}/lessons`, { token, body: { title, type: 'text' } })).data.lesson;
      await api('PATCH', `/admin/lessons/${lesson.id}`, { token, body: { content: { textContent: { body, format: 'html' } } } });
      await api('PATCH', `/admin/lessons/${lesson.id}/status`, { token, body: { status: 'published' } });
      lessons.push(lesson);
    }

    // Lesson completion requires a published course; it goes back to draft once progress is recorded.
    await api('PATCH', `/admin/courses/${course.id}/status`, { token, body: { status: 'published' } });

    const studentRole = (await api('GET', '/admin/roles', { token })).data.roles.find((r) => r.slug === 'student');
    if (!studentRole) throw new Error('Student role not found.');
    const learners = [
      { firstName: 'Riya', lastName: 'Demo', email: `demo.cert.riya.${stamp}@example.com`, complete: lessons.length },
      { firstName: 'Kabir', lastName: 'Demo', email: `demo.cert.kabir.${stamp}@example.com`, complete: 1 },
    ];
    for (const l of learners) {
      const password = `Demo#${randomBytes(6).toString('hex')}A1`;
      const user = (await api('POST', '/admin/users', { token, body: { firstName: l.firstName, lastName: l.lastName, email: l.email, password, roleId: studentRole.id, status: 'active' } })).data.user;
      l.id = user.id;
      state.studentIds.push(user.id);
      save();
      const enrollment = (await api('POST', '/admin/enrollments', { token, body: { studentId: user.id, courseId: course.id, enrollmentType: 'admin_granted', allowUnpublished: true, reason: 'Certificate demo' } })).data.enrollment;
      state.enrollmentIds.push(enrollment.id);
      save();
      const learnerToken = await login(l.email, password);
      for (const lesson of lessons.slice(0, l.complete)) {
        await api('POST', `/student/lessons/${lesson.id}/complete`, { token: learnerToken, body: {} });
      }
    }

    await api('PATCH', `/admin/courses/${course.id}/status`, { token, body: { status: 'draft' } });
    const check = async () =>
      Promise.all(learners.map(async (l) => ({ l, el: (await api('GET', `/admin/students/${l.id}/certificate-eligibility/${course.id}`, { token })).data.eligibility })));
    let results = await check();
    let visibility = 'draft';
    if (!results[0].el.eligible) {
      // Some setups require a published course for certificate eligibility.
      await api('PATCH', `/admin/courses/${course.id}/status`, { token, body: { status: 'published' } });
      results = await check();
      visibility = 'published';
    }

    console.log(`\nCreated "${course.title}" (${visibility}, certificates enabled, 80% minimum).`);
    for (const { l, el } of results) {
      console.log(`  ${l.firstName} ${l.lastName}: ${el.eligible ? 'ELIGIBLE' : 'not eligible'} (${el.requiredLessonsCompleted}/${el.totalRequiredLessons} lessons, ${el.progressPercentage}%)${el.eligible ? '' : ` — ${el.reason}`}`);
    }
    console.log('\nNext: Certificates → Templates → New template, then Issued certificates → Issue certificate → search "Demo".');
  } catch (err) {
    console.error(`\nStopped: ${err.message}\nPartial data is recorded; run with --cleanup to remove it.`);
    process.exitCode = 1;
  }
}

await (cleanup ? runCleanup() : runSeed());
