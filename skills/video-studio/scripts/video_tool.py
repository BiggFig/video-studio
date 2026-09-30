#!/usr/bin/env python3
"""Local media inspection, validated base assembly, captions, and encode QC."""
import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run(args):
    result = subprocess.run([str(x) for x in args], capture_output=True, text=True)
    if result.returncode:
        raise ValueError(f'{Path(str(args[0])).name} failed: {result.stderr[-2500:]}')
    return result.stdout


def ff(args):
    return run(['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'error',
                '-y', '-filter_threads', '1', '-filter_complex_threads', '1', *args])


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_format',
                          '-show_streams', '-of', 'json', path]))


def number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def integer(x):
    return isinstance(x, int) and not isinstance(x, bool)


def duration(meta):
    candidates = [meta.get('format', {}).get('duration')]
    candidates += [s.get('duration') for s in meta.get('streams', [])]
    return max([float(x) for x in candidates if x is not None] or [0])


def read_plan(path):
    path = Path(path).resolve()
    plan = json.loads(path.read_text())
    errors = []
    out = plan.get('output', {})
    for key in ['width', 'height', 'fps', 'duration_frames']:
        if not integer(out.get(key)) or out[key] <= 0:
            errors.append(f'output.{key} must be a positive integer')
    if errors:
        raise ValueError('; '.join(errors))
    fps = out['fps']
    if fps not in (24, 25, 30, 50, 60):
        errors.append('fps must be 24, 25, 30, 50, or 60')
    if out['width'] % 2 or out['height'] % 2:
        errors.append('MP4 dimensions must be even')
    if plan.get('version') != 1:
        errors.append('version must be 1')
    if plan.get('mode') not in ('edit', 'create'):
        errors.append('mode must be edit or create')
    if plan.get('renderer') not in ('hyperframes', 'ffmpeg', 'remotion'):
        errors.append('unsupported primary renderer')
    if not isinstance(plan.get('job_id'), str) or not plan['job_id'].strip():
        errors.append('job_id must be a nonempty string')
    assets = {}
    for a in plan.get('assets', []):
        aid = a.get('id')
        if not isinstance(aid, str) or not aid or aid in assets:
            errors.append(f'invalid/duplicate asset id: {aid}'); continue
        assets[aid] = dict(a)
        if a.get('kind') not in ('video', 'image', 'audio'):
            errors.append(f'{aid}: unsupported kind'); continue
        if a.get('usage') not in ('output', 'reference') or not a.get('rights'):
            errors.append(f'{aid}: usage and rights are required')
        try:
            local = (path.parent / a['path']).resolve()
            local.relative_to(path.parent)
            if not local.is_file():
                raise ValueError('missing file')
            meta = probe(local)
            types = {s.get('codec_type') for s in meta['streams']}
            if a['kind'] in ('video', 'image') and 'video' not in types:
                raise ValueError('no video/image stream')
            if a['kind'] == 'audio' and 'audio' not in types:
                raise ValueError('no audio stream')
            assets[aid].update(_path=local, _duration=duration(meta), _has_audio='audio' in types)
        except (KeyError, ValueError, OSError) as e:
            errors.append(f'{aid}: invalid local media ({e})')

    def window(layer, name, audio=False):
        aid = layer.get('asset_id')
        a = assets.get(aid)
        if a is None:
            errors.append(f'{name}: unknown asset {aid}'); return
        if a.get('usage') != 'output':
            errors.append(f'{name}: reference assets cannot enter output')
        if audio and not a.get('_has_audio'):
            errors.append(f'{name}: no audio source')
        if not audio and a.get('kind') not in ('video', 'image'):
            errors.append(f'{name}: scene requires video/image')
        start, count = layer.get('start_frame'), layer.get('duration_frames')
        if not integer(start) or start < 0 or not integer(count) or count <= 0:
            errors.append(f'{name}: invalid frame range'); return
        if start + count > out['duration_frames']:
            errors.append(f'{name}: exceeds output duration')
        offset, rate = layer.get('source_in_seconds', 0), layer.get('playback_rate', 1)
        if not number(offset) or offset < 0 or not number(rate) or not 0.1 <= rate <= 10:
            errors.append(f'{name}: invalid source offset/rate'); return
        if a.get('kind') == 'image':
            if offset != 0 or rate != 1:
                errors.append(f'{name}: image must have zero offset and rate 1')
        elif '_duration' in a and offset + count / fps * rate > a['_duration'] + 1 / fps:
            errors.append(f'{name}: source range exceeds actual media duration')

    cursor, ids = 0, set()
    for i, scene in enumerate(plan.get('scenes', [])):
        sid = scene.get('id')
        if not isinstance(sid, str) or not sid or sid in ids:
            errors.append(f'scene {i}: invalid/duplicate id')
        ids.add(sid)
        window(scene, f'scene {sid}')
        if scene.get('start_frame') != cursor:
            errors.append(f'scene {sid}: base scenes must be contiguous and ordered')
        if integer(scene.get('duration_frames')):
            cursor += scene['duration_frames']
        if scene.get('fit', 'contain') not in ('contain', 'cover'):
            errors.append(f'scene {sid}: invalid fit')
        if not isinstance(scene.get('preserve_audio', False), bool):
            errors.append(f'scene {sid}: preserve_audio must be boolean')
        if scene.get('preserve_audio') and not assets.get(scene.get('asset_id'), {}).get('_has_audio'):
            errors.append(f'scene {sid}: requested source audio is absent')
        if not isinstance(scene.get('effects', []), list):
            errors.append(f'scene {sid}: effects must be a list')
    if cursor != out['duration_frames']:
        errors.append('base scenes must exactly cover output duration')
    for i, layer in enumerate(plan.get('audio', [])):
        window(layer, f'audio {i}', audio=True)
        if not number(layer.get('gain_db', 0)) or not -80 <= layer.get('gain_db', 0) <= 12:
            errors.append(f'audio {i}: gain_db outside -80..12')
    for i, c in enumerate(plan.get('captions', [])):
        start, end = c.get('start_frame'), c.get('end_frame')
        if not integer(start) or not integer(end) or not 0 <= start < end <= out['duration_frames']:
            errors.append(f'caption {i}: invalid frame range')
        if not isinstance(c.get('text'), str) or not c['text'].strip():
            errors.append(f'caption {i}: text must be nonempty')
    if errors:
        raise ValueError('\n'.join(errors))
    return plan, assets


