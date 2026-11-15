#!/usr/bin/env node
/**
 * Demo data for Reviews Management on the development backend: demo learners with active enrollments
 * in the published courses, and course reviews in every moderation state (most left pending so they
 * can be approved or rejected from the console).
 *
 * Uses the backend's own services (manual enrollment, student review submission, moderation) against
 * the database in backend/.env, so reviews carry real enrollments, moderation history and rating stats.
 *
 *   node scripts/seed-reviews-demo.mjs            create demo data
 *   node scripts/seed-reviews-demo.mjs --cleanup  remove exactly what this script created
 *
 * Refuses to run when NODE_ENV=production.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(HERE, '..', '..', 'backend');
const STATE_FILE = join(HERE, '.reviews-demo-state.json');
const cleanup = process.argv.includes('--cleanup');

process.chdir(BACKEND);
const load = (p) => import(pathToFileURL(join(BACKEND, 'src', p)).href);

const { env } = await load('config/env.js');
if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo reviews with NODE_ENV=production.');
  process.exit(1);
}
const { connectDatabase, disconnectDatabase } = await load('config/database.js');
const { disconnectRedis } = await load('config/redis.js');
const { ROLE_SLUGS } = await load('config/security.js');
const { User } = await load('models/User.js');
const { Role } = await load('models/Role.js');
const { Course } = await load('models/Course.js');
const { CourseReview } = await load('models/CourseReview.js');
const { CourseEnrollment } = await load('models/CourseEnrollment.js');
const { AppNotification } = await load('models/AppNotification.js');
const { createUser } = await load('services/users.service.js');
const { createManualEnrollment } = await load('modules/enrollment/services/enrollment.service.js');
const { createStudentReview, moderateReview } = await load('modules/courses/services/review.service.js');
const { recalculateCourseRatingStats } = await load('modules/courses/services/ratingStats.service.js');
const { invalidateEnrollmentCaches } = await load('services/cache/invalidation.service.js');

/** [first, last, course index, rating, title, comment, outcome] */
const REVIEWS = [
  ['Ananya', 'Rao', 0, 5, 'Clear, practical and well paced', 'The Express middleware and error-handling sections finally made things click for me. The MongoDB indexing lesson alone was worth it.', 'pending'],
  ['Vikram', 'Singh', 0, 4, 'Great content, a few gaps', 'Very good coverage of REST design. I wish the authentication module went deeper into refresh-token rotation, but overall strong.', 'pending'],
  ['Neha', 'Kapoor', 1, 2, 'Too fast for beginners', 'The instructor clearly knows the topic, but the async/await chapter assumes a lot of prior knowledge. Some exercises have no solutions.', 'pending'],
  ['Arjun', 'Nair', 2, 3, 'Useful overview of CSV/CSA', 'Good introduction to risk-based validation. The examples are mostly pharma; more on medical devices would help.', 'pending'],
  ['Priya', 'Desai', 2, 1, 'Check out my channel', 'Buy cheap certificates at my website, link in profile!!!', 'pending'],
  ['Rahul', 'Joshi', 0, 5, 'Best backend course I have taken', 'Projects are realistic and the deployment chapter covers environment variables and logging properly.', 'approved'],
  ['Sneha', 'Pillai', 1, 4, 'Solid fundamentals', 'Well structured. The quizzes after each topic helped me retain the material.', 'approved'],
  ['Karan', 'Bhatia', 2, 4, 'Helped me prepare for an audit', 'The documentation templates and the GAMP 5 walkthrough were directly applicable at work.', 'approved'],
  ['Meghna', 'Shah', 1, 1, 'Waste of money', 'Contact me on WhatsApp for the full course for free.', 'rejected'],
];

async function finish(code = 0) {
  await new Promise((r) => setTimeout(r, 1000));
  await disconnectRedis().catch(() => {});
  await disconnectDatabase().catch(() => {});
  process.exit(code);
}

async function recountEnrollments(courseIds) {
  for (const courseId of courseIds) {
    const count = await CourseEnrollment.countDocuments({ courseId, deletedAt: null, status: { $in: ['active', 'completed', 'pending'] } });
    await Course.updateOne({ _id: courseId }, { $set: { 'enrollment.currentStudents': count } });
  }
}

