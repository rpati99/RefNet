---
description: Verify a completed feature against its spec's acceptance criteria
argument-hint: @.claude/commands/create-spec.md
---

Read the spec: **$ARGUMENTS**.

Spawn a subagent with read-only access to the codebase. The subagent must:
- Check each acceptance criterion.
- Either mark it PASS (with evidence: file snippet, expected output, etc.) or FAIL (with reason).
- Return a concise verification report.

Do not modify any files. The subagent must use only read operations.