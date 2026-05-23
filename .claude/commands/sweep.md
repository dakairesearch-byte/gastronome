# /sweep — eleven-agent cycle with budget circuit-breaker

**HARD BUDGET: 250K total tokens across all phases per cycle.**

- If Phase 1 exceeds 200K tokens, skip Phase 2 entirely and surface as a digest warning.
- If any single agent exceeds 50K tokens, terminate that task and log to OVERSEER_LOG.md.

---

## Phase 1 — parallel fan-out

Send ONE message with NINE concurrent `Task` tool calls (use `subagent_type` for each agent). Persistent worktrees stay around between cycles; "isolation: worktree" worktrees auto-clean if the agent makes no changes.

| Agent              | Model  | Worktree                                       |
|--------------------|--------|------------------------------------------------|
| data-steward       | sonnet | persistent: `../food-review-steward`           |
| schema-guardian    | haiku  | persistent: `../food-review-schema`            |
| api-builder        | sonnet | persistent: `../food-review-api`               |
| ranking-specialist | sonnet | persistent: `../food-review-ranking`           |
| performance        | haiku  | `isolation: "worktree"` (auto-cleanup)         |
| bug-hunter         | haiku  | `isolation: "worktree"` (auto-cleanup)         |
| code-reviewer      | haiku  | `isolation: "worktree"` (auto-cleanup)         |
| feature-builder    | sonnet | persistent: `../food-review-builder`           |
| design-ux          | sonnet | persistent: `../food-review-design`            |

**Prompt for every lane Task:**

> Run one cycle as the `<name>` agent. Read CLAUDE.md, STATE.md, BACKLOG.md, QUESTIONS.md, OVERSEER_LOG.md per your agent definition. Do the pre-flight no-op check first. Update STATE.md before exiting. Return ≤200 words: what you did, what you found, what's blocked, OR `no-op` if nothing to do.

---

## Phase 1.5 — overseer skip check

If ALL of:

- (a) every one of the nine agents returned `no-op`, **OR**
- (b) no new QUESTIONS.md entries, draft PRs, or Suggestions were filed this cycle

…then write `Cycle <timestamp>: skipped overseer phase (no new artifacts)` to OVERSEER_LOG.md, skip Phase 2 entirely, and jump to Phase 3 with an empty Overseer section.

---

## Phase 2 — sequential overseer pair (only if artifacts exist)

### 2a. overseer-a

`Task`, `isolation: "worktree"`, `model: haiku`.

Prompt:

> Run as Overseer-A. The nine lane agents have returned. Audit their outputs per your agent definition. Write the pre-challenge verdict to OVERSEER_LOG.md under "Auditor verdict (pre-challenge)". Return a ≤200 word summary.

### 2b. overseer-b

`Task`, `isolation: "worktree"`, `model: sonnet`. Runs after 2a completes.

Prompt:

> Run as Overseer-B. Overseer-A just wrote a pre-challenge verdict in OVERSEER_LOG.md. Challenge it per your agent definition. Counter at least 20% of A's verdicts (escalate `all-endorse cycle` if every verdict is obviously correct). Perform reconciliation. Write the FINAL reconciled verdict to OVERSEER_LOG.md under "Final reconciled verdict". Return a ≤200 word summary.

---

## Phase 3 — digest (chat output)

Synthesize from the **reconciled** verdict (never A's pre-challenge). Print to chat:

**Cycle stats**
- Lane agents that ran: N (of 9); no-op: M
- Phase 2 ran: yes/no
- Estimated total tokens: N
- Budget warnings: <list any>

**Overseer verdict (after challenge)**
- Endorsed without challenge: N
- Held after challenge: N (one line each)
- Revised after challenge: N (one line each, format: "A said X, revised to Y because <reason>")
- Split-verdicts needing D's tiebreak: N (one line each, both rationales)
- Pattern escalations: N

**Questions waiting on you** (exclude any that the reconciled verdict marked `NEEDS-REVISION` or `WRONG-GATE`)

**Draft PRs needing your call** (exclude any that the reconciled verdict marked `FLAGGED` or `LANE-VIOLATION`)

**New suggestions** (`KEEP` only, count by lane)

**What ran in DO mode** (one line per lane agent — skip no-ops)

**Blockers** (anything stuck >2 cycles per STATE.md)
