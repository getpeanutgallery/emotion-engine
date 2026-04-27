# COD test rerun QA note after anti-omission prompt revision

Date: 2026-04-27
Bead: ee-6yxq
Related plan: .plans/2026-04-27-audit-dialogue-prompt-for-missed-lines-and-rerun-cod-test.md

Commands run:
- node validate-configs.cjs
- node server/run-pipeline.cjs --config configs/cod-test.yaml --verbose

Key artifacts:
- .logs/cod-test-20260427-ee-6yxq-rerun.log
- output/cod-test/phase1-gather-context/dialogue-data.json
- output/cod-test/phase1-gather-context/dialogue-data.reconciled.json
- benchmarks/fixtures/cod-test/_reports/benchmark-summary.json
- benchmarks/fixtures/cod-test/_reports/artifact-results/dialogueData.json

Score movement:
- dialogue_text_full_transcript_pct: 90.7 -> 66.5
- dialogue_text_windowed_pct: 90.7 -> 67.2
- dialogue_boundary_pct: 0.0 -> 0.0

Outcome:
- The rerun did not recover 'You shall know fear.'
- The critical truth window remained a merge: truth indexes [8,9,10] still aligned to output index [8] with text similarity 56.3.
- The nearby weak-line window also remained merged: truth indexes [11,12] aligned to output index [9] with text similarity 57.1.
- The rerun introduced six extra output windows and several hallucinated lyric lines, including 'Come crawling faster, master.', 'Master of puppets, I'm pulling your strings.', 'Twisting your mind and smashing your dreams.', 'Blinded by me, you can't see a thing.', and repeated 'Just call my name, 'cause I'll hear you scream.' / 'Master, master.' lines.
- Overall verdict: this anti-omission prompt change regressed dialogue fidelity and increased hallucination noise in the canonical full cod-test lane.