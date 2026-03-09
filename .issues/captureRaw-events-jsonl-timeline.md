# Optional: events.jsonl timeline for raw capture

## Problem
Reconstructing the chronology of attempts across chunks/phases is tedious.

## Goal
Optionally log every raw capture event (success + failure) to:
- `output/<run>/<phase>/raw/_meta/events.jsonl`

Each line includes timestamp, kind (ai|tool), chunk/split/attempt, status, and pointer to attempt folder.

## Acceptance criteria
- Timeline can be grepped to find the last event before failure.