async function runCleanup() {
  if (!existsSync(STATE_FILE)) {
    console.log('Nothing to clean up (no state file found).');
    return;
  }
  const s = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const results = {
    reviews: (await CourseReview.deleteMany({ studentId: { $in: s.studentIds } })).deletedCount,
    enrollments: (await CourseEnrollment.deleteMany({ studentId: { $in: s.studentIds } })).deletedCount,
    notifications: (await AppNotification.deleteMany({ recipientId: { $in: s.studentIds } })).deletedCount,
    learners: (await User.deleteMany({ _id: { $in: s.studentIds } })).deletedCount,
  };
  for (const courseId of s.courseIds) await recalculateCourseRatingStats(courseId);
  await recountEnrollments(s.courseIds);
  for (const id of s.studentIds) for (const courseId of s.courseIds) await invalidateEnrollmentCaches({ studentId: id, courseId });
  unlinkSync(STATE_FILE);
  console.log('Removed demo review data:', JSON.stringify(results));
  console.log('Rating stats and enrollment counts of the affected courses were recalculated.');
}

async function runSeed() {
  if (existsSync(STATE_FILE)) {
    console.log('Demo reviews already exist. Run with --cleanup first to recreate them.');
    return;
  }
  const superRole = await Role.findOne({ slug: ROLE_SLUGS.SUPER_ADMIN });
  const studentRole = await Role.findOne({ slug: ROLE_SLUGS.STUDENT });
  const admin = superRole && (await User.findOne({ roleId: superRole._id, deletedAt: null }));
  if (!admin || !studentRole) throw new Error('A super admin account and the student role are required.');
  const adminReq = { user: admin, role: superRole };

  const courses = await Course.find({ status: 'published', deletedAt: null }).sort({ createdAt: 1 }).limit(3);
  if (!courses.length) throw new Error('Need at least one published course.');
  const courseAt = (i) => courses[i % courses.length];

  const stamp = Date.now().toString(36).slice(-5);
  const state = { createdAt: new Date().toISOString(), studentIds: [], courseIds: [...new Set(courses.map((c) => c._id.toString()))] };
  const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  save();

  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const [firstName, lastName, ci, rating, title, comment, outcome] of REVIEWS) {
    const course = courseAt(ci);
    const user = await createUser({
      firstName,
      lastName,
      email: `demo.review.${firstName.toLowerCase()}.${stamp}@example.com`,
      password: `Demo#${randomBytes(6).toString('hex')}A1`,
      roleId: studentRole._id.toString(),
      status: 'active',
    });
    state.studentIds.push(user.id);
    save();
    await createManualEnrollment(adminReq, { studentId: user.id, courseId: course._id.toString(), enrollmentType: 'admin_granted', reason: 'Reviews demo data' });
    const doc = await User.findById(user.id);
    const review = await createStudentReview({ user: doc }, course._id.toString(), { rating, title, comment });
    if (outcome === 'approved') await moderateReview(adminReq, review.id, { status: 'approved' });
    if (outcome === 'rejected') await moderateReview(adminReq, review.id, { status: 'rejected', rejectionReason: 'Spam: asks learners to contact the author outside the platform.' });
    counts[outcome] += 1;
  }

  console.log(`\nDemo reviews created: ${counts.pending} pending, ${counts.approved} approved, ${counts.rejected} rejected`);
  console.log(`Courses: ${courses.map((c) => c.title).join(' · ')}`);
  console.log(`Learners: ${state.studentIds.length} (demo.review.*.${stamp}@example.com)`);
  console.log('Open Reviews & Ratings in the console. Remove with: node scripts/seed-reviews-demo.mjs --cleanup');
}

try {
  await connectDatabase();
  await (cleanup ? runCleanup() : runSeed());
  await finish(0);
} catch (err) {
  console.error(`\nStopped: ${err.message}${cleanup ? '' : '\nPartial data is recorded; run with --cleanup to remove it.'}`);
  await finish(1);
}
