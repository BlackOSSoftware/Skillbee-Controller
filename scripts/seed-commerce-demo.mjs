#!/usr/bin/env node
/**
 * Demo data for Orders & Payments and Coupons on the development backend, so every state can be
 * seen in the admin console: paid, pending, cancelled, free (100% coupon), partly and fully refunded
 * orders, plus coupons that are used, held, unused, scheduled, expired and paused.
 *
 * It runs the backend's own services (checkout, order completion, refund settlement, coupon
 * reservation) against the database in backend/.env. Payment gateways are never called: the seed
 * records demo payments (ids start with `demo_`, signature and webhook flags stay false) and settles
 * demo refunds, so no money moves and no gateway credentials are needed.
 *
 *   node scripts/seed-commerce-demo.mjs            create demo data
 *   node scripts/seed-commerce-demo.mjs --cleanup  remove exactly what this script created
 *
 * Never run against production: the script refuses when NODE_ENV=production.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(HERE, '..', '..', 'backend');
const STATE_FILE = join(HERE, '.commerce-demo-state.json');
const cleanup = process.argv.includes('--cleanup');

process.chdir(BACKEND); // backend/.env and ./uploads resolve from here
const load = (p) => import(pathToFileURL(join(BACKEND, 'src', p)).href);

const { env } = await load('config/env.js');
if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo commerce data with NODE_ENV=production.');
  process.exit(1);
}
const { connectDatabase, disconnectDatabase } = await load('config/database.js');
const { disconnectRedis } = await load('config/redis.js');
const { ROLE_SLUGS } = await load('config/security.js');
const { User } = await load('models/User.js');
const { Role } = await load('models/Role.js');
const { Course } = await load('models/Course.js');
const { Order } = await load('models/Order.js');
const { Payment } = await load('models/Payment.js');
const { Refund } = await load('models/Refund.js');
const { Coupon } = await load('models/Coupon.js');
const { CouponUsage } = await load('models/CouponUsage.js');
const { CourseEnrollment } = await load('models/CourseEnrollment.js');
const { AppNotification } = await load('models/AppNotification.js');
const { EmailLog } = await load('models/EmailLog.js');
const { createUser } = await load('services/users.service.js');
const { createCoupon } = await load('modules/commerce/services/coupon.service.js');
const { checkout } = await load('modules/commerce/services/checkout.service.js');
const { completePaidOrder } = await load('modules/commerce/services/fulfillment.service.js');
const { updateOrderStatus } = await load('modules/commerce/services/order.service.js');
const { applyRefundProcessed } = await load('services/payments/refund.service.js');
const { buildOrderItemSnapshot } = await load('modules/commerce/services/pricing.service.js');
const { invalidateCommerceCaches } = await load('services/cache/invalidation.service.js');
const { getUploadRoot, resolveInsideRoot } = await load('modules/media/utils/storagePath.js');

const day = 24 * 60 * 60 * 1000;
const now = Date.now();

async function finish(code = 0) {
  await new Promise((r) => setTimeout(r, 1500)); // let post-payment events settle
  await disconnectRedis().catch(() => {});
  await disconnectDatabase().catch(() => {});
  process.exit(code);
}

async function runCleanup() {
  if (!existsSync(STATE_FILE)) {
    console.log('Nothing to clean up (no state file found).');
    return;
  }
  const s = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const orders = await Order.find({ _id: { $in: s.orderIds } }).select('invoiceStorageKey studentId');
  for (const o of orders) {
    if (!o.invoiceStorageKey) continue;
    try {
      rmSync(resolveInsideRoot(getUploadRoot(), o.invoiceStorageKey), { force: true });
    } catch {
      /* invoice file already gone */
    }
  }
  const results = {
    refunds: (await Refund.deleteMany({ orderId: { $in: s.orderIds } })).deletedCount,
    payments: (await Payment.deleteMany({ orderId: { $in: s.orderIds } })).deletedCount,
    couponUsages: (await CouponUsage.deleteMany({ orderId: { $in: s.orderIds } })).deletedCount,
    orders: (await Order.deleteMany({ _id: { $in: s.orderIds } })).deletedCount,
    enrollments: (await CourseEnrollment.deleteMany({ studentId: { $in: s.studentIds } })).deletedCount,
    coupons: (await Coupon.deleteMany({ _id: { $in: s.couponIds } })).deletedCount,
    notifications: (await AppNotification.deleteMany({ recipientId: { $in: s.studentIds } })).deletedCount,
    emailLogs: (await EmailLog.deleteMany({ recipient: { $in: s.emails ?? [] } })).deletedCount,
    learners: (await User.deleteMany({ _id: { $in: s.studentIds } })).deletedCount,
  };
  for (const id of s.studentIds) await invalidateCommerceCaches({ studentId: id });
  unlinkSync(STATE_FILE);
  console.log('Removed demo data:', JSON.stringify(results));
  console.log('Coupons or orders you created yourself in the console are left untouched.');
}

