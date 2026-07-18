// Centralized business error codes (AD-16). Left empty deliberately — Epic 2
// (Story 2.8: EXAM_HAS_UNCONFIRMED_ANSWERS, EXAM_HAS_UNREVIEWED_FLAGS) and
// Epic 3 (Story 3.2: EXAM_NOT_OPEN, EXAM_PAST_DUE) add entries once those
// gates are actually implemented.
export const ErrorCodes = {} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
