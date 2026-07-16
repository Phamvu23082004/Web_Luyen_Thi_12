# OnThi12

Exam-prep web platform for grade-12 students and teachers — teachers create exams by uploading a PDF that Gemini parses; students take timed, auto-graded multiple-choice exams.

Read @project-context.md for AI implementation rules.
Read @docs/PROJECT-STANDARDS.md for project context and decisions.
Read @SRS.md for the full software requirements (v1.1) and @TechStack.md for the technology choices.

---

## Behavioral Guidelines

Reduce common LLM coding mistakes. Bias toward caution over speed; use judgment for trivial tasks.

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it. Ask: "Would a senior engineer say this is overcomplicated?"

### 3. Surgical Changes
- Touch only what you must. Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken. Match existing style.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused; don't remove pre-existing dead code unless asked.
- Test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with verification per step. Strong success criteria let you loop independently.
