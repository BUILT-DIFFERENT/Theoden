# Automations

## Purpose

Automations are scheduled tasks that spawn threads automatically. They are the system for recurring code work, triage, and maintenance.

## UX requirements

- List of automations with enable and disable toggles.
- Schedule editor with daily, weekly, and cron options.
- Prompt template with variables like date ranges.

## Execution model

- Scheduler triggers a new run using the same provider pipeline.
- A run produces a normal thread with summary and diffs.
- Automations can request review and pause until approved.

## Built-in templates

- Scan recent commits for likely bugs.
- Draft changelog from merged PRs.
- Summarize CI failures and propose fixes.
