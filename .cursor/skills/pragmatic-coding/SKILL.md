---
name: pragmatic-coding
description: >-
  Guides implementation with four principles: clarify assumptions before coding,
  prefer the simplest solution, make surgical diffs that match local style, and
  define verifiable goals with incremental verification. Use when implementing
  features, fixing bugs, refactoring, optimizing, or when requests are vague;
  also when the user asks for pragmatic coding, YAGNI, minimal changes, or
  avoiding over-engineering.
---

# Pragmatic Coding

Apply these four principles before and while writing code. For full wrong-vs-right illustrations, see [examples.md](examples.md).

## 1. Think Before Coding

**Do not silently assume** scope, format, fields, storage, or delivery mechanism.

When the request leaves room for interpretation:

- List hidden assumptions (who sees data, pagination, privacy, volume).
- Offer 2–4 plausible interpretations with tradeoffs (latency vs throughput vs perceived speed).
- Ask a short, concrete question; propose the **smallest** viable default if the user wants to move fast.

**Anti-pattern:** Implementing one interpretation without stating it.

## 2. Simplicity First (YAGNI)

- Solve **today’s** requirement with the **least** structure: one function, one path, one data shape—until a second real case appears.
- **Do not** add strategy patterns, plugin systems, caching, validation layers, or notifications unless asked or clearly required by existing bugs/data.
- **When to complicate:** When a second requirement conflicts with the first, or when measured need (performance, multiple variants) appears.

**Anti-pattern:** Design patterns and “future-proof” abstractions for a single use case.

## 3. Surgical Changes

- Change **only** lines needed for the task. No drive-by refactors, renames, or “while we’re here” features.
- **Match** existing file style: quotes, types, formatting, patterns, logging style.
- Do not add docstrings, type hints, or stricter validation unless the task asks or the project already does so consistently.

**Anti-pattern:** Reformatting, broad validation, or extra behavior bundled with a one-line bug fix.

## 4. Goal-Driven Execution

Replace vague plans with **verifiable** outcomes:

1. **Name the success criterion** (e.g. “session invalidates after password change,” not “fix auth”).
2. **Reproduce first** when fixing bugs (failing test, minimal repro, or logged steps)—then fix.
3. **Work in increments:** each step shippable and checkable (tests, curl, manual checklist)—avoid 300-line single commits with no verification.

**Anti-pattern:** “Review, improve, test” without a specific failing case or measurable bar.

---

## Anti-Patterns Summary

| Principle | Anti-pattern | Fix |
|-----------|--------------|-----|
| Think Before Coding | Silent assumptions about format, fields, scope | State assumptions; ask or offer minimal default |
| Simplicity First | Heavy abstraction for one case | Smallest code that works; refactor when second case exists |
| Surgical Changes | Reformat + extras with the fix | Only lines that fix the issue; match local style |
| Goal-Driven | Vague “improve the system” | Explicit success criteria; reproduce → fix → regressions |

---

## Key Insight

“Best practices” and patterns are not wrong in isolation—the failure mode is **timing**: complexity before it is needed makes code harder to read, test, and change.

**Good code solves today’s problem simply.** Add structure when reality demands it, not in anticipation alone.

---

## Additional Resources

- [examples.md](examples.md) — full wrong-vs-right examples for each principle.
