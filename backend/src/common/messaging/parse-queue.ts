// Shared contract between the 2.1b publisher (exam module) and the Story 2.2
// worker consumer — one file so the two sides cannot disagree on the queue
// name or message shape.
export const AI_PARSE_QUEUE = 'ai.parse';

export interface ParseJobMessage {
  examId: string;
  sourceFileRef: string; // the storage key, e.g. exams/<id>/source.pdf
  parseGeneration: number; // AD-21 fencing token
}
