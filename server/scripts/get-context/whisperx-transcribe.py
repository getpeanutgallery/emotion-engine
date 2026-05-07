#!/usr/bin/env python3
import argparse
import json
import sys
from importlib import metadata


def resolve_engine_version():
    try:
        return metadata.version('whisperx')
    except metadata.PackageNotFoundError:
        return None


def coerce_word(word):
    payload = {
        'word': word.get('word', ''),
        'start': word.get('start'),
        'end': word.get('end'),
        'score': word.get('score')
    }
    return {key: value for key, value in payload.items() if value is not None}


def coerce_segment(segment, fallback_id=None):
    payload = {
        'id': segment.get('id', fallback_id),
        'start': segment.get('start'),
        'end': segment.get('end'),
        'text': segment.get('text', ''),
        'avg_logprob': segment.get('avg_logprob'),
        'words': [coerce_word(word) for word in (segment.get('words') or [])]
    }
    return {key: value for key, value in payload.items() if value is not None}


def summarize_failures(failures):
    return [
        'Fallback from '
        f"{failure['device']}/{failure['computeType']} due to {failure['error']}"
        for failure in (failures or [])
    ]


def run_attempt(asset_path, model_name, download_root, batch_size, device, compute_type, prior_failures=None):
    import whisperx

    audio = whisperx.load_audio(asset_path)
    model = whisperx.load_model(
        model_name,
        device,
        compute_type=compute_type,
        download_root=download_root,
        language='en'
    )
    transcription = model.transcribe(audio, batch_size=batch_size, language='en')
    language_code = transcription.get('language') or 'en'
    align_model, align_metadata = whisperx.load_align_model(language_code=language_code, device=device)
    aligned = whisperx.align(
        transcription.get('segments', []),
        align_model,
        align_metadata,
        audio,
        device,
        return_char_alignments=False
    )

    segments = [
        coerce_segment(segment, fallback_id=index)
        for index, segment in enumerate(aligned.get('segments', []) or [])
    ]
    total_duration = aligned.get('duration')
    if total_duration is None and segments:
        total_duration = segments[-1].get('end')
    if total_duration is None and hasattr(audio, '__len__'):
        try:
            total_duration = len(audio) / 16000
        except Exception:
            total_duration = None

    return {
        'dialogue_segments': segments,
        'summary': '',
        'totalDuration': total_duration,
        'runtime': {
            'device': device,
            'computeType': compute_type,
            'model': model_name,
            'batchSize': batch_size,
            'language': language_code,
            'alignmentModel': align_metadata.get('model_name') if isinstance(align_metadata, dict) else None,
            'wordTimestamps': True,
            'vadFilter': False
        },
        'engine': {
            'name': 'whisperx',
            'version': resolve_engine_version()
        },
        'warnings': summarize_failures(prior_failures)
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--asset-path', required=True)
    parser.add_argument('--model', default='small.en')
    parser.add_argument('--download-root', required=True)
    parser.add_argument('--batch-size', type=int, default=16)
    args = parser.parse_args()

    attempts = [
        ('cuda', 'float16'),
        ('cpu', 'int8')
    ]
    failures = []

    for device, compute_type in attempts:
        try:
            result = run_attempt(
                args.asset_path,
                args.model,
                args.download_root,
                args.batch_size,
                device,
                compute_type,
                prior_failures=failures
            )
            sys.stdout.write(json.dumps(result))
            return 0
        except Exception as exc:  # noqa: BLE001 - we want the honest fallback details
            failures.append({
                'device': device,
                'computeType': compute_type,
                'error': f'{exc.__class__.__name__}: {exc}'
            })

    sys.stderr.write(json.dumps({
        'error': 'All WhisperX runtime attempts failed.',
        'attempts': failures,
        'bootstrapHint': 'Create .venv-whisperx and install whisperx plus its alignment dependencies before selecting the whisperx backend.'
    }))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
