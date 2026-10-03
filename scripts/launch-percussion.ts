/** Original synthesized percussion and transition sound design; no sampled recordings. */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash } from '../worker/media';

export async function writeExtremePercussion(workspace:string,id:string,duration:number) {
  const rate=48000, size=Math.round(duration*rate), left=new Float64Array(size),right=new Float64Array(size);
  let seed=id==='linear'?117:id==='tally'?439:773;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  const events:{time:number;kind:string}[]=[];
  function hit(time:number,length:number,kind:string,level:number,pan=0){
    events.push({time,kind}); const start=Math.round(time*rate),count=Math.round(length*rate);
    let phase=0,previous=0;
    for(let n=0;n<count;n++){
      const at=start+n;if(at<0||at>=size)continue;
      const t=n/rate,p=n/count,random=noise(), high=random-previous;previous=random;
      let sample=0;
      if(kind==='kick'){
        phase+=Math.PI*2*(48+142*Math.exp(-t*44))/rate;
        sample=Math.tanh(Math.sin(phase)*2.1)*Math.exp(-t*13)+high*.2*Math.exp(-t*180);
      }else if(kind==='snare')sample=(high*.48+Math.sin(t*Math.PI*2*185)*.45)*Math.exp(-t*24);
      else if(kind==='hat')sample=high*.43*Math.exp(-t*90);
      else if(kind==='impact')sample=(Math.sin(t*Math.PI*2*(42+22*Math.exp(-t*9)))*.6+high*.23)*Math.exp(-t*7);
      else if(kind==='zip'){
        phase+=Math.PI*2*(id==='tally'?900-650*p:2200-1700*p)/rate;
        sample=(Math.sin(phase)*.35+high*.25)*Math.sin(Math.PI*p)*Math.exp(-p*3);
      }else sample=high*.35*Math.pow(Math.sin(Math.PI*p),2);
      // Short onset taper avoids unwanted digital discontinuities; intentional clicks are hats.
      sample*=Math.min(1,n/80)*Math.min(1,(count-n)/180)*level;
      left[at]+=sample*Math.sqrt((1-pan)/2);right[at]+=sample*Math.sqrt((1+pan)/2);
    }
  }
  const beat=60/160;
  for(let b=0;b<duration/beat;b++){
    const t=b*beat;
    hit(t,.3,'kick',b%4===0?.7:.4);
    if(b%2===1)hit(t,.19,'snare',.48);
    hit(t+beat/2,.06,'hat',.27,b%2?.45:-.45);
    if(b%8>=6)hit(t+beat*.75,.045,'hat',.18,-.3);
    if(b%4===2)hit(t+beat*.75,.14,'zip',.2,b%8===2?-.55:.55);
  }
  const cutFrames=id==='linear'?[0,68,158,169,270,327,360,450]:id==='tally'?[0,84,160,263,307,333,418,476]:[0,68,135,225,270,338,405,484];
  const cuts=cutFrames.map(frame=>frame/30);
  for(const t of cuts){if(t>0)hit(t-.21,.21,'whoosh',.45);hit(t,.65,'impact',.64);}
  // PCM master is peak-scaled once; all generated sources and timing remain reproducible.
  let peak=0;for(let n=0;n<size;n++)peak=Math.max(peak,Math.abs(left[n]),Math.abs(right[n]));
  const gain=.88/Math.max(1,peak),wav=Buffer.alloc(44+size*4);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
  wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);
  wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(size*4,40);
  for(let n=0;n<size;n++){wav.writeInt16LE(Math.round(left[n]*gain*32767),44+n*4);wav.writeInt16LE(Math.round(right[n]*gain*32767),46+n*4);}
  const path=join(workspace,'percussion.wav');await writeFile(path,wav);
  return {path,sha256:await hash(path),bpm:160,events,originalSynthesis:true,sampledRecordings:false};
}
