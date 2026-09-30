#!/usr/bin/env python3
"""Optional ElevenLabs TTS alignment/SFX helper. Live calls incur provider charges."""
import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


def request(endpoint, payload, key):
    req = urllib.request.Request('https://api.elevenlabs.io/v1/' + endpoint,
        data=json.dumps(payload).encode(), headers={'xi-api-key': key, 'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            return response.read()
    except urllib.error.HTTPError as e:
        # Do not print request headers or provider response which may echo sensitive data.
        raise ValueError(f'ElevenLabs HTTP {e.code}; inspect provider dashboard') from None
    except urllib.error.URLError:
        raise ValueError('ElevenLabs connection failed') from None


def generate(kind, text, out, voice=None, model='eleven_multilingual_v2', seconds=2, max_chars=3000, overwrite=False):
    out = Path(out)
    alignment_path = out.with_suffix('.alignment.json')
    if out.exists() and not overwrite:
        raise ValueError('output exists; reuse it or explicitly pass --overwrite to regenerate')
    if kind == 'tts' and alignment_path.exists() and not overwrite:
        raise ValueError('alignment output exists; use a new path or --overwrite')
    if not text.strip() or len(text) > max_chars:
        raise ValueError(f'text must contain 1..{max_chars} characters')
    if kind == 'tts' and (not voice or not re.fullmatch(r'[A-Za-z0-9_-]+', voice)):
        raise ValueError('tts requires a valid configured voice ID')
    if kind == 'sfx' and not 0.5 <= seconds <= 30:
        raise ValueError('SFX duration must be 0.5..30 seconds')
    key = os.environ.get('ELEVENLABS_API_KEY')
    if not key:
        raise ValueError('ELEVENLABS_API_KEY is not configured')
    out.parent.mkdir(parents=True, exist_ok=True)
    if kind == 'tts':
        data = json.loads(request(f'text-to-speech/{voice}/with-timestamps', {'text': text, 'model_id': model}, key))
        audio = base64.b64decode(data['audio_base64'], validate=True)
        if not audio:
            raise ValueError('provider returned empty audio')
        out.write_bytes(audio)
        alignment_path.write_text(json.dumps({'alignment': data.get('alignment'),
            'normalized_alignment': data.get('normalized_alignment')}, indent=2))
        return {'audio': str(out), 'alignment': str(alignment_path)}
    audio = request('sound-generation', {'text': text, 'duration_seconds': seconds, 'prompt_influence': 0.3}, key)
    if not audio:
        raise ValueError('provider returned empty audio')
    out.write_bytes(audio)
    return {'audio': str(out), 'duration_requested': seconds}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('kind', choices=['tts', 'sfx'])
    p.add_argument('--text-file', required=True); p.add_argument('--out', required=True)
    p.add_argument('--voice'); p.add_argument('--model', default='eleven_multilingual_v2')
    p.add_argument('--seconds', type=float, default=2); p.add_argument('--max-chars', type=int, default=3000)
    p.add_argument('--overwrite', action='store_true')
    args = p.parse_args()
    try:
        result = generate(args.kind, Path(args.text_file).read_text(), args.out, args.voice,
                          args.model, args.seconds, args.max_chars, args.overwrite)
        print(json.dumps(result, indent=2)); return 0
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr); return 2


if __name__ == '__main__':
    sys.exit(main())
