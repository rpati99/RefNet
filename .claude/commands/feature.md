---
description: Start a new feature branch and scaffold it from a spec
argument-hint: <feature-slug>
---

You are starting a new RefNet feature following the SDD flow.

Execute these steps in order:
1. Verify we are on main branch and it's up to date: `git checkout main && git pull origin main`
2. Create and switch to a new branch: `git checkout -b feature/$ARGUMENTS`
3. Create the spec directory if it doesn't exist: `mkdir -p specs`
4. Run `/spec $ARGUMENTS` to generate the spec document at `specs/XX-$ARGUMENTS.md`
5. Commit the spec: `git add specs/ && git commit -m "Spec: $ARGUMENTS"`

After this, the user will review the spec before proceeding to /plan.