async function runSeed() {
  if (existsSync(STATE_FILE)) {
    console.log('Demo data already exists. Run with --cleanup first to recreate it.');
    return;
  }
  const state = { createdAt: new Date().toISOString(), studentIds: [], emails: [], couponIds: [], orderIds: [] };
  const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  const superRole = await Role.findOne({ slug: ROLE_SLUGS.SUPER_ADMIN });
  const studentRole = await Role.findOne({ slug: ROLE_SLUGS.STUDENT });
  const admin = superRole && (await User.findOne({ roleId: superRole._id, deletedAt: null }));
  if (!admin || !studentRole) throw new Error('A super admin account and the student role are required.');
  const adminReq = { user: admin };

  const candidates = await Course.find({ status: 'published', deletedAt: null, 'pricing.type': { $ne: 'free' } }).sort({ createdAt: 1 }).limit(20);
  const courses = candidates.filter((c) => {
    try {
      return buildOrderItemSnapshot(c).finalPricePaise >= 100000; // at least ₹1,000 so coupons have room
    } catch {
      return false;
    }
  });
  if (!courses.length) throw new Error('Need at least one published, purchasable paid course priced ₹1,000 or more.');
  const [courseA, courseB = courses[0]] = courses;

  const stamp = now.toString(36).slice(-5);
  const coupon = async (input) => {
    const c = await createCoupon(adminReq, input);
    state.couponIds.push(c.id);
    save();
    return c;
  };
  const welcome = await coupon({ code: `DEMO-WELCOME20-${stamp}`, description: '[Demo] 20% welcome offer, capped at ₹1,000', discountType: 'percentage', discountValue: 20, maximumDiscountAmount: 1000, usageLimit: 50, perUserLimit: 1 });
  await coupon({ code: `DEMO-FLAT300-${stamp}`, description: '[Demo] ₹300 off orders of ₹999 or more (never used, fully editable)', discountType: 'fixed', discountValue: 300, minimumOrderAmount: 999, usageLimit: 100 });
  const full = await coupon({ code: `DEMO-FULL100-${stamp}`, description: `[Demo] Free access to ${courseA.title}`, discountType: 'percentage', discountValue: 100, applicability: 'selected_courses', applicableCourses: [courseA._id.toString()], usageLimit: 5 });
  await coupon({ code: `DEMO-LAUNCH15-${stamp}`, description: '[Demo] Launch offer that starts next week', discountType: 'percentage', discountValue: 15, startDate: new Date(now + 7 * day), expiryDate: new Date(now + 37 * day) });
  await coupon({ code: `DEMO-SPRING10-${stamp}`, description: '[Demo] Spring sale that has ended', discountType: 'percentage', discountValue: 10, startDate: new Date(now - 60 * day), expiryDate: new Date(now - 30 * day) });
  await coupon({ code: `DEMO-PAUSED5-${stamp}`, description: '[Demo] Paused by an admin', discountType: 'fixed', discountValue: 5, isActive: false });

  const learner = async (firstName, lastName, city, stateName) => {
    const u = await createUser({
      firstName,
      lastName,
      email: `demo.shop.${firstName.toLowerCase()}.${stamp}@example.com`,
      password: `Demo#${randomBytes(6).toString('hex')}A1`,
      roleId: studentRole._id.toString(),
      status: 'active',
    });
    state.studentIds.push(u.id);
    state.emails.push(u.email);
    save();
    const doc = await User.findById(u.id);
    return { doc, billing: { fullName: `${firstName} ${lastName}`, email: doc.email, city, state: stateName, country: 'IN' } };
  };

  const buy = async (who, course, couponCode) => {
    const { order } = await checkout({ user: who.doc }, { courseIds: [course._id.toString()], ...(couponCode ? { couponCode } : {}), billing: who.billing });
    state.orderIds.push(order.id);
    save();
    return order;
  };

  const pay = async (order) => {
    const doc = await Order.findById(order.id);
    const ref = doc.orderNumber.replace(/[^A-Z0-9]/gi, '');
    doc.paymentGateway = 'razorpay';
    doc.gatewayOrderId = `demo_order_${ref}`;
    doc.orderStatus = 'processing';
    doc.pushHistory({ action: 'razorpay_order_created', fromStatus: 'pending', toStatus: 'processing', actorId: doc.studentId, source: 'student', reason: 'Demo data: no gateway was called' });
    await doc.save();
    await Payment.create({
      orderId: doc._id,
      studentId: doc.studentId,
      provider: 'razorpay',
      providerOrderId: doc.gatewayOrderId,
      providerPaymentId: `demo_pay_${ref}`,
      amountPaise: doc.totalPaise,
      currency: doc.currency,
      paymentStatus: 'captured',
      paymentMethod: 'card',
      idempotencyKey: `demo:${doc._id}`,
      capturedAt: new Date(),
    });
    await completePaidOrder(doc._id, { paymentId: `demo_pay_${ref}` });
    return Order.findById(doc._id);
  };

  const refund = async (order, amountPaise, reason) => {
    const payment = await Payment.findOne({ orderId: order._id });
    const providerRefundId = `demo_rfnd_${randomBytes(5).toString('hex')}`;
    await Refund.create({
      orderId: order._id,
      paymentId: payment._id,
      studentId: order.studentId,
      amountPaise,
      currency: payment.currency,
      providerRefundId,
      reason,
      initiatedBy: admin._id,
      idempotencyKey: `demo-refund:${providerRefundId}`,
    });
    await applyRefundProcessed({ id: providerRefundId }, 'refund.processed');
  };

  const aanya = await learner('Aanya', 'Sharma', 'Pune', 'Maharashtra');
  const kabir = await learner('Kabir', 'Mehta', 'Bengaluru', 'Karnataka');
  const meera = await learner('Meera', 'Iyer', 'Chennai', 'Tamil Nadu');
  const rohan = await learner('Rohan', 'Gupta', 'Delhi', 'Delhi');
  const isha = await learner('Isha', 'Verma', 'Jaipur', 'Rajasthan');
  const dev = await learner('Dev', 'Malhotra', 'Mumbai', 'Maharashtra');

  const summary = [];
  const o1 = await pay(await buy(aanya, courseA, welcome.code));
  summary.push([o1.orderNumber, 'Aanya', `paid with ${welcome.code} (coupon now locked)`]);

  const o2 = await pay(await buy(kabir, courseB));
  await refund(o2, Math.round(o2.totalPaise * 0.3), 'Demo: partial goodwill refund');
  summary.push([o2.orderNumber, 'Kabir', 'paid, 30% refunded (partly refunded)']);

  const o3 = await buy(meera, courseA, welcome.code);
  summary.push([o3.orderNumber, 'Meera', `pending payment, holding ${welcome.code}`]);

  const o4 = await pay(await buy(rohan, courseB));
  await refund(o4, o4.totalPaise, 'Demo: full refund on request');
  summary.push([o4.orderNumber, 'Rohan', 'paid, fully refunded']);

  const o5 = await buy(isha, courseA, full.code);
  summary.push([o5.orderNumber, 'Isha', `free with ${full.code} (100% off)`]);

  const o6 = await buy(dev, courseB);
  await updateOrderStatus(adminReq, o6.id, 'cancelled', 'Demo: learner changed their mind before paying');
  summary.push([o6.orderNumber, 'Dev', 'cancelled before payment']);

  console.log(`\nDemo data created in database "${dbName}"`);
  console.log(`Courses: ${courseA.title}${courseB !== courseA ? ` · ${courseB.title}` : ''}`);
  for (const [n, who, what] of summary) console.log(`  ${n}  ${who.padEnd(6)} ${what}`);
  console.log(`Coupons: ${state.couponIds.length} (codes end with -${stamp.toUpperCase()}); learners: ${state.studentIds.length} (@example.com)`);
  console.log('\nOpen Orders & Payments and Coupons in the console. Remove with: node scripts/seed-commerce-demo.mjs --cleanup');
}

let dbName = '';
try {
  dbName = (await connectDatabase()).name;
  await (cleanup ? runCleanup() : runSeed());
  await finish(0);
} catch (err) {
  console.error(`\nStopped: ${err.message}${cleanup ? '' : '\nPartial data is recorded; run with --cleanup to remove it.'}`);
  await finish(1);
}
