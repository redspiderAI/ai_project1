# Examples: Pragmatic Coding

Real-world code examples demonstrating the four principles. Each shows what LLMs commonly do wrong and how to fix it.

---

## 1. Think Before Coding

### Example 1: Hidden Assumptions

**User Request:** "Add a feature to export user data"

**Wrong (hidden assumptions)**

```python
def export_users(format='json'):
    """Export all users to a file."""
    users = User.query.all()

    if format == 'json':
        with open('users.json', 'w') as f:
            json.dump([u.to_dict() for u in users], f)
    elif format == 'csv':
        with open('users.csv', 'w') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'email', 'name'])
            writer.writeheader()
            writer.writerows([u.to_dict() for u in users])

    return f"Exported {len(users)} users"
```

**Problems:**

- Assumed export of ALL users (pagination? privacy?)
- Assumed file location without asking
- Assumed which fields to include
- Assumed CSV fieldnames without checking actual data structure

**Better (surface assumptions)**

Before implementing, clarify:

1. **Scope:** All users or filtered subset? (privacy implications)
2. **Format:** Download in browser? Background job with email? API returning data?
3. **Fields:** Which user fields? (some may be sensitive)
4. **Volume:** Typical size? (affects approach)

Simplest approach might be a paginated JSON API; file-based export needs more detail. Ask preference.

### Example 2: Multiple Interpretations

**User Request:** "Make the search faster"

**Wrong:** Add caching, indexes, and async without asking which “faster” matters.

**Better:** Spell out interpretations:

1. **Faster response time** — indexes, cache (~effort estimate).
2. **Higher throughput** — async, pooling (~effort estimate).
3. **Faster perceived speed** — partial results, progressive loading (~effort estimate).

State current baseline (e.g. ~500ms) and ask which dimension matters most.

---

## 2. Simplicity First

### Example 1: Over-abstraction

**User Request:** "Add a function to calculate discount"

**Wrong:** Full strategy hierarchy, enums, protocols, and a calculator class for one percentage discount.

**Right:** Start minimal:

```python
def calculate_discount(amount: float, percent: float) -> float:
    """Calculate discount amount. percent should be 0-100."""
    return amount * (percent / 100)
```

Add patterns only when multiple discount types actually exist.

### Example 2: Speculative Features

**User Request:** "Save user preferences to database"

**Wrong:** Cache, merge flags, validation, notifications in one class without being asked.

**Right:**

```python
def save_preferences(db, user_id: int, preferences: dict):
    """Save user preferences to database."""
    db.execute(
        "UPDATE users SET preferences = ? WHERE id = ?",
        (json.dumps(preferences), user_id)
    )
```

Add caching, validation, merging when requirements or pain appear.

---

## 3. Surgical Changes

### Example 1: Drive-by Refactoring

**User Request:** "Fix the bug where empty emails crash the validator"

**Wrong:** Tighten email rules, add username length/alphanumeric checks, rewrite comments—beyond the bug.

**Right:** Only handle empty/whitespace email safely; leave other validation unchanged unless requested.

### Example 2: Style Drift

**User Request:** "Add logging to the upload function"

**Wrong:** Add types, docstring, reformat quotes, refactor boolean logic—while “adding logging.”

**Right:** Add `logger` and log lines; keep existing quote style, structure, and control flow.

---

## 4. Goal-Driven Execution

### Example 1: Vague vs. Verifiable

**User Request:** "Fix the authentication system"

**Wrong:** Generic steps (review → improve → test) with no success criterion.

**Right:** Ask for the specific failure. Example: “sessions stay valid after password change” → test that reproduces → invalidate sessions on password change → regression tests.

### Example 2: Multi-Step with Verification

**User Request:** "Add rate limiting to the API"

**Wrong:** One large commit: Redis, strategies, config, monitoring, no checkpoints.

**Right:** Incremental plan—e.g. in-memory for one endpoint → middleware → Redis → per-endpoint config—with a verification step after each.

### Example 3: Test-First Verification

**User Request:** "The sorting breaks when there are duplicate scores"

**Wrong:** Change sort immediately without reproducing instability.

**Right:** Write a test that exposes non-deterministic ordering for ties; then fix with a stable key (e.g. secondary sort on name).

---

## Anti-Patterns Summary (duplicate for quick scan)

| Principle | Anti-pattern | Fix |
|-----------|--------------|-----|
| Think Before Coding | Silent assumptions about format, fields, scope | List assumptions; ask |
| Simplicity First | Strategy pattern for a single calculation | One function until complexity is needed |
| Surgical Changes | Reformat and add extras while fixing a bug | Only lines that fix the issue |
| Goal-Driven | “Review and improve” | Test/repro → fix → verify no regressions |

---

## Key Insight

The overcomplicated examples often follow familiar patterns. The problem is **timing**: complexity before need makes code harder to understand, buggier, slower to ship, and harder to test. Simple versions are easier to change later when real requirements appear.

**Good code solves today’s problem simply, not tomorrow’s prematurely.**
