import type { Asset,Plan } from "./types";

type Region={x:number;y:number;width:number;height:number};
export function logoDimensions(asset:Pick<Asset,"width"|"height">,canvasWidth:number){
 if(!Number.isFinite(asset.width)||!Number.isFinite(asset.height)||asset.width<=0||asset.height<=0)throw new Error("Observed logo dimensions must be positive");
 const scale=Math.min(2,Math.min(420,canvasWidth*.45)/asset.width,150/asset.height);
 return{width:asset.width*scale,height:asset.height*scale};
}
/** Logos can be wordmarks, not only square icons. Match the bounded source aspect exactly. */
export function logoGeometryMatches(asset:Pick<Asset,"width"|"height">,canvasWidth:number,actual:{width:number;height:number}){
 const expected=logoDimensions(asset,canvasWidth);
 return actual.width>=48&&actual.height>=16&&Math.abs(actual.width-expected.width)<=1&&Math.abs(actual.height-expected.height)<=1;
}
const rgb=(value:string)=>{if(!/^#[a-fA-F0-9]{6}$/.test(value))throw new Error("Brand colors must be six-digit hex values");return [1,3,5].map(start=>Number.parseInt(value.slice(start,start+2),16));};
const mix=(a:string,b:string,weight:number)=>"#"+rgb(a).map((value,index)=>Math.round(value*(1-weight)+rgb(b)[index]*weight).toString(16).padStart(2,"0")).join("");
const luminance=(value:string)=>rgb(value).map(x=>{const s=x/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
const contrast=(a:string,b:string)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

/** Adapt observed colors to each deliberate light/dark stage, never execute CSS input. */
export function motionPalette(plan:Pick<Plan,"brand"|"accent">,theme:"light"|"dark"){
 const brand=plan.brand,accent=brand?.accent||plan.accent;rgb(accent);
 let background=brand?.background||(theme==="dark"?"#0b0b0c":"#f8f9fb"),foreground=brand?.foreground||(theme==="dark"?"#fafafa":"#111214");rgb(background);rgb(foreground);
 if(brand&&(luminance(background)<.35)!==(theme==="dark"))[background,foreground]=[foreground,background];
 // An observed muted label color is not permission to export unreadable headings.
 if(contrast(background,foreground)<4.5)foreground=contrast(background,"#ffffff")>=contrast(background,"#111111")?"#ffffff":"#111111";
 return{background,foreground,accent,muted:mix(foreground,background,.32),surface:mix(background,foreground,.055),line:mix(background,foreground,.14),accentText:contrast(accent,"#ffffff")>=contrast(accent,"#111111")?"#ffffff":"#111111"};
}

/** Complete source first, then a source-bound crop that fully contains the selected region. */
export function focusCamera(asset:Pick<Asset,"width"|"height"|"kind">,viewport:{width:number;height:number},region:Region){
 if(asset.kind!=="image"||asset.width<=0||asset.height<=0)throw new Error("Camera focus requires a real still image");
 if(Object.values(region).some(v=>!Number.isFinite(v))||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>1.000001||region.y+region.height>1.000001)throw new Error("Focus crop is outside its source");
 const fromScale=Math.min(viewport.width/asset.width,viewport.height/asset.height),toScale=Math.min(viewport.width/(region.width*asset.width),viewport.height/(region.height*asset.height),fromScale*3);
 const from={width:asset.width*fromScale,height:asset.height*fromScale,left:(viewport.width-asset.width*fromScale)/2,top:(viewport.height-asset.height*fromScale)/2};
 const to={width:asset.width*toScale,height:asset.height*toScale,left:(viewport.width-region.width*asset.width*toScale)/2-region.x*asset.width*toScale,top:(viewport.height-region.height*asset.height*toScale)/2-region.y*asset.height*toScale};
 return{from,to,region};
}
