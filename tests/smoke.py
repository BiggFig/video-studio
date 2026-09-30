#!/usr/bin/env python3
"""Synthetic-media integration checks and offline provider tests; no billed calls."""
import base64
import importlib.util
import json
import os
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'skills/video-studio' if (ROOT / 'skills/video-studio').exists() else ROOT


def module(name):
    spec=importlib.util.spec_from_file_location(name,SKILL / 'scripts' / (name+'.py'))
    obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj


def rejected(fn, phrase):
    try: fn()
    except ValueError as e:
        assert phrase in str(e), str(e)
    else: raise AssertionError('expected rejection: '+phrase)


def main():
    v=module('video_tool');audio=module('elevenlabs_audio')
    assert v.doctor()['ok']
    with tempfile.TemporaryDirectory(prefix='video-studio-test-') as tmp:
        d=Path(tmp);(d/'assets').mkdir()
        raw=d/'assets/raw.mp4'
        v.ff(['-f','lavfi','-i','testsrc2=size=320x180:rate=30:duration=6',
              '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=6',
              '-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac',raw])
        picture=d/'assets/still.png'
        v.ff(['-f','lavfi','-i','color=c=blue:s=200x300','-frames:v','1','-threads','1',picture])
        plan={'version':1,'job_id':'smoke','mode':'edit','renderer':'ffmpeg',
              'output':{'width':180,'height':320,'fps':30,'duration_frames':120},
              'assets':[{'id':'raw','path':'assets/raw.mp4','kind':'video','usage':'output','rights':'synthetic'},
                        {'id':'still','path':'assets/still.png','kind':'image','usage':'output','rights':'synthetic'}],
              'scenes':[{'id':'a','start_frame':0,'duration_frames':60,'asset_id':'raw',
                         'source_in_seconds':1,'playback_rate':1.5,'preserve_audio':True,'fit':'cover','effects':[]},
                        {'id':'b','start_frame':60,'duration_frames':60,'asset_id':'still',
                         'source_in_seconds':0,'playback_rate':1,'preserve_audio':False,'fit':'contain','effects':[]}],
              'audio':[],'captions':[]}
        p=d/'plan.json'
        def save(): p.write_text(json.dumps(plan))
        save();v.read_plan(p)
        v.inspect(raw,d/'analysis')
        assert (d/'analysis/contact-sheet.jpg').stat().st_size > 0
        result=v.roughcut(p,d/'renders/draft.mp4');assert result['technical_status']=='passed'
        assert result['has_audio'] and result['width']==180
        encoded=v.probe(d/'renders/draft.mp4')
        assert abs(float(encoded['format']['duration'])-4.0)<0.005
        assert all(abs(float(s.get('start_time',0)))<0.005 for s in encoded['streams'])
        # Verify retained audio has energy, beyond mere stream presence.
        samples=subprocess.run(['ffmpeg','-v','error','-i',str(d/'renders/draft.mp4'),'-t','1',
             '-vn','-f','s16le','-ac','1','-ar','8000','-'],capture_output=True,check=True).stdout
        assert any(samples), 'retained source audio is silent'
        plan['captions']=[{'text':'Real caption','start_frame':15,'end_frame':45}];save()
        v.captions(p,d/'captions.srt');assert '00:00:00,500 --> 00:00:01,500' in (d/'captions.srt').read_text()
        rejected(lambda:v.roughcut(p,d/'forbidden.mp4'),'refuses')
        plan['captions']=[];plan['scenes'][0]['source_in_seconds']=5;save()
        rejected(lambda:v.read_plan(p),'exceeds actual media')
        plan['scenes'][0]['source_in_seconds']=1;plan['assets'][0]['usage']='reference';save()
        rejected(lambda:v.read_plan(p),'reference assets')
        plan['assets'][0]['usage']='output';plan['scenes'][1]['start_frame']=61;save()
        rejected(lambda:v.read_plan(p),'contiguous')
        plan['scenes'][1]['start_frame']=60;plan['assets'][0]['path']='../outside.mp4';save()
        rejected(lambda:v.read_plan(p),'invalid local media')
        with patch.dict(os.environ,{},clear=True):
            rejected(lambda:audio.generate('tts','Hello',d/'voice.mp3',voice='exampleVoice'),'not configured')
        reply=json.dumps({'audio_base64':base64.b64encode(b'fixture-audio').decode(),
                          'alignment':{'characters':['H']},'normalized_alignment':None}).encode()
        with patch.dict(os.environ,{'ELEVENLABS_API_KEY':'offline-placeholder'}), patch.object(audio,'request',return_value=reply) as api:
            response=audio.generate('tts','Hello',d/'voice.mp3',voice='exampleVoice')
            assert Path(response['audio']).read_bytes()==b'fixture-audio'
            assert api.call_args.args[0]=='text-to-speech/exampleVoice/with-timestamps'
            rejected(lambda:audio.generate('tts','Hello',d/'voice.mp3',voice='exampleVoice'),'output exists')
        with patch.dict(os.environ,{'ELEVENLABS_API_KEY':'offline-placeholder'}), patch.object(audio,'request',return_value=b'fixture-effect') as api:
            audio.generate('sfx','Gentle click',d/'click.mp3',seconds=1)
            assert api.call_args.args[0]=='sound-generation'
    print(json.dumps({'status':'passed','checks':['source trim + 1.5x paired audio','cover and contain image/video',
        'fixed fps/canvas/duration + full decode','nonempty retained audio','contact sheet and candidate analysis',
        'SRT exact times','unsupported styling rejection','bounds/reference/gap/path rejection',
        'missing-key guard','offline TTS alignment + SFX + reuse guard'],'paid_provider_calls':0},indent=2))


if __name__=='__main__': main()
