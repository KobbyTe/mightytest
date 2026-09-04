---
name: coding-problem-authoring
description: Author real, auto-graded coding problems for the Mighty Test coding workspace — spec, starter code, stdin/stdout test cases, hidden cases, points and rubric. Use when creating, importing, or reviewing coding assignments (coding_assignments / coding_submissions), or when a coding task needs automated pass/fail grading instead of free-run sandbox output.
---

# Coding problem authoring

The coding workspace runs Python in-browser (Pyodide, Web Worker) and HTML/CSS/JS in a
sandboxed iframe. A **real problem** is not just starter code — it is a spec plus test
cases the program must satisfy. Test cases turn the sandbox into a graded judge.

## Where things live

| Concern | File |
| --- | --- |
| Test-case model, normalization, scoring | `src/lib/codingTests.ts` |
| Test execution loop (Pyodide) | `src/lib/codingTestRunner.ts` |
| Python runtime (stdin + stdout capture) | `src/lib/pyodideRunner.ts` |
| Student workspace (Run / Run tests / Submit) | `src/pages/CodingWorkspace.tsx` |
| Teacher authoring + grading | `src/components/admin/CodingAssignmentManagement.tsx` |

DB: `coding_assignments.test_cases` (jsonb array), `coding_submissions.test_results` (jsonb)
and `coding_submissions.auto_score` (numeric). Grading is finalized by the teacher UI setting
`status = 'graded'`, which fires `notify_on_coding_graded`.

## Test-case contract

```ts
{ id, name, stdin, expected_output, hidden, points }
```

- Automated tests are **Python-only**. HTML/CSS/JS assignments stay on rubric + AI/manual grading.
- Comparison is `normalizeOutput`: CRLF folded, trailing whitespace per line stripped,
  trailing newlines ignored. Never rely on exact trailing whitespace.
- `stdin` is fed line by line to `input()`. One line per `input()` call the program makes.
- `points` are relative weights; `autoScore = round(earned / total * max_score)`.

## Authoring checklist

1. **Spec in `instructions`** — state the exact input format, output format, and constraints.
   A student must be able to produce byte-correct output from the spec alone.
2. **Starter code** that reads the declared input (e.g. `n = int(input())`), so the first run
   never fails on an empty stdin.
3. **At least 4 cases**: one worked example (visible, mirrors the spec), one edge case
   (0/1/empty/negative), one larger case, and one or more **hidden** cases so the answer
   cannot be hardcoded.
4. **Prompt-free output.** Do NOT put `input("Enter n: ")` prompts in starter code — the prompt
   text lands in stdout and fails every case.
5. **Deterministic only.** No randomness, no clocks, no network. Pyodide has no network access.
6. **Fast.** Each case shares a 10s worker timeout; keep inputs small.
7. **No stdlib gaps.** Pyodide ships the CPython stdlib but no third-party packages unless
   loaded explicitly — stick to the stdlib.
8. **Rubric still matters** — it drives the AI grading suggestion for anything the tests can't
   see (readability, required approach).

## Worked example

Instructions:
> The first line contains an integer `n`. The next line contains `n` space-separated integers.
> Print the sum on one line.

Starter code:
```python
n = int(input())
values = [int(x) for x in input().split()]
# print the sum
```

Cases:
| name | stdin | expected_output | hidden | points |
| --- | --- | --- | --- | --- |
| Example | `3\n1 2 3` | `6` | no | 1 |
| Single value | `1\n42` | `42` | no | 1 |
| Negatives | `4\n-5 5 -2 2` | `0` | yes | 1 |
| Larger | `6\n10 20 30 40 50 60` | `210` | yes | 2 |

## Review rules

Reject a problem that has: no hidden case, a prompt string in starter code, ambiguous output
format, floating-point equality without a stated rounding rule, or a case whose expected output
was not verified by actually running a reference solution.