def doctor():
    versions = {}
    for tool in ('ffmpeg', 'ffprobe'):
        versions[tool] = run([tool, '-version']).splitlines()[0] if shutil.which(tool) else None
    return {'ok': all(versions.values()), 'python': sys.version.split()[0], 'tools': versions}


def inspect(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    meta = probe(source)
    (output / 'probe.json').write_text(json.dumps(meta, indent=2))
    length = duration(meta)
    if any(s['codec_type'] == 'video' for s in meta['streams']):
        frequency = 16 / max(length, 1)
        ff(['-i', source, '-vf', f'fps={frequency},scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,tile=4x4',
            '-frames:v', '1', '-update', '1', output / 'contact-sheet.jpg'])
        cuts = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-filter_threads', '1', '-i', str(source),
                               '-vf', "select='gt(scene,0.3)',showinfo", '-an', '-f', 'null', '-'], capture_output=True, text=True)
        if cuts.returncode:
            raise ValueError('scene candidate analysis failed')
        (output / 'cut-candidates.json').write_text(json.dumps({'threshold': 0.3, 'times_seconds':
            [float(x) for x in re.findall(r'pts_time:([0-9.]+)', cuts.stderr)], 'heuristic': True}, indent=2))
    if any(s['codec_type'] == 'audio' for s in meta['streams']):
        silence = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-i', str(source),
                                  '-af', 'silencedetect=noise=-35dB:d=0.3', '-vn', '-f', 'null', '-'], capture_output=True, text=True)
        if silence.returncode:
            raise ValueError('silence candidate analysis failed')
        (output / 'silence-candidates.log').write_text(silence.stderr)
    return {'status': 'analyzed', 'duration_seconds': length, 'output': str(output),
            'semantic_analysis': 'not_performed', 'transcription': 'not_performed'}


def tempo(rate):
    factors = []
    while rate > 2:
        factors.append(2); rate /= 2
    while rate < 0.5:
        factors.append(0.5); rate /= 0.5
    factors.append(rate)
    return ','.join(f'atempo={x:.9g}' for x in factors)


