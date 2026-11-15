import type { Pagination } from './api';

/** Backend `config/security.js` QUIZ_STATUS, QUIZ_SHOW_RESULTS, ATTEMPT_STATUS and QUESTION_TYPES. */
export const QUIZ_STATUSES = ['draft', 'published', 'archived'] as const;
export type QuizStatus = (typeof QUIZ_STATUSES)[number];

export type QuizShowResults = 'immediate' | 'after_submission' | 'after_manual_grading' | 'scheduled';

export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'evaluating', 'evaluated', 'expired', 'abandoned'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export type EvaluationStatus = 'pending' | 'partial' | 'completed';

export const QUESTION_TYPES = ['multiple_choice', 'multiple_select', 'true_false', 'short_answer', 'long_answer', 'fill_in_the_blanks'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type AnswerMatchingMode = 'exact' | 'case_insensitive' | 'normalized';

export interface QuestionOption {
  id: string;
  text: string;
  image?: string | null;
  sortOrder?: number;
}

export interface QuestionBlank {
  id: string;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  marks: number;
}

export interface RubricCriterion {
  criterion: string;
  maximumMarks: number;
  description?: string;
}

/** `Quiz.toSafeObject()`. */
export interface Quiz {
  id: string;
  title: string;
  slug: string;
  description: string;
  instructions: string;
  courseId: string;
  topicId: string | null;
  lessonId: string | null;
  timeLimitSeconds: number;
  totalMarks: number;
  passingPercentage: number;
  maximumAttempts: number | null;
  unlimitedAttempts: boolean;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  showResults: QuizShowResults;
  showCorrectAnswers: boolean;
  showExplanation: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarksPerWrongAnswer: number;
  allowResume: boolean;
  allowBackNavigation: boolean;
  requireAllQuestions: boolean;
  allowPartialCreditMultiSelect: boolean;
  questionSelectionMode: 'all' | 'random_count';
  questionsToSelect: number | null;
  tags: string[];
  availability: { enabled?: boolean; startsAt?: string | null; endsAt?: string | null; timezone?: string } | null;
  status: QuizStatus;
  publishedAt: string | null;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const QUIZ_SORT_FIELDS = ['createdAt', 'title', 'status', 'totalMarks'] as const;
export type QuizSortField = (typeof QUIZ_SORT_FIELDS)[number];

/** Query accepted by GET /admin/quizzes (`listQuizzesQuerySchema`, strict). */
export interface QuizListParams {
  page: number;
  limit: number;
  search?: string;
  courseId?: string;
  status?: QuizStatus;
  sortBy?: QuizSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface QuizListResponse {
  quizzes: Quiz[];
  pagination: Pagination;
}

/** GET /admin/quizzes/:id/questions rows (`serializeQuestionForAdmin`). */
export interface QuizQuestion {
  id: string;
  quizId: string;
  questionBankId: string | null;
  questionText: string;
  questionType: QuestionType;
  description: string;
  marks: number;
  negativeMarks: number;
  sortOrder: number;
  isRequired: boolean;
  explanation: string;
  difficulty: Difficulty;
  tags: string[];
  options: QuestionOption[];
  correctOptionIds: string[];
  correctAnswer: boolean | null;
  acceptedAnswers: string[];
  answerMatchingMode: AnswerMatchingMode;
  gradingMode: 'auto' | 'manual';
  gradingRubric: RubricCriterion[];
  blanks: QuestionBlank[];
}

/** GET /admin/quizzes/:id/analytics → data.analytics (`getQuizAnalytics`). */
export interface QuizAnalytics {
  quizId: string;
  title: string;
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  expiredAttempts: number;
  uniqueStudents: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  passCount: number;
  failCount: number;
  passPercentage: number | null;
  averageTimeTaken: number | null;
  pendingManualEvaluations: number;
}

/** GET /admin/quiz-attempts rows (`listAttemptsAdmin`). */
export interface QuizAttemptRow {
  id: string;
  quizId: string;
  courseId: string;
  studentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  evaluationStatus: EvaluationStatus;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  createdAt: string;
}

export const ATTEMPT_SORT_FIELDS = ['createdAt', 'submittedAt', 'percentage', 'attemptNumber'] as const;
export type AttemptSortField = (typeof ATTEMPT_SORT_FIELDS)[number];

/** Query accepted by GET /admin/quiz-attempts (`listAttemptsQuerySchema`, strict). */
export interface AttemptListParams {
  page: number;
  limit: number;
  quizId?: string;
  courseId?: string;
  studentId?: string;
  status?: AttemptStatus;
  passed?: boolean;
  startDate?: string;
  endDate?: string;
  sortBy?: AttemptSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface AttemptListResponse {
  attempts: QuizAttemptRow[];
  pagination: Pagination;
}

/** Question inside an admin attempt result (`serializeQuestionForResult` with keys shown). */
export interface AttemptQuestion {
  id: string;
  questionText: string;
  questionType: QuestionType;
  description: string;
  marks: number;
  isRequired: boolean;
  sortOrder?: number;
  options: QuestionOption[];
  blanks: QuestionBlank[];
  gradingMode: 'auto' | 'manual';
  studentAnswer: {
    selectedOptionIds?: string[];
    booleanAnswer?: boolean;
    text?: string;
    blankAnswers?: Array<{ blankId: string; value: string }>;
  };
  isCorrect: boolean | null | undefined;
  marksAwarded: number | null | undefined;
  negativeApplied: number;
  feedback: string;
  needsManualGrading: boolean;
  correctOptionIds?: string[];
  correctAnswer?: boolean | null;
  acceptedAnswers?: string[];
  explanation?: string;
}

/** `serializeAttemptResult(attempt, { isAdmin: true })`. */
export interface AttemptResult {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  attemptNumber: number;
  status: AttemptStatus;
  evaluationStatus: EvaluationStatus;
  submittedAt: string | null;
  startedAt: string;
  expiresAt: string | null;
  timeTakenSeconds: number | null;
  resultPublished: boolean;
  totalMarks?: number;
  obtainedMarks?: number;
  negativeMarks?: number;
  percentage?: number | null;
  passed?: boolean | null;
  correctCount?: number;
  incorrectCount?: number;
  message?: string;
  questions?: AttemptQuestion[];
}

/** GET /admin/quiz-attempts/:id/grading → data (`getGradingView`). */
export interface AttemptGradingView {
  attemptId: string;
  status: AttemptStatus;
  evaluationStatus: EvaluationStatus;
  pendingGrades: Array<{
    questionId: string;
    questionText: string;
    marks: number;
    gradingRubric: RubricCriterion[];
    studentAnswer: { text?: string };
    marksAwarded: number | null;
    feedback: string;
    needsManualGrading: boolean;
  }>;
  result: AttemptResult;
}

/** Body for PATCH /admin/quiz-attempts/:id/grade (`gradeAttemptSchema`, strict). */
export interface GradeAttemptInput {
  grades: Array<{ questionId: string; marksAwarded: number; feedback?: string }>;
}

export const SHOW_RESULTS_OPTIONS = ['immediate', 'after_submission', 'after_manual_grading', 'scheduled'] as const satisfies readonly QuizShowResults[];

/** Body for POST /admin/quizzes (`createQuizSchema`, strict). New quizzes start as draft. */
export interface CreateQuizInput {
  title: string;
  description?: string;
  instructions?: string;
  courseId: string;
  timeLimitSeconds?: number;
  passingPercentage?: number;
  /** `null` = unlimited attempts. */
  maximumAttempts?: number | null;
  randomizeQuestions?: boolean;
  randomizeAnswers?: boolean;
  showResults?: QuizShowResults;
  showCorrectAnswers?: boolean;
  showExplanation?: boolean;
  negativeMarkingEnabled?: boolean;
  negativeMarksPerWrongAnswer?: number;
  allowResume?: boolean;
  allowBackNavigation?: boolean;
  requireAllQuestions?: boolean;
  allowPartialCreditMultiSelect?: boolean;
  questionSelectionMode?: 'all' | 'random_count';
  questionsToSelect?: number | null;
  tags?: string[];
  availability?: { enabled?: boolean; startsAt?: string | null; endsAt?: string | null };
}

/** Body for PATCH /admin/quizzes/:id (`updateQuizSchema`: partial, course is fixed). */
export type UpdateQuizInput = Partial<Omit<CreateQuizInput, 'courseId'>>;

/** Body for POST /admin/quizzes/:id/questions and PATCH /admin/quizzes/questions/:id (`createQuestionSchema`). */
export interface QuestionInput {
  questionText: string;
  questionType: QuestionType;
  description?: string;
  marks: number;
  negativeMarks?: number;
  isRequired?: boolean;
  explanation?: string;
  difficulty?: Difficulty;
  tags?: string[];
  options?: Array<{ id: string; text: string; sortOrder: number }>;
  correctOptionIds?: string[];
  correctAnswer?: boolean;
  acceptedAnswers?: string[];
  answerMatchingMode?: AnswerMatchingMode;
  gradingRubric?: RubricCriterion[];
  blanks?: Array<{ id: string; acceptedAnswers: string[]; caseSensitive?: boolean; marks: number }>;
}

/** `QuestionBank.toSafeObject()`. */
export interface BankQuestion {
  id: string;
  questionText: string;
  questionType: QuestionType;
  description: string;
  options: QuestionOption[];
  correctOptionIds: string[];
  correctAnswer: boolean | null;
  acceptedAnswers: string[];
  answerMatchingMode: AnswerMatchingMode;
  gradingMode: 'auto' | 'manual';
  gradingRubric: RubricCriterion[];
  blanks: QuestionBlank[];
  explanation: string;
  defaultMarks: number;
  negativeMarks: number;
  difficulty: Difficulty;
  tags: string[];
  category: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/** Query accepted by GET /admin/question-bank (`listBankQuerySchema`, strict). */
export interface BankListParams {
  page: number;
  limit: number;
  search?: string;
  questionType?: QuestionType;
  difficulty?: Difficulty;
  category?: string;
  tag?: string;
  status?: 'active' | 'archived';
}

/**
 * Body for POST /admin/question-bank (`bankCreateSchema`, strict). The backend stores `defaultMarks`
 * (default 1), `category` (default "general") and `difficulty` (default "medium").
 */
export type BankQuestionInput = Omit<QuestionInput, 'isRequired' | 'marks'> & {
  defaultMarks: number;
  category?: string;
};

/** Body for PATCH /admin/question-bank/:id (`bankUpdateSchema`: partial; merged with the stored item). */
export type UpdateBankQuestionInput = Partial<BankQuestionInput>;

export interface BankListResponse {
  questions: BankQuestion[];
  pagination: Pagination;
}
