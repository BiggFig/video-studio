#!/usr/bin/env python3
"""Reproduce a local mixed-footage motion render; no model or paid API calls."""
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path
import video_tool as v


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cli', required=True);p.add_argument('--gsap-file', required=True)
    p.add_argument('--font-file', required=True);p.add_argument('--browser', required=True)
    p.add_argument('--out', required=True)
    a=p.parse_args();dest=Path(a.out).resolve();cli=str(Path(a.cli).resolve())
    if dest.exists() and any(dest.iterdir()):p.error('out must be an empty directory')
    dest.mkdir(parents=True,exist_ok=True)
    env=dict(os.environ,HYPERFRAMES_SKIP_SKILLS='1',HYPERFRAMES_BROWSER_PATH=str(Path(a.browser).resolve()))
    def command(args,log):
        result=subprocess.run([cli,*args],env=env,capture_output=True,text=True)
        (dest/log).write_text(result.stdout+'\n'+result.stderr)
        if result.returncode:raise ValueError('Hyperframes failed; see '+str(dest/log))
        return result.stdout
    # Use the supplied local binary rather than npx fetching changing versions.
    command(['init',str(dest/'project'),'--non-interactive'],'init.log')
    project=dest/'project';assets=project/'assets';assets.mkdir(exist_ok=True)
    skill=Path(__file__).resolve().parents[1]
    for filename in ['CLAUDE.md','AGENTS.md']:
        (project/filename).write_text('Read '+str(skill/'SKILL.md')+' and use its single workflow.\n')
    (project/'index.html').write_text((skill/'assets/composition-example.html').read_text())
    shutil.copyfile(a.gsap_file,assets/'gsap.min.js');shutil.copyfile(a.font_file,assets/'font.ttf')
    v.ff(['-f','lavfi','-i','testsrc2=size=640x360:rate=30:duration=6',
          '-f','lavfi','-i','sine=frequency=660:sample_rate=48000:duration=6',
          '-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-g','30','-keyint_min','30',
          '-c:a','aac',assets/'raw.mp4'])
    command(['lint',str(project)],'lint.log')
    check=command(['check',str(project),'--samples','3','--at-transitions','--json'],'check.log')
    # CLI may include diagnostic lines before its JSON result.
    start=check.find('{');data=json.loads(check[start:])
    if not data.get('ok'):raise ValueError('Hyperframes check did not pass')
    command(['render',str(project),'--quality','draft','--workers','1',
             '--output',str(dest/'draft.mp4')],'render.log')
    report=v.verify(dest/'draft.mp4')
    if (report['width'],report['height'],report['fps'])!=(320,180,30) or not report['has_audio']:
        raise ValueError('unexpected render metadata')
    if abs(report['duration_seconds']-2)>1/30:raise ValueError('unexpected duration')
    v.ff(['-i',dest/'draft.mp4','-vf','fps=2,scale=640:-1,tile=2x2','-frames:v','1',dest/'contact-sheet.jpg'])
    report.update(hyperframes_check=data['ok'],visual_review='required; inspect contact-sheet.jpg',
                  note='Synthetic smoke render only; no style-transfer or semantic quality certification')
    (dest/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
