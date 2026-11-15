import type { AssignmentListParams, SubmissionListParams } from '@/types/assignments';
import type { CertificateListParams, TemplateListParams } from '@/types/certificates';
import type { OrderListParams, RefundListParams } from '@/types/commerce';
import type { CouponListParams, CouponUsageParams } from '@/types/coupons';
import type { CourseListParams } from '@/types/courses';
import type { EnquiryListParams, TicketListParams } from '@/types/contact';
import type { EnrollmentListParams } from '@/types/enrollments';
import type { InstructorApplicationListParams } from '@/types/instructor-applications';
import type { LiveApplicationListParams } from '@/types/live-applications';
import type { BlogListParams } from '@/types/blogs';
import type { FaqListParams } from '@/types/faqs';
import type { CourseVideoListParams, MediaImageListParams, MediaListParams } from '@/types/media';
import type { SubscriberListParams, CampaignListParams } from '@/types/newsletter';
import type { AttemptListParams, BankListParams, QuizListParams } from '@/types/quizzes';
import type { QuestionListParams } from '@/types/qa';
import type { ReferralListParams } from '@/types/referrals';
import type { ReviewListParams } from '@/types/reviews';
import type { RedirectListParams } from '@/types/seo';
import type { AdminNotificationListParams } from '@/types/notifications';
import type { EmailLogListParams } from '@/types/email';
import type { UsersListParams } from '@/types/users';

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    stat: (statId: string) => [...queryKeys.dashboard.all, 'stat', statId] as const,
  },
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (params: UsersListParams) => [...queryKeys.users.lists(), params] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    stat: (status: string) => [...queryKeys.users.all, 'stat', status] as const,
  },
  roles: {
    all: ['roles'] as const,
    list: () => [...queryKeys.roles.all, 'list'] as const,
    permissions: () => [...queryKeys.roles.all, 'permissions'] as const,
    userCount: (roleId: string) => [...queryKeys.roles.all, 'user-count', roleId] as const,
  },
  instructors: {
    all: ['instructors'] as const,
    roster: () => [...queryKeys.instructors.all, 'roster'] as const,
    detail: (id: string) => [...queryKeys.instructors.all, 'detail', id] as const,
    courses: (id: string, page: number) => [...queryKeys.instructors.all, 'courses', id, page] as const,
  },
  referrals: {
    all: ['referrals'] as const,
    stat: (key: string) => [...queryKeys.referrals.all, 'stat', key] as const,
    lists: () => [...queryKeys.referrals.all, 'list'] as const,
    list: (params: ReferralListParams) => [...queryKeys.referrals.lists(), params] as const,
    detail: (id: string) => [...queryKeys.referrals.all, 'detail', id] as const,
  },
  instructorApplications: {
    all: ['instructor-applications'] as const,
    stat: (key: string) => [...queryKeys.instructorApplications.all, 'stat', key] as const,
    lists: () => [...queryKeys.instructorApplications.all, 'list'] as const,
    list: (params: InstructorApplicationListParams) => [...queryKeys.instructorApplications.lists(), params] as const,
    detail: (id: string) => [...queryKeys.instructorApplications.all, 'detail', id] as const,
  },
  liveApplications: {
    all: ['live-applications'] as const,
    lists: () => [...queryKeys.liveApplications.all, 'list'] as const,
    list: (params: LiveApplicationListParams) => [...queryKeys.liveApplications.lists(), params] as const,
    detail: (id: string) => [...queryKeys.liveApplications.all, 'detail', id] as const,
  },
  newsletter: {
    all: ['newsletter'] as const,
    subscribers: {
      lists: () => [...queryKeys.newsletter.all, 'subscribers', 'list'] as const,
      list: (params: SubscriberListParams) => [...queryKeys.newsletter.subscribers.lists(), params] as const,
      detail: (id: string) => [...queryKeys.newsletter.all, 'subscribers', 'detail', id] as const,
    },
    campaigns: {
      lists: () => [...queryKeys.newsletter.all, 'campaigns', 'list'] as const,
      list: (params: CampaignListParams) => [...queryKeys.newsletter.campaigns.lists(), params] as const,
      detail: (id: string) => [...queryKeys.newsletter.all, 'campaigns', 'detail', id] as const,
    },
  },
  faqs: {
    all: ['faqs'] as const,
    lists: () => [...queryKeys.faqs.all, 'list'] as const,
    list: (params: FaqListParams) => [...queryKeys.faqs.lists(), params] as const,
    detail: (id: string) => [...queryKeys.faqs.all, 'detail', id] as const,
    categories: () => [...queryKeys.faqs.all, 'categories'] as const,
  },
  blogs: {
    all: ['blogs'] as const,
    lists: () => [...queryKeys.blogs.all, 'list'] as const,
    list: (params: BlogListParams) => [...queryKeys.blogs.lists(), params] as const,
    detail: (id: string) => [...queryKeys.blogs.all, 'detail', id] as const,
    seo: (id: string) => [...queryKeys.blogs.all, 'seo', id] as const,
    categories: () => [...queryKeys.blogs.all, 'categories'] as const,
  },
  seo: {
    all: ['seo'] as const,
    settings: () => [...queryKeys.seo.all, 'settings'] as const,
    pages: {
      detail: (id: string) => [...queryKeys.seo.all, 'pages', 'detail', id] as const,
    },
    courses: {
      detail: (id: string) => [...queryKeys.seo.all, 'courses', 'detail', id] as const,
    },
    redirects: {
      lists: () => [...queryKeys.seo.all, 'redirects', 'list'] as const,
      list: (params: RedirectListParams) => [...queryKeys.seo.redirects.lists(), params] as const,
    },
  },
  emailTemplates: {
    all: ['email-templates'] as const,
    lists: () => [...queryKeys.emailTemplates.all, 'list'] as const,
    list: () => [...queryKeys.emailTemplates.lists()] as const,
    detail: (id: string) => [...queryKeys.emailTemplates.all, 'detail', id] as const,
  },
  emailLogs: {
    all: ['email-logs'] as const,
    lists: () => [...queryKeys.emailLogs.all, 'list'] as const,
    list: (params: EmailLogListParams) => [...queryKeys.emailLogs.lists(), params] as const,
    detail: (id: string) => [...queryKeys.emailLogs.all, 'detail', id] as const,
  },
  siteSettings: {
    all: ['site-settings'] as const,
    admin: () => [...queryKeys.siteSettings.all, 'admin'] as const,
    public: () => [...queryKeys.siteSettings.all, 'public'] as const,
  },
  courses: {
    all: ['courses'] as const,
    lists: () => [...queryKeys.courses.all, 'list'] as const,
    list: (params: CourseListParams) => [...queryKeys.courses.lists(), params] as const,
    detail: (id: string) => [...queryKeys.courses.all, 'detail', id] as const,
    stats: () => [...queryKeys.courses.all, 'stat'] as const,
    stat: (status: string) => [...queryKeys.courses.stats(), status] as const,
    analytics: (id: string) => [...queryKeys.courses.all, 'analytics', id] as const,
    topics: (id: string) => [...queryKeys.courses.all, 'topics', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    courseList: () => [...queryKeys.categories.all, 'course', 'list'] as const,
    blogList: () => [...queryKeys.categories.all, 'blog', 'list'] as const,
  },
  enrollments: {
    all: ['enrollments'] as const,
    lists: () => [...queryKeys.enrollments.all, 'list'] as const,
    list: (params: EnrollmentListParams) => [...queryKeys.enrollments.lists(), params] as const,
    stats: () => [...queryKeys.enrollments.all, 'stat'] as const,
    stat: (status: string) => [...queryKeys.enrollments.stats(), status] as const,
    progress: (id: string) => [...queryKeys.enrollments.all, 'progress', id] as const,
    history: (id: string) => [...queryKeys.enrollments.all, 'history', id] as const,
  },
  assignments: {
    all: ['assignments'] as const,
    lists: () => [...queryKeys.assignments.all, 'list'] as const,
    list: (params: AssignmentListParams) => [...queryKeys.assignments.lists(), params] as const,
    detail: (id: string) => [...queryKeys.assignments.all, 'detail', id] as const,
    submission: (id: string) => [...queryKeys.assignments.all, 'submission', id] as const,
    submissionHistory: (id: string) => [...queryKeys.assignments.all, 'submission', id, 'history'] as const,
    stats: () => [...queryKeys.assignments.all, 'stat'] as const,
    stat: (status: string) => [...queryKeys.assignments.stats(), status] as const,
    submissionsOf: (assignmentId: string) => [...queryKeys.assignments.all, 'submissions', assignmentId] as const,
    submissions: (assignmentId: string, params: SubmissionListParams) => [...queryKeys.assignments.submissionsOf(assignmentId), params] as const,
  },
  quizzes: {
    all: ['quizzes'] as const,
    lists: () => [...queryKeys.quizzes.all, 'list'] as const,
    list: (params: QuizListParams) => [...queryKeys.quizzes.lists(), params] as const,
    detail: (id: string) => [...queryKeys.quizzes.all, 'detail', id] as const,
    stats: () => [...queryKeys.quizzes.all, 'stat'] as const,
    stat: (key: string) => [...queryKeys.quizzes.stats(), key] as const,
    questions: (id: string) => [...queryKeys.quizzes.all, 'questions', id] as const,
    analytics: (id: string) => [...queryKeys.quizzes.all, 'analytics', id] as const,
    attempts: () => [...queryKeys.quizzes.all, 'attempts'] as const,
    attemptLists: () => [...queryKeys.quizzes.attempts(), 'list'] as const,
    attemptList: (params: AttemptListParams) => [...queryKeys.quizzes.attemptLists(), params] as const,
    quizAttempts: (quizId: string, params: Omit<AttemptListParams, 'quizId'>) => [...queryKeys.quizzes.attemptLists(), 'quiz', quizId, params] as const,
    attempt: (id: string) => [...queryKeys.quizzes.attempts(), 'detail', id] as const,
    bank: () => [...queryKeys.quizzes.all, 'bank'] as const,
    bankLists: () => [...queryKeys.quizzes.bank(), 'list'] as const,
    bankList: (params: BankListParams) => [...queryKeys.quizzes.bankLists(), params] as const,
    bankDetail: (id: string) => [...queryKeys.quizzes.bank(), 'detail', id] as const,
    bankCategories: () => [...queryKeys.quizzes.bank(), 'categories'] as const,
  },
  commerce: {
    all: ['commerce'] as const,
    stat: (key: string) => [...queryKeys.commerce.all, 'stat', key] as const,
    orders: () => [...queryKeys.commerce.all, 'orders'] as const,
    orderLists: () => [...queryKeys.commerce.orders(), 'list'] as const,
    orderList: (scope: string, params: OrderListParams) => [...queryKeys.commerce.orderLists(), scope, params] as const,
    order: (id: string) => [...queryKeys.commerce.orders(), 'detail', id] as const,
    orderHistory: (id: string) => [...queryKeys.commerce.orders(), 'history', id] as const,
    orderPayments: (id: string) => [...queryKeys.commerce.orders(), 'payments', id] as const,
    refunds: () => [...queryKeys.commerce.all, 'refunds'] as const,
    refundLists: () => [...queryKeys.commerce.refunds(), 'list'] as const,
    refundList: (params: RefundListParams) => [...queryKeys.commerce.refundLists(), params] as const,
    refund: (id: string) => [...queryKeys.commerce.refunds(), 'detail', id] as const,
    gateways: () => [...queryKeys.commerce.all, 'gateways'] as const,
    gatewayStatus: (provider: string) => [...queryKeys.commerce.gateways(), 'status', provider] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    stat: (key: string) => [...queryKeys.reviews.all, 'stat', key] as const,
    lists: () => [...queryKeys.reviews.all, 'list'] as const,
    list: (params: ReviewListParams) => [...queryKeys.reviews.lists(), params] as const,
    detail: (id: string) => [...queryKeys.reviews.all, 'detail', id] as const,
  },
  qa: {
    all: ['qa'] as const,
    stat: (key: string) => [...queryKeys.qa.all, 'stat', key] as const,
    lists: () => [...queryKeys.qa.all, 'list'] as const,
    list: (params: QuestionListParams) => [...queryKeys.qa.lists(), params] as const,
    detail: (id: string) => [...queryKeys.qa.all, 'detail', id] as const,
  },
  contact: {
    all: ['contact-enquiries'] as const,
    stat: (key: string) => [...queryKeys.contact.all, 'stat', key] as const,
    lists: () => [...queryKeys.contact.all, 'list'] as const,
    list: (params: EnquiryListParams) => [...queryKeys.contact.lists(), params] as const,
    detail: (id: string) => [...queryKeys.contact.all, 'detail', id] as const,
    history: (id: string) => [...queryKeys.contact.all, 'history', id] as const,
  },
  support: {
    all: ['support-tickets'] as const,
    stat: (key: string) => [...queryKeys.support.all, 'stat', key] as const,
    adminLists: () => [...queryKeys.support.all, 'admin', 'list'] as const,
    adminList: (params: TicketListParams) => [...queryKeys.support.adminLists(), params] as const,
    adminDetail: (id: string) => [...queryKeys.support.all, 'admin', 'detail', id] as const,
    adminHistory: (id: string) => [...queryKeys.support.all, 'admin', 'history', id] as const,
  },
  coupons: {
    all: ['coupons'] as const,
    stat: (key: string) => [...queryKeys.coupons.all, 'stat', key] as const,
    lists: () => [...queryKeys.coupons.all, 'list'] as const,
    list: (params: CouponListParams) => [...queryKeys.coupons.lists(), params] as const,
    detail: (id: string) => [...queryKeys.coupons.all, 'detail', id] as const,
    usages: (id: string) => [...queryKeys.coupons.all, 'usage', id] as const,
    usage: (id: string, params: CouponUsageParams) => [...queryKeys.coupons.usages(id), params] as const,
  },
  certificates: {
    all: ['certificates'] as const,
    stat: (key: string) => [...queryKeys.certificates.all, 'stat', key] as const,
    templates: () => [...queryKeys.certificates.all, 'templates'] as const,
    templateLists: () => [...queryKeys.certificates.templates(), 'list'] as const,
    templateList: (params: TemplateListParams) => [...queryKeys.certificates.templateLists(), params] as const,
    template: (id: string) => [...queryKeys.certificates.templates(), 'detail', id] as const,
    issued: () => [...queryKeys.certificates.all, 'issued'] as const,
    lists: () => [...queryKeys.certificates.issued(), 'list'] as const,
    list: (params: CertificateListParams) => [...queryKeys.certificates.lists(), params] as const,
    detail: (id: string) => [...queryKeys.certificates.issued(), 'detail', id] as const,
    history: (id: string) => [...queryKeys.certificates.issued(), 'history', id] as const,
    eligibility: (studentId: string, courseId: string) => [...queryKeys.certificates.all, 'eligibility', studentId, courseId] as const,
  },
  curriculum: {
    all: ['curriculum'] as const,
    lesson: (id: string) => [...queryKeys.curriculum.all, 'lesson', id] as const,
    preview: (id: string) => [...queryKeys.curriculum.lesson(id), 'preview'] as const,
    videoStatus: (id: string) => [...queryKeys.curriculum.lesson(id), 'video-status'] as const,
    attachments: (id: string) => [...queryKeys.curriculum.lesson(id), 'attachments'] as const,
    attachment: (id: string, fileId: string) => [...queryKeys.curriculum.attachments(id), fileId] as const,
  },
  learning: {
    all: ['learning'] as const,
    myCourses: () => [...queryKeys.learning.all, 'my-courses'] as const,
    curriculum: (courseId: string) => [...queryKeys.learning.all, 'curriculum', courseId] as const,
    lesson: (id: string) => [...queryKeys.learning.all, 'lesson', id] as const,
    attachments: (id: string) => [...queryKeys.learning.lesson(id), 'attachments'] as const,
  },
  media: {
    all: ['media'] as const,
    images: (params: MediaImageListParams) => [...queryKeys.media.all, 'images', params] as const,
    lists: () => [...queryKeys.media.all, 'list'] as const,
    list: (params: MediaListParams) => [...queryKeys.media.lists(), params] as const,
    courseVideoLists: () => [...queryKeys.media.all, 'course-videos'] as const,
    courseVideos: (params: CourseVideoListParams) => [...queryKeys.media.courseVideoLists(), params] as const,
    details: () => [...queryKeys.media.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.media.details(), id] as const,
    references: (id: string) => [...queryKeys.media.all, 'references', id] as const,
    storage: () => [...queryKeys.media.all, 'storage'] as const,
    categories: () => [...queryKeys.media.all, 'categories'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    mine: (limit: number) => [...queryKeys.notifications.all, 'mine', limit] as const,
    admin: {
      lists: () => [...queryKeys.notifications.all, 'admin', 'list'] as const,
      list: (params: AdminNotificationListParams) => [...queryKeys.notifications.admin.lists(), params] as const,
    },
  },
} as const;
