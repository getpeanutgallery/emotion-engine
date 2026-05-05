#!/usr/bin/env python3
import argparse
import json
import sys
from importlib import metadata

from faster_whisper import WhisperModel


def resolve_engine_version():
    try:
        return metadata.version('faster-whisper')
    except metadata.PackageNotFoundError:
        return None


def coerce_word(word):
    payload = {
        'word': getattr(word, 'word', ''),
        'start': getattr(word, 'start', None),
        'end': getattr(word, 'end', None),
        'probability': getattr(word, 'probability', None)
    }
    return {key: value for key, value in payload.items() if value is not None}


def coerce_segment(segment):
    payload = {
        'id': getattr(segment, 'id', None),
        'start': getattr(segment, 'start', None),
        'end': getattr(segment, 'end', None),
        'text': getattr(segment, 'text', ''),
        'avg_logprob': getattr(segment, 'avg_logprob', None),
        'no_speech_prob': getattr(segment, 'no_speech_prob', None),
        'words': [coerce_word(word) for word in (getattr(segment, 'words', None) or [])]
    }
    return {key: value for key, value in payload.items() if value is not None}


def run_attempt(asset_path, model_name, download_root, device, compute_type, prior_failures=None):
    model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        download_root=download_root
    )
    segments_iter, info = model.transcribe(
        asset_path,
        word_timestamps=True,
        vad_filter=False
    )
    segments = [coerce_segment(segment) for segment in segments_iter]
    total_duration = getattr(info, 'duration', None)
    if total_duration is None and segments:
        total_duration = segments[-1].get('end')

    warnings = []
    for failure in (prior_failures or []):
        warnings.append(
            'Fallback from '
            f"{failure['device']}/{failure['computeType']} due to {failure['error']}"
        )

    return {
        'dialogue_segments': segments,
        'summary': '',
        'totalDuration': total_duration,
        'runtime': {
            'device': device,
            'computeType': compute_type,
            'model': model_name,
            'wordTimestamps': True,
            'vadFilter': False
        },
        'engine': {
            'name': 'faster_whisper',
            'version': resolve_engine_version()
        },
        'warnings': warnings
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--asset-path', required=True)
    parser.add_argument('--model', default='small.en')
    parser.add_argument('--download-root', required=True)
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
        'error': 'All faster-whisper runtime attempts failed.',
        'attempts': failures
    }))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
