#!/usr/bin/env python3
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
TRUTH_PATH = ROOT / 'benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json'
RUNTIME_TIMESTAMP_PATH = ROOT / 'output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json'
RUNTIME_TEXT_PATH = ROOT / 'output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json'
COMPARISON_PATH = ROOT / 'output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json'
QA_SUMMARY_PATH = ROOT / '.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/summary.md'
PLAN_PATH = ROOT / '.plans/2026-05-04-dialogue-timestamp-human-review-against-benchmark.md'
OUT_DIR = ROOT / '.plans/artifacts/2026-05-04-dialogue-timestamp-human-review'
PACKET_JSON_PATH = OUT_DIR / 'packet.json'
PACKET_MD_PATH = OUT_DIR / 'packet.md'
REVIEW_DECISIONS_PATH = OUT_DIR / 'review-decisions.json'

WINDOW_UNITS = {'dlg-0001', 'dlg-0005'}
BLOCKED_UNITS = {'dlg-0007', 'dlg-0009', 'dlg-0010', 'dlg-0015', 'dlg-0016'}
VERDICT_ENUM = [
    'timing_pass_row',
    'timing_pass_window',
    'timing_fail_clipped_start',
    'timing_fail_clipped_end',
    'timing_fail_overspan',
    'timing_fail_misplaced',
    'timing_fail_order_defect',
    'blocked_text_drift',
    'blocked_missing_runtime',
    'blocked_unresolved_runtime',
    'needs_normalization_policy',
]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def row_duration(start: Any, end: Any) -> Any:
    if start is None or end is None:
        return None
    return round(float(end) - float(start), 3)


def fmt_time(value: Any) -> str:
    if value is None:
        return 'n/a'
    return f'{float(value):.3f}s'


def fmt_delta(value: Any) -> str:
    if value is None:
        return 'n/a'
    sign = '+' if float(value) > 0 else ''
    return f'{sign}{float(value):.3f}s'


def compute_review_mode(unit_id: str) -> str:
    if unit_id in WINDOW_UNITS:
        return 'window'
    if unit_id in BLOCKED_UNITS:
        return 'blocked'
    return 'row'


def compute_default_bucket(review_mode: str) -> str:
    return {
        'row': 'timing_review',
        'window': 'windowed_timing_review',
        'blocked': 'blocked_non_timing',
    }[review_mode]


def compute_default_verdict(unit_id: str, review_mode: str, runtime_statuses: list[str]) -> str:
    if review_mode == 'row':
        return 'timing_pass_row'
    if review_mode == 'window':
        return 'timing_pass_window'
    if unit_id == 'dlg-0009':
        return 'blocked_missing_runtime'
    if unit_id == 'dlg-0010':
        return 'needs_normalization_policy'
    if unit_id == 'dlg-0015':
        return 'blocked_text_drift'
    if 'unresolved' in runtime_statuses:
        return 'blocked_unresolved_runtime'
    return 'blocked_text_drift'


def compute_follow_on_owner(verdict: str) -> str:
    if verdict in {'timing_pass_row', 'timing_pass_window'}:
        return 'none'
    if verdict in {
        'timing_fail_clipped_start',
        'timing_fail_clipped_end',
        'timing_fail_overspan',
        'timing_fail_misplaced',
        'timing_fail_order_defect',
        'blocked_unresolved_runtime',
    }:
        return 'timestamp_alignment'
    if verdict in {'blocked_text_drift', 'blocked_missing_runtime'}:
        return 'dialogue_reconciliation'
    if verdict == 'needs_normalization_policy':
        return 'comparator_policy'
    raise ValueError(f'Unhandled verdict: {verdict}')


def build_unit_prompt(unit_id: str, review_mode: str, truth_text: str, runtime_text: str, boundary_class: str, mismatch_class: str, runtime_statuses: list[str]) -> str:
    if review_mode == 'row':
        return (
            f'{unit_id}: Does the runtime span for this exact matched line start and end on the correct spoken line '
            f'without clipping or overspan? Benchmark and runtime are text-clean; verify the single-line timing directly.'
        )
    if review_mode == 'window':
        return (
            f'{unit_id}: Does the aggregated runtime window cover the same spoken content as the benchmark window, '
            f'despite {boundary_class} segmentation drift? Judge the whole spoken window, not the child rows independently.'
        )
    blocker = 'text drift'
    if unit_id == 'dlg-0009':
        blocker = 'missing runtime coverage'
    elif unit_id == 'dlg-0010':
        blocker = 'normalization-policy ambiguity around Specter/Spectre plus punctuation/casing drift'
    elif 'unresolved' in runtime_statuses:
        blocker = 'text drift with unresolved runtime timing'
    return (
        f'{unit_id}: Timing review is currently blocked by {blocker}. Confirm whether this should stay blocked, '
        f'be treated as policy-normalizable, or be escalated as an upstream dialogue-surface defect. '
        f'Boundary={boundary_class}; mismatch={mismatch_class}.'
    )