def roughcut(plan_path, output):
    plan, assets = read_plan(plan_path)
    if plan.get('audio') or plan.get('captions') or plan.get('effects') or any(s.get('effects') for s in plan['scenes']):
        raise ValueError('roughcut refuses captions/effects/extra audio; implement in primary compositor')
    output = Path(output).resolve(); output.parent.mkdir(parents=True, exist_ok=True)
    if output in [a['_path'] for a in assets.values()]:
        raise ValueError('output cannot overwrite a source asset')
    o = plan['output']; w, h, fps = o['width'], o['height'], o['fps']
    with tempfile.TemporaryDirectory(prefix='video-studio-', dir=output.parent) as tmp:
        tmp = Path(tmp)
        for i, scene in enumerate(plan['scenes']):
            a = assets[scene['asset_id']]; rate = scene.get('playback_rate', 1)
            seconds = scene['duration_frames'] / fps
            args = []
            if a['kind'] == 'image':
                args += ['-loop', '1', '-framerate', str(fps)]
            else:
                args += ['-ss', str(scene.get('source_in_seconds', 0))]
            args += ['-i', a['_path']]
            preserve = scene.get('preserve_audio', False)
            if not preserve:
                args += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
            if scene.get('fit', 'contain') == 'cover':
                scale = f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}'
            else:
                scale = f'scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2'
            vf = f'setpts=(PTS-STARTPTS)/{rate},{scale},setsar=1,fps={fps}'
            af = f'{tempo(rate)},aresample=48000,apad,atrim=duration={seconds}' if preserve else f'atrim=duration={seconds}'
            args += ['-map', '0:v:0', '-map', '0:a:0' if preserve else '1:a:0', '-vf', vf, '-af', af,
                     '-t', str(seconds), '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18',
                     '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', tmp / f'{i:05d}.mkv']
            ff(args)
        manifest = tmp / 'concat.txt'
        manifest.write_text(''.join(f"file '{i:05d}.mkv'\n" for i in range(len(plan['scenes']))))
        ff(['-f', 'concat', '-safe', '0', '-i', manifest, '-vf', f'setpts=PTS-STARTPTS,fps={fps}',
            '-af', 'asetpts=PTS-STARTPTS', '-t', str(o['duration_frames'] / fps),
            '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output])
    result = verify(output, plan_path)
    result.update(artifact='base_assembly', output=str(output), visual_review='not_performed')
    return result


def srt_time(frame, fps):
    ms = round(frame / fps * 1000)
    hours, ms = divmod(ms, 3600000); minutes, ms = divmod(ms, 60000); seconds, ms = divmod(ms, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02},{ms:03}'


def captions(plan_path, output):
    plan, _ = read_plan(plan_path); fps = plan['output']['fps']
    chunks = []
    for i, c in enumerate(sorted(plan.get('captions', []), key=lambda x: x['start_frame']), 1):
        # Remove control characters, preserve intentional line breaks.
        clean = ''.join(x for x in c['text'] if ord(x) >= 32 or x == '\n').replace('\r', '')
        chunks.append(f"{i}\n{srt_time(c['start_frame'],fps)} --> {srt_time(c['end_frame'],fps)}\n{clean}\n")
    output = Path(output); output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text('\n'.join(chunks))
    return {'captions': len(chunks), 'output': str(output)}


def verify(source, plan_path=None):
    meta = probe(source)
    videos = [s for s in meta['streams'] if s['codec_type'] == 'video']
    if not videos:
        raise ValueError('output has no video stream')
    ff(['-v', 'error', '-xerror', '-i', source, '-f', 'null', '-'])
    video = videos[0]; issues = []
    num, den = video.get('avg_frame_rate', '0/1').split('/')
    actual_fps = float(num) / float(den) if float(den) else 0
    audio = any(s['codec_type'] == 'audio' for s in meta['streams'])
    if plan_path:
        plan, _ = read_plan(plan_path); out = plan['output']
        if (video['width'], video['height']) != (out['width'], out['height']):
            issues.append('output dimensions differ from plan')
        if abs(actual_fps - out['fps']) > 0.01:
            issues.append('output fps differs from plan')
        vd = float(video.get('duration') or duration(meta))
        if abs(vd - out['duration_frames'] / out['fps']) > 1.1 / out['fps']:
            issues.append('output duration differs from plan')
        if video.get('nb_frames') and abs(int(video['nb_frames']) - out['duration_frames']) > 1:
            issues.append('output frame count differs from plan')
        expected_audio = bool(plan.get('audio')) or any(s.get('preserve_audio') for s in plan['scenes'])
        if expected_audio and not audio:
            issues.append('expected audio stream absent')
    if issues:
        raise ValueError('; '.join(issues))
    return {'technical_status': 'passed', 'full_decode': True, 'width': video['width'], 'height': video['height'],
            'fps': actual_fps, 'duration_seconds': duration(meta), 'has_audio': audio,
            'semantic_visual_audio_review': 'not_performed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('doctor')
    q = sub.add_parser('inspect'); q.add_argument('source'); q.add_argument('--out', required=True)
    q = sub.add_parser('validate'); q.add_argument('plan')
    for name in ('roughcut', 'captions'):
        q = sub.add_parser(name); q.add_argument('plan'); q.add_argument('--out', required=True)
    q = sub.add_parser('verify'); q.add_argument('source'); q.add_argument('--plan')
    a = parser.parse_args()
    try:
        if a.command == 'doctor':
            result = doctor()
            print(json.dumps(result, indent=2)); return 0 if result['ok'] else 2
        if a.command == 'inspect': result = inspect(a.source, a.out)
        elif a.command == 'validate':
            plan, _ = read_plan(a.plan); result = {'valid': True, 'job_id': plan['job_id']}
        elif a.command == 'roughcut': result = roughcut(a.plan, a.out)
        elif a.command == 'captions': result = captions(a.plan, a.out)
        else: result = verify(a.source, a.plan)
        print(json.dumps(result, indent=2)); return 0
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr); return 2


if __name__ == '__main__':
    sys.exit(main())
