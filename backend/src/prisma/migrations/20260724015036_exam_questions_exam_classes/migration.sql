-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('draft', 'open', 'closed');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('pending', 'parsing', 'parsed', 'failed');

-- CreateEnum
CREATE TYPE "AnswerStatus" AS ENUM ('ai_extracted', 'needs_confirmation', 'manually_confirmed');

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'draft',
    "source_file_url" TEXT NOT NULL,
    "parse_status" "ParseStatus" NOT NULL DEFAULT 'pending',
    "parse_error" TEXT,
    "parse_generation" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_classes" (
    "exam_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "due_date" DATE NOT NULL,

    CONSTRAINT "exam_classes_pkey" PRIMARY KEY ("exam_id","class_id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_answer" TEXT,
    "answer_status" "AnswerStatus" NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "ai_confidence" DOUBLE PRECISION,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exams_teacher_id_idx" ON "exams"("teacher_id");

-- CreateIndex
CREATE INDEX "questions_exam_id_idx" ON "questions"("exam_id");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