def clip_suggestion(truth_start: Any, truth_end: Any, runtime_start: Any, runtime_end: Any, review_mode: str, runtime_statuses: list[str]) -> dict[str, Any]:
    pad = 1.0 if review_mode != 'blocked' else 1.5

    runtime_bounds_available = runtime_start is not None and runtime_end is not None
    truth_bounds_available = truth_start is not None and truth_end is not None

    if runtime_bounds_available:
        surface = 'runtime'
        start = max(0.0, round(float(runtime_start) - pad, 3))
        end = round(float(runtime_end) + pad, 3)
    elif truth_bounds_available:
        surface = 'truth'
        start = max(0.0, round(float(truth_start) - pad, 3))
        end = round(float(truth_end) + pad, 3)
    else:
        surface = 'unresolved'
        start = 0.0
        end = 0.0

    return {
        'surface': surface,
        'start': start,
        'end': end,
        'padding_seconds': pad,
    }


def main() -> None:
    truth_segments = load_json(TRUTH_PATH)['dialogue_segments']
    runtime_timestamp_segments = load_json(RUNTIME_TIMESTAMP_PATH)['dialogue_segments']
    runtime_text_segments = load_json(RUNTIME_TEXT_PATH)['dialogue_segments']
    comparison = load_json(COMPARISON_PATH)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    review_units = []
    for review_order, unit in enumerate(comparison['comparison_units'], start=1):
        unit_id = unit['comparison_unit_id']
        review_mode = compute_review_mode(unit_id)
        truth_rows = [truth_segments[index] for index in unit['truth_indexes']]
        runtime_rows = [runtime_timestamp_segments[index] for index in unit['runtime_indexes']]
        runtime_text_rows = [runtime_text_segments[index] for index in unit['runtime_indexes']]

        truth_start = min((row.get('start') for row in truth_rows), default=None)
        truth_end = max((row.get('end') for row in truth_rows), default=None)
        runtime_start = min((row.get('start') for row in runtime_rows if row.get('start') is not None), default=None)
        runtime_end = max((row.get('end') for row in runtime_rows if row.get('end') is not None), default=None)
        runtime_statuses = unit['runtime_timing_statuses']
        start_delta = None if truth_start is None or runtime_start is None else round(float(runtime_start) - float(truth_start), 3)
        end_delta = None if truth_end is None or runtime_end is None else round(float(runtime_end) - float(truth_end), 3)
        prompt = build_unit_prompt(
            unit_id,
            review_mode,
            unit['truth_text'],
            unit['runtime_text'],
            unit['boundary_class'],
            unit['mismatch_class'],
            runtime_statuses,
        )
        default_verdict = compute_default_verdict(unit_id, review_mode, runtime_statuses)

        review_units.append({
            'comparison_unit_id': unit_id,
            'review_order': review_order,
            'review_mode': review_mode,
            'truth_indexes': unit['truth_indexes'],
            'runtime_indexes': unit['runtime_indexes'],
            'boundary_class': unit['boundary_class'],
            'mismatch_class': unit['mismatch_class'],
            'text_match': unit['text_match'],
            'timing_status': unit['timing_verdict'],
            'truth_text': unit['truth_text'],
            'runtime_text': unit['runtime_text'],
            'truth_start': truth_start,
            'truth_end': truth_end,
            'runtime_start': runtime_start,
            'runtime_end': runtime_end,
            'truth_duration': row_duration(truth_start, truth_end),
            'runtime_duration': row_duration(runtime_start, runtime_end),
            'start_delta_seconds': start_delta,
            'end_delta_seconds': end_delta,
            'runtime_timing_statuses': runtime_statuses,
            'source_clip_suggestion': clip_suggestion(truth_start, truth_end, runtime_start, runtime_end, review_mode, runtime_statuses),
            'review_prompt': prompt,
            'default_verdict_bucket': compute_default_bucket(review_mode),
            'default_decision_template': {
                'verdict': default_verdict,
                'follow_on_owner': compute_follow_on_owner(default_verdict),
                'confidence': 'medium',
            },
            'notes': unit.get('notes', ''),
            'truth_rows': [
                {
                    'comparison_array_index': index,
                    'native_index': row.get('index', index),
                    'index': row.get('index', index),
                    'text': row['text'],
                    'speaker': row.get('speaker'),
                    'speaker_id': row.get('speaker_id'),
                    'start': row.get('start'),
                    'end': row.get('end'),
                    'duration': row_duration(row.get('start'), row.get('end')),
                }
                for index, row in zip(unit['truth_indexes'], truth_rows)
            ],
            'runtime_rows': [
                {
                    'comparison_array_index': index,
                    'native_index': row.get('index', index),
                    'index': row.get('index', index),
                    'text': row['text'],
                    'speaker': row.get('speaker'),
                    'speaker_id': row.get('speaker_id'),
                    'start': row.get('start'),
                    'end': row.get('end'),
                    'duration': row_duration(row.get('start'), row.get('end')),
                    'timing_status': row.get('timing', {}).get('status'),
                    'timing_method': row.get('timing', {}).get('method'),
                    'runtime_text_surface_text': text_row['text'],
                }
                for index, row, text_row in zip(unit['runtime_indexes'], runtime_rows, runtime_text_rows)
            ],
        })

    packet = {
        'packet_version': 1,
        'packet_kind': 'dialogue_timestamp_human_review',
        'benchmark_path': 'benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json',
        'runtime_timestamp_path': 'output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json',
        'runtime_text_path': 'output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json',
        'comparison_path': 'output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json',
        'qa_summary_path': '.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/summary.md',
        'summary': comparison['summary'],
        'review_mode_counts': {
            'row': sum(1 for unit in review_units if unit['review_mode'] == 'row'),
            'window': sum(1 for unit in review_units if unit['review_mode'] == 'window'),
            'blocked': sum(1 for unit in review_units if unit['review_mode'] == 'blocked'),
        },
        'review_units': review_units,
    }

    review_decisions = {
        'packet_version': 1,
        'packet_kind': 'dialogue_timestamp_human_review_decisions',
        'source_packet': '.plans/artifacts/2026-05-04-dialogue-timestamp-human-review/packet.json',
        'verdict_enum': VERDICT_ENUM,
        'template_status': 'pending_human_review',
        'decision_totals': {
            'timing_pass_row_count': 0,
            'timing_pass_window_count': 0,
            'timing_fail_count': 0,
            'blocked_text_drift_count': 0,
            'blocked_missing_runtime_count': 0,
            'blocked_unresolved_runtime_count': 0,
            'needs_normalization_policy_count': 0,
        },
        'decisions': [
            {
                'comparison_unit_id': unit['comparison_unit_id'],
                'review_mode': unit['review_mode'],
                'truth_indexes': unit['truth_indexes'],
                'runtime_indexes': unit['runtime_indexes'],
                'verdict': unit['default_decision_template']['verdict'],
                'reviewed_by': 'Derrick',
                'reviewed_at': 'YYYY-MM-DDTHH:MM:SSZ',
                'confidence': unit['default_decision_template']['confidence'],
                'notes': 'TEMPLATE DEFAULT ONLY — replace after human review.',
                'source_clip_checked': {
                    'start': unit['source_clip_suggestion']['start'],
                    'end': unit['source_clip_suggestion']['end'],
                },
                'follow_on_owner': unit['default_decision_template']['follow_on_owner'],
            }
            for unit in review_units
        ],
    }

    PACKET_JSON_PATH.write_text(json.dumps(packet, indent=2) + '\n')
    REVIEW_DECISIONS_PATH.write_text(json.dumps(review_decisions, indent=2) + '\n')

    lines: list[str] = []
    lines.append('# Dialogue Timestamp Human Review Packet')
    lines.append('')
    lines.append('- Packet kind: `dialogue_timestamp_human_review`')
    lines.append('- Packet version: `1`')
    lines.append('- Benchmark truth: `benchmarks/fixtures/cod-test/truth/dialogue-timestamps-data.reconciled.json`')
    lines.append('- Runtime timestamps: `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamps-data.reconciled.json`')
    lines.append('- Runtime text surface: `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-data.reconciled.json`')
    lines.append('- Machine comparison map: `output/cod-test-phase1-timestamp-validation/phase1-gather-context/dialogue-timestamp-vs-truth.comparison.json`')
    lines.append('- QA summary reference: `.plans/artifacts/2026-05-04-timestamp-benchmark-surface-qa/summary.md`')
    lines.append('')
    lines.append('## Review Instructions')
    lines.append('')
    lines.append('1. Review all 19 comparison units in order.')
    lines.append('2. Use `row` sections for exact one-line timing judgment.')
    lines.append('3. Use `window` sections for grouped split/merge timing judgment; judge the full spoken window, not the child rows independently.')
    lines.append('4. Use `blocked` sections to confirm why timing cannot yet be judged.')
    lines.append('5. Record final human decisions in `review-decisions.json` by replacing the template defaults.')
    lines.append('')
    lines.append('## Verdict Enum')
    lines.append('')
    for verdict in VERDICT_ENUM:
        lines.append(f'- `{verdict}`')
    lines.append('')
    lines.append('## Packet Summary')
    lines.append('')
    lines.append(f"- Comparison units: `{len(review_units)}`")
    lines.append(f"- Row review units: `{packet['review_mode_counts']['row']}`")
    lines.append(f"- Window review units: `{packet['review_mode_counts']['window']}` (`dlg-0001`, `dlg-0005`)")
    lines.append(f"- Blocked review units: `{packet['review_mode_counts']['blocked']}` (`dlg-0007`, `dlg-0009`, `dlg-0010`, `dlg-0015`, `dlg-0016`)")
    for key, value in packet['summary'].items():
        lines.append(f'- {key}: `{value}`')
    lines.append('')
    lines.append('## Review Units')
    lines.append('')

    for unit in review_units:
        lines.append(f"### {unit['comparison_unit_id']} — {unit['review_mode']}")
        lines.append('')
        lines.append(f"- Review order: `{unit['review_order']}`")
        lines.append(f"- Truth indexes: `{unit['truth_indexes']}`")
        lines.append(f"- Runtime indexes: `{unit['runtime_indexes']}`")
        lines.append(f"- Boundary class: `{unit['boundary_class']}`")
        lines.append(f"- Mismatch class: `{unit['mismatch_class']}`")
        lines.append(f"- Text match: `{unit['text_match']}`")
        lines.append(f"- Timing status: `{unit['timing_status']}`")
        lines.append(f"- Runtime timing statuses: `{unit['runtime_timing_statuses']}`")
        lines.append(f"- Truth text: `{unit['truth_text'] or '[none]'}`")
        lines.append(f"- Runtime text: `{unit['runtime_text'] or '[none]'}`")
        lines.append(f"- Truth span: `{fmt_time(unit['truth_start'])}` → `{fmt_time(unit['truth_end'])}` (duration `{fmt_time(unit['truth_duration'])}`)")
        lines.append(f"- Runtime span: `{fmt_time(unit['runtime_start'])}` → `{fmt_time(unit['runtime_end'])}` (duration `{fmt_time(unit['runtime_duration'])}`)")
        lines.append(f"- Start delta: `{fmt_delta(unit['start_delta_seconds'])}`")
        lines.append(f"- End delta: `{fmt_delta(unit['end_delta_seconds'])}`")
        clip = unit['source_clip_suggestion']
        lines.append(
            f"- Suggested source clip: `{fmt_time(clip['start'])}` → `{fmt_time(clip['end'])}` "
            f"(surface `{clip['surface']}`, padding `{clip['padding_seconds']:.1f}s` )"
        )
        lines.append(f"- Default verdict bucket: `{unit['default_verdict_bucket']}`")
        lines.append(f"- Review prompt: {unit['review_prompt']}")
        lines.append(f"- Notes: `{unit['notes'] or '[none]'}`")
        lines.append('')
        if unit['review_mode'] == 'window':
            lines.append('Child rows for grouped window review:')
        else:
            lines.append('Unit rows:')
        lines.append('')
        lines.append('**Benchmark truth rows**')
        for row in unit['truth_rows']:
            lines.append(
                f"- truth[array {row['comparison_array_index']} | row {row['native_index']}] {fmt_time(row['start'])} → {fmt_time(row['end'])} "
                f"(duration {fmt_time(row['duration'])}) — `{row['text']}`"
            )
        if not unit['truth_rows']:
            lines.append('- `[none]`')
        lines.append('')
        lines.append('**Runtime rows**')
        for row in unit['runtime_rows']:
            lines.append(
                f"- runtime[array {row['comparison_array_index']} | row {row['native_index']}] {fmt_time(row['start'])} → {fmt_time(row['end'])} "
                f"(duration {fmt_time(row['duration'])}; timing `{row['timing_status']}` via `{row['timing_method']}`) — `{row['text']}`"
            )
        if not unit['runtime_rows']:
            lines.append('- `[none]`')
        lines.append('')
        lines.append('---')
        lines.append('')

    PACKET_MD_PATH.write_text('\n'.join(lines).rstrip() + '\n')

    print(json.dumps({
        'packet_json': str(PACKET_JSON_PATH.relative_to(ROOT)),
        'packet_md': str(PACKET_MD_PATH.relative_to(ROOT)),
        'review_decisions': str(REVIEW_DECISIONS_PATH.relative_to(ROOT)),
        'review_units': len(review_units),
        'review_mode_counts': packet['review_mode_counts'],
    }, indent=2))


if __name__ == '__main__':
    main()
