/** Human-directed pilot data for the production shot compiler. No custom animation code.
 * UI is an illustrative instance based on retained official editor/form/help imagery.
 * This pilot is deliberately NOT counted as automatic URL acceptance. */
import type { Evidence, Plan, Scene } from '../worker/types';
import type { UiDocument, UiAction } from '../worker/ui-reconstruction';
import { stageDigest } from '../worker/research';
import { dimensions } from '../worker/planning';
import { applyShotDirector } from '../worker/shot-director';

export const tallyPilotSources = [
  {id:'editor', path:'.local/tally-motion-sources/official-88.png', url:'https://tally.so/help/create-a-form', width:1256,height:820},
  {id:'form', path:'.local/launch-tally-sourcepack-20261003/assets/tally-contact-form.jpg',url:'https://tally.so/',width:977,height:741},
  {id:'thanks', path:'.local/launch-tally-sourcepack-20261003/assets/tally-default-thank-you.jpg',url:'https://tally.so/help/how-to-create-a-thank-you-page',width:1440,height:960},
];
const styles:UiDocument['styles']=[
  {id:'title',fill:'transparent',color:'#171717',borderColor:'transparent',fontSize:40,fontWeight:700,radius:0},
  {id:'label',fill:'transparent',color:'#171717',borderColor:'transparent',fontSize:27,fontWeight:500,radius:0},
  {id:'input',fill:'#ffffff',color:'#171717',borderColor:'#cccccc',fontSize:28,fontWeight:400,radius:5},
  {id:'button',fill:'#171717',color:'#ffffff',borderColor:'#171717',fontSize:26,fontWeight:600,radius:5},
  {id:'publish',fill:'#0075de',color:'#ffffff',borderColor:'#0075de',fontSize:23,fontWeight:600,radius:5},
  {id:'menu',fill:'#f1f1f1',color:'#171717',borderColor:'#e2e2e2',fontSize:26,fontWeight:400,radius:5},
];
type Element=UiDocument['elements'][number];
const element=(id:string,type:Element['type'],text:string,styleId:string,x:number,y:number,width:number,height:number,sourceAssetId:string,sourceRect:Element['sourceRect'],visible=true,example=false):Element=>({id,type,text,styleId,rect:{x,y,width,height},sourceAssetId,sourceRect,initiallyVisible:visible,textBasis:example?'example-content':'source-ui'});
const sourceInput={x:.22,y:.55,width:.25,height:.07}, sourceLabel={x:.22,y:.48,width:.35,height:.04};
const state=(id:string,visibleElementIds:string[],evidenceIds:string[],textValues:UiDocument['states'][number]['textValues']=[]):UiDocument['states'][number]=>({id,basis:'illustrative',visibleElementIds,selectedElementIds:[],evidenceIds,textValues});

