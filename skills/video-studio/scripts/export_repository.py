#!/usr/bin/env python3
"""Export the skill into a self-contained GitHub-ready repository (no archive)."""
import argparse
import json
import shutil
from pathlib import Path

README = '''# Video Studio

One agent skill for reference-style footage editing and video creation. It consolidates BRAG's creative workflow, motion-design recipes, reference analysis, sound, and render review into one plan and one set of instructions.

## Start

Requirements: Python 3.10+, FFmpeg/FFprobe. For motion composition: Node22+, pinned Hyperframes and a browser. Copy `skills/video-studio` to your agent's supported skills folder, or ask Claude Code in this repository to read `CLAUDE.md`. Do not install the upstream packs too.

Example requests:
- “Edit assets/raw.mp4 like assets/reference.mp4. Keep my voice and add captions.”
- “Turn this product URL and these screenshots into a 20-second launch video.”
- “Turn this PRD and supplied images into a narrated explainer.”

The skill performs intake → analysis → plan → composition → render/review → delivery. It chooses relevant reference chapters internally. All jobs use the same timeline/asset/output contract.

## Layout

- `skills/video-studio/SKILL.md`: single workflow and authority.
- `references/` inside the skill: consolidated techniques, rendering, audio, quality, and SaaS execution.
- `scripts/` inside the skill: media tooling, optional ElevenLabs helper, repeatable repository export.
- `assets/` inside the skill: example plan, source revisions, capability map, license notices.
- `tests/`: synthetic media smoke test; offline provider tests. No paid calls.
- `docs/VALIDATION.md`: checks actually performed and untested integrations.

## Local tools

```bash
python skills/video-studio/scripts/video_tool.py doctor
python skills/video-studio/scripts/video_tool.py inspect /path/input.mp4 --out /path/analysis
python skills/video-studio/scripts/video_tool.py validate /path/job/plan.json
python skills/video-studio/scripts/video_tool.py roughcut /path/job/plan.json --out /path/job/renders/draft.mp4
python skills/video-studio/scripts/video_tool.py verify /path/job/renders/final.mp4 --plan /path/job/plan.json
python tests/smoke.py
```

Copy `assets/plan-example.json` into a job directory and supply real local assets before validation. The example references a user file; it is not a bundled sample. Jobs live outside the skill.

`roughcut` is base assembly and refuses captions/effects/extra audio. The agent must implement styled edits in a compositor. ASR, semantic reference review, IG/TT ingestion, and cloud infrastructure are configured integrations, not implemented by the skill text. Optional ElevenLabs calls incur provider charges. Advanced recipes do not install every renderer.

## Renderer dependencies

The candidate renderer is pinned in package.json. Run `npm install` in the worker/project and follow the skill's rendering chapter. No consumer Claude account or API key is distributed. Use approved provider authentication and per-job cost limits.

## Sources

See `skills/video-studio/references/provenance.md`, `assets/sources.json`, and source license notices. Source media, framework licenses, and service terms are separate. Unlicensed gist/Outliers/illustration material is conceptual context only, not vendored content.
'''
CLAUDE = '''# Video Studio repository instructions

Read `skills/video-studio/SKILL.md` and follow its single end-to-end workflow for video work. Resolve its supporting chapters/scripts relative to that folder. Do not install or invoke upstream skills. Keep user job data outside the skill and apply its shared contract. User instructions and budgets govern all decisions. Never assume optional providers or renderers are installed. Record actual checks and unmet requirements.
'''
LICENSE = '''MIT License

Copyright (c) 2026 Video Studio contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Third-party-derived guidance retains the notices under
skills/video-studio/assets/licenses/. This license does not license external
frameworks, downloaded media, fonts, hosted services, or user uploads.
'''


def export(target):
    skill = Path(__file__).resolve().parents[1]
    target = Path(target).resolve()
    if target.exists() and any(target.iterdir()):
        raise ValueError('destination must be empty; refusing to overwrite a repository')
    if target == skill or skill in target.parents:
        raise ValueError('repository must be outside installed skill')
    target.mkdir(parents=True, exist_ok=True)
    shutil.copytree(skill, target / 'skills/video-studio', ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    for name, text in {'README.md': README, 'CLAUDE.md': CLAUDE, 'LICENSE': LICENSE,
                       '.gitignore': 'node_modules/\n.env\n.env.*\n!.env.example\n__pycache__/\n*.pyc\njobs/\nrenders/\n.DS_Store\n'}.items():
        (target / name).write_text(text)
    (target / 'package.json').write_text(json.dumps({'name':'video-studio','private':True,'version':'0.1.0',
        'engines':{'node':'>=22'},'dependencies':{'hyperframes':'0.8.97','gsap':'3.14.2'}},indent=2)+'\n')
    (target / '.env.example').write_text('ELEVENLABS_API_KEY=\nELEVENLABS_VOICE_ID=\n')
    tests = target / 'tests'; tests.mkdir()
    shutil.copyfile(skill / 'scripts/smoke_test.py', tests / 'smoke.py')
    docs = target / 'docs'; docs.mkdir()
    (docs / 'VALIDATION.md').write_text((skill / 'assets/validation.md').read_text())
    return {'repository':str(target),'files':len([p for p in target.rglob('*') if p.is_file()])}


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('destination');a=p.parse_args()
    try: print(json.dumps(export(a.destination),indent=2))
    except (OSError, ValueError) as e: p.exit(2, str(e)+'\n')