export function tallyPilot(format:'16:9'|'4:5'|'9:16', hashes:Record<string,string>, directed=true):{plan:Plan;evidence:Evidence;research:unknown;authoredScript:unknown} {
  const evidence:Evidence={text:[
    'Tally helps freelancers collect client briefs with forms. This audience is an editorial inference from its documented form-building and contact-collection features.',
    'Tally supports a document-like editor, slash insertion of Email blocks, and Publish. https://tally.so/help/create-a-form',
    'Short answer, email and long answer input blocks collect respondent answers. https://tally.so/help/input-blocks',
    'A Thank You page is the page respondents see after submitting a form. https://tally.so/help/how-to-create-a-thank-you-page',
    'Create a free form. https://tally.so/',
  ].join('\n\n'),assets:tallyPilotSources.map(s=>({id:s.id,path:`assets/${s.id}.${s.path.split('.').at(-1)}`,kind:'image',usage:'output',rights:'Official public product imagery retained for source analysis; reconstructed illustrative pilot, not an official campaign.',width:s.width,height:s.height,source:s.url})),
  brand:{version:1,sourceUrl:'https://tally.so/',title:'Tally',headings:[],callsToAction:['Create a free form'],colors:[{value:'#ffffff',role:'background',selector:'official editor'},{value:'#171717',role:'text',selector:'official editor'},{value:'#171717',role:'accent',selector:'Submit'}],typography:[],logoAssetIds:[],limitations:['Geist is the bundled fallback. Blue is reserved for the observed Publish control.']}};
  const claim=(text:string,ids:string[])=>({text,basis:'inferred' as const,evidenceIds:ids});
  const story={primaryAudience:claim('freelancers collecting client briefs',['fact-1']),problem:claim('Client details scattered across messages',['fact-1']),mechanism:{...claim('Create a form and collect the answers',['fact-2','fact-3']),steps:[{action:'Add an email field and publish',evidenceId:'fact-2',assetId:'editor'},{action:'Complete and submit the form',evidenceId:'fact-3',assetId:'form'}]},outcome:claim('A submitted enquiry with the details together',['fact-3','fact-4']),differentiator:null,cta:{text:'Create a free form',basis:'explicit' as const,evidenceIds:['fact-5']}};
  const research={version:3,product:'Tally',summary:'Illustrative authored client enquiry workflow',story,sourceHashes:hashes,sourceUrls:tallyPilotSources.map(s=>s.url),manuallyAuthored:true};
  const editorElements:Element[]=[
    element('title','text','Project enquiry','title',.08,.12,.67,.1,'editor',{x:.22,y:.36,width:.32,height:.08},true,true),
    element('name-label','text','Your name','label',.08,.29,.75,.06,'editor',sourceLabel,true,true),
    element('name','input','','input',.08,.36,.76,.09,'editor',sourceInput),
    element('slash','input','','label',.08,.51,.76,.07,'editor',{x:.22,y:.63,width:.24,height:.04}),
    element('email-choice','list-item','Email','menu',.08,.59,.42,.075,'editor',{x:.235,y:.41,width:.218,height:.033},false),
    element('email-label','text','Your email','label',.08,.51,.75,.06,'editor',sourceLabel,false,true),
    element('email','input','','input',.08,.58,.76,.09,'editor',sourceInput,false),
    element('project-label','text','What do you need?','label',.08,.74,.75,.06,'editor',sourceLabel,true,true),
    element('project','textarea','','input',.08,.81,.76,.12,'editor',sourceInput,true),
    element('publish','button','Publish','publish',.80,.025,.16,.065,'editor',{x:.89,y:.12,width:.054,height:.035}),
  ];
  const base=editorElements.filter(e=>e.initiallyVisible).map(e=>e.id), built=editorElements.filter(e=>!['slash','email-choice'].includes(e.id)).map(e=>e.id);
  const editor:UiDocument={id:'enquiry-editor',sourceAssetIds:['editor'],capabilityFactIds:['fact-2','fact-3'],viewport:{width:1000,height:740},styles,elements:editorElements,states:[state('draft',base,['fact-2']),state('menu',[...base,'email-choice'],['fact-2'],[{elementId:'slash',text:'/email',textBasis:'example-content'}]),state('built',built,['fact-2','fact-3'])]};
  const formElements:Element[]=[
    element('title','text','Project enquiry','title',.10,.05,.80,.10,'form',{x:.11,y:.20,width:.5,height:.045},true,true),
    element('name-label','text','Your name','label',.10,.21,.78,.055,'form',{x:.11,y:.20,width:.5,height:.045},true,true),
    element('name','input','','input',.10,.28,.78,.08,'form',{x:.11,y:.25,width:.38,height:.06}),
    element('email-label','text','Your email','label',.10,.41,.78,.055,'form',{x:.51,y:.32,width:.38,height:.06},true,true),
    element('email','input','','input',.10,.48,.78,.08,'form',{x:.51,y:.32,width:.38,height:.06}),
    element('project-label','text','What do you need?','label',.10,.61,.78,.055,'form',{x:.11,y:.32,width:.38,height:.06},true,true),
    element('project','textarea','','input',.10,.68,.78,.12,'form',{x:.11,y:.32,width:.38,height:.06}),
    element('submit','button','Submit →','button',.10,.88,.30,.07,'editor',{x:.22,y:.775,width:.085,height:.05}),
    element('thank-you','text','Thanks for completing this form!','title',.10,.35,.80,.20,'thanks',{x:.45,y:.53,width:.24,height:.04},false),
  ];
  const formIds=formElements.filter(e=>e.initiallyVisible).map(e=>e.id);
  const filledValues:UiDocument['states'][number]['textValues']=[{elementId:'name',text:'Ada',textBasis:'example-content'},{elementId:'email',text:'ada@example.com',textBasis:'example-content'},{elementId:'project',text:'A new landing page',textBasis:'example-content'}];
  const respondent:UiDocument={id:'enquiry-response',sourceAssetIds:['form','editor','thanks'] as string[],capabilityFactIds:['fact-3','fact-4'],viewport:{width:1000,height:880},styles,elements:formElements,states:[state('blank',formIds,['fact-3']),state('filled',formIds,['fact-3','fact-4'],filledValues),state('submitted',['thank-you'],['fact-4'])],terminalResult:{version:1,beforeStateId:'filled',afterStateId:'submitted',confirmationElementId:'submit',resultElementIds:['thank-you'],evidenceIds:['fact-4']}};
  // Three sources in this authored fixture are explicit. The production provider
  // document transport remains capped at two; this fixture is not passed off as one.
  const editorActions:UiAction[]=[{kind:'type',targetId:'slash',text:'/email',atFrame:30,durationFrames:18,evidenceId:'fact-2'},{kind:'state',stateId:'menu',atFrame:49,durationFrames:1,evidenceId:'fact-2'},{kind:'click',targetId:'email-choice',atFrame:65,durationFrames:12,evidenceId:'fact-2'},{kind:'state',stateId:'built',atFrame:77,durationFrames:1,evidenceId:'fact-2'},{kind:'click',targetId:'publish',atFrame:140,durationFrames:12,evidenceId:'fact-2'}];
  const respondentActions:UiAction[]=[{kind:'type',targetId:'name',text:'Ada',atFrame:30,durationFrames:18,evidenceId:'fact-3'},{kind:'type',targetId:'email',text:'ada@example.com',atFrame:60,durationFrames:30,evidenceId:'fact-3'},{kind:'type',targetId:'project',text:'A new landing page',atFrame:104,durationFrames:36,evidenceId:'fact-3'},{kind:'click',targetId:'submit',atFrame:147,durationFrames:12,evidenceId:'fact-4'},{kind:'state',stateId:'submitted',atFrame:159,durationFrames:1,evidenceId:'fact-4'}];
  let at=0;
  const scene=(id:string,frames:number,role:Scene['storyRole'],asset:string,fact:string,headline:string,detail:string,presentation:NonNullable<Scene['presentation']>,job:NonNullable<Scene['direction']>['job'],motion:NonNullable<Scene['direction']>['motion']):Scene=>{const s:Scene={id,start_frame:at,duration_frames:frames,asset_id:asset,source_in_seconds:0,playback_rate:1,preserve_audio:false,fit:'contain',purpose:`Authored pilot: ${id}`,reference_technique:'Semantic subject framing and readable consequence',headline,detail,evidence:evidence.text.split("\n\n")[Number(fact.slice(5))-1],evidence_id:fact,effects:[],presentation,storyRole:role,direction:{version:2,job,motion,...(presentation.visual?.kind==='ui-demo'?{continuityKey:`ui:${presentation.visual.documentId}`}:{})}};at+=frames;return s;};
  const scenes=[
    scene('hook',90,'problem','editor','fact-1','Still taking client briefs in DMs?','',{template:'hook',theme:'light',transition:'cut',cards:[{title:'What’s your email?',body:'',evidenceId:'fact-1'},{title:'What do you need?',body:'',evidenceId:'fact-1'},{title:'One more thing…',body:'',evidenceId:'fact-1'}]},'hook','reveal'),
    scene('editor',210,'mechanism','editor','fact-2','Build it like a doc.','',{template:'proof',theme:'light',transition:'cut',visual:{kind:'ui-demo',documentId:editor.id,actions:editorActions}},'action','focus'),
    scene('response',240,'mechanism','form','fact-3','Ask once. Get the details.','',{template:'proof',theme:'light',transition:'cut',visual:{kind:'ui-demo',documentId:respondent.id,actions:respondentActions}},'action','focus'),
    scene('brief',90,'outcome','form','fact-3','The brief. In one place.','EXAMPLE BRIEF',{template:'features',theme:'light',transition:'cut',cards:[{title:'Name',body:'Ada',evidenceId:'fact-3'},{title:'Email',body:'ada@example.com',evidenceId:'fact-3'},{title:'Project',body:'A new landing page',evidenceId:'fact-3'}]},'payoff','reveal'),
    scene('cta',90,'cta','editor','fact-5','Create a free form','tally.so',{template:'cta',theme:'light',transition:'cut'},'cta','hold'),
  ];
  // Director camera tracks belong to the compiled plan. Keep the authored script
  // immutable so its saved content retains the production binding and control identity.
  const authoredScript={version:1,kind:'human-directed-pilot',scenes:structuredClone(scenes),sourceHashes:hashes,story,automaticUrlAcceptance:false};
  const production={researchSha256:stageDigest(research),evidenceSha256:stageDigest({evidence,hashes}),scriptSha256:stageDigest(authoredScript),uiSha256:''};
  const job_id=`tally-director-${format.replace(':','x')}`;
  production.uiSha256=stageDigest({version:1,jobId:job_id,evidenceSha256:production.evidenceSha256,researchSha256:production.researchSha256,documents:[editor,respondent]});
  const plan:Plan={version:1,job_id,mode:'create',renderer:'hyperframes',output:{...dimensions(format),fps:30,duration_frames:at},product:'Tally',summary:'One client enquiry, from form to submitted answers.',accent:'#171717',background:'light',brand:{sourceUrl:'https://tally.so/',background:'#ffffff',foreground:'#171717',accent:'#171717'},audienceLabel:'For freelancers',story,assets:evidence.assets,uiDocuments:[editor,respondent],scenes,captions:[],audio:[],music_prompt:'Retained owned comparison music; no provider call.',sfx_prompt:'None',assumptions:['Manually authored pilot data rendered by shared engine; not automatic URL evidence.','HTML illustrates a form, not a live submission.','The final brief is an editorial recap, not a product dashboard.'],production};
  // Construct the same bounded creative metadata used by the renderer, preserving
  // the pilot's explicit provenance rather than claiming a paid research call.
  plan.creativeDirection={version:1,product:'Tally',researchSha256:production.researchSha256,evidenceSha256:production.evidenceSha256,audience:story.primaryAudience,mechanism:{text:story.mechanism.text,basis:story.mechanism.basis,evidenceIds:story.mechanism.evidenceIds},outcome:story.outcome,cta:story.cta,workflow:story.mechanism.steps,brand:{sourceUrl:'https://tally.so/',colors:evidence.brand!.colors.map(({value,role})=>({value,role})),logoAssetIds:[]},briefSha256:stageDigest(story),concept:'focus',evidenceId:'fact-2',evidence:evidence.text.split('\n\n')[1]};
  if(directed)applyShotDirector(plan,evidence);
  return {plan,evidence,research,authoredScript};
}
