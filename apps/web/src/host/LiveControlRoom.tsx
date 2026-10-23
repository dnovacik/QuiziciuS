import {useEffect,useRef,useState} from 'react';
import type {QuizSessionStateDto,QuizState} from '@quizicius/shared-types';
import {apiGet,apiPost,ApiError} from '../lib/api-client';
import {useSessionState} from '../lib/use-session-state';
import {useI18n} from '../lib/i18n';
import {DisputeQueue} from './DisputeQueue';
import {PaperModeGrid} from './PaperModeGrid';
import './live-control-room.css';
type Question={id:string;prompt:string;order_index:number;type:string;points:number};
type Info={id:string;quiz_id:string;host_id:string;status:QuizState;join_code:string};
type QuizSummary={id:string;title:string;category_id:string|null};
const next:Record<QuizState,QuizState[]>={LOBBY:['LOCK_IN_ROUND','FINISHED'],LOCK_IN_ROUND:['QUESTION_ACTIVE','FINISHED'],QUESTION_ACTIVE:['QUESTION_REVEAL','FINISHED'],QUESTION_REVEAL:['LOCK_IN_ROUND','PAUSE_BREAK','FINISHED'],PAUSE_BREAK:['LOCK_IN_ROUND','FINISHED'],FINISHED:[]};
const symbol=(name:string)=><span aria-hidden="true" className="material-symbols-outlined">{name}</span>;
export function LiveControlRoom({sessionId,token,onLeave}:{sessionId:string;token:string;onLeave:()=>void}){
 const {t}=useI18n();
 const {state,error:stateError,refetch}=useSessionState(sessionId);
 const [info,setInfo]=useState<Info|null>(null);
 const [questions,setQuestions]=useState<Question[]>([]);
 const [quiz,setQuiz]=useState<QuizSummary|null>(null);
 const [selected,setSelected]=useState('');
 const [error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [tab,setTab]=useState<'control'|'review'|'paper'>('control');
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{let alive=true;apiGet<Info>(`/host/sessions/${sessionId}`,token).then(row=>{if(alive)setInfo(row)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:t('live.error'))});return()=>{alive=false}},[sessionId,token]);
 useEffect(()=>{if(!info)return;let active=true;apiGet<QuizSummary[]>('/quizzes',token).then(rows=>{if(active)setQuiz(rows.find(row=>row.id===info.quiz_id)??null)}).catch(()=>{if(active)setQuiz(null)});return()=>{active=false}},[info?.quiz_id,token]);
 useEffect(()=>{if(!info)return;let alive=true;apiGet<Question[]>(`/quizzes/${info.quiz_id}/questions`,token).then(q=>{if(alive){setQuestions(q);setSelected(v=>v||q[0]?.id||'')}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:t('live.error'))});return()=>{alive=false}},[info?.quiz_id,token]);
 useEffect(()=>{const timer=setInterval(()=>refetch(),15000);return()=>clearInterval(timer)},[refetch]);
 // Questions already played in this session, kept per browser so a reload does not forget them.
 const playedKey=`quizicius:played:${sessionId}`;
 const [played,setPlayed]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem(playedKey)??'[]') as string[]}catch{return []}});
 const currentId=state?.currentQuestion?.id;
 const roundClosed=state?.status==='QUESTION_REVEAL'||state?.status==='PAUSE_BREAK';
 useEffect(()=>{
   if(!currentId||!state||state.status==='LOBBY'||state.status==='LOCK_IN_ROUND')return;
   setPlayed(list=>{if(list.includes(currentId))return list;const next=[...list,currentId];try{localStorage.setItem(playedKey,JSON.stringify(next))}catch{/* best effort */}return next});
 },[currentId,state?.status,playedKey]);
 // Once a question closes, preselect the next unplayed one so "start next" never repeats it.
 const advancedFor=useRef<string|null>(null);
 useEffect(()=>{
   if(!roundClosed||!currentId||!questions.length||advancedFor.current===currentId)return;
   advancedFor.current=currentId;
   const ordered=[...questions].sort((a,b)=>a.order_index-b.order_index);
   const from=ordered.findIndex(q=>q.id===currentId);
   const next=[...ordered.slice(from+1),...ordered.slice(0,Math.max(from,0))].find(q=>q.id!==currentId&&!played.includes(q.id));
   if(next)setSelected(next.id);
 },[roundClosed,currentId,questions,played]);
 async function transition(status:QuizState){
   if(busy||!state)return;
   if(status==='FINISHED'&&!window.confirm(t('live.confirmFinish')))return;
   if(status==='LOCK_IN_ROUND'&&!selected)return;
   setBusy(true);setError(null);
   try{await apiPost(`/sessions/${sessionId}/transition`,status==='LOCK_IN_ROUND'?{status,questionId:selected}:{status},token);refetch()}
   catch(e){if(e instanceof ApiError&&e.status===409)refetch();setError(e instanceof Error?e.message:t('live.error'))}
   finally{setBusy(false)}
 }
 const joinUrl=typeof window!=='undefined'?new URL(`/play/${sessionId}`,window.location.origin).href:`/play/${sessionId}`;
 const countdown=state?.questionEndsAt?Math.max(0,Math.ceil((Date.parse(state.questionEndsAt)-now)/1000)):null;
 const teams=[...(state?.teams??[])].sort((a,b)=>b.score-a.score);
 const currentIdx=questions.findIndex(q=>q.id===state?.currentQuestion?.id);
 const nextQuestion=questions[currentIdx+1];
 const active=(state?.teams??[]).filter(x=>x.isActive).length;
 return <div className="lc" data-testid="live-control-room">
 <header className="lc-header"><div className="flex flex-wrap items-center gap-4"><button className="lc-outline" data-testid="live-back" onClick={onLeave}>{symbol('arrow_back')}{t('live.back')}</button><div><div className="text-xs font-bold uppercase tracking-[.18em] text-[#ffb95f]">{t('live.title')}</div><h1 className="text-2xl font-extrabold">{t('live.controlRoom')}</h1></div></div><div className="flex flex-wrap items-center gap-3"><span className="lc-state" data-testid="live-status">{state?.status??'…'}</span><a className="lc-outline" href={`/projector/${sessionId}`} target="_blank" rel="noreferrer" data-testid="live-projector">{symbol('present_to_all')}{t('live.projector')}</a></div></header>
 {error&&<p role="alert" data-testid="live-error" className="lc-error">{error}</p>}{stateError&&<p role="alert" className="lc-error">{stateError}</p>}
 {!state||!info?<div className="lc-panel p-12 text-center" data-testid="live-loading">{t('live.loading')}</div>:<>
 <div className="lc-statusbar"><span>{symbol('sensors')} {t('live.session')}: <b>{state.joinCode}</b></span><span>{symbol('groups')} {active}/{state.teams.length} {t('live.teams')}</span><span>{symbol('quiz')} {Math.max(0,currentIdx)+1}/{questions.length}</span><span>{symbol('timer')} {countdown===null?'—':`${Math.floor(countdown/60)}:${String(countdown%60).padStart(2,'0')}`}</span><button className="text-[#d0bcff]" onClick={refetch} data-testid="live-refresh">{symbol('sync')}{t('live.refresh')}</button></div>
 {state.status==='LOBBY'?<div className="lc-lobby"><section className="lc-panel p-8"><div className="text-xs font-bold uppercase tracking-[.2em] text-[#ffb95f]">{t('live.lobby')}</div><h2 className="mt-3 text-3xl font-extrabold">{t('live.joinQuiz')}</h2><p className="mt-5 text-sm text-slate-400">{t('live.joinCode')}</p><div className="lc-code" data-testid="live-join-code">{state.joinCode}</div><div className="mt-6 flex flex-wrap gap-3"><button className="lc-primary" data-testid="live-copy-link" onClick={()=>navigator.clipboard?.writeText(joinUrl)}>{symbol('content_copy')}{t('live.copyLink')}</button><a className="lc-outline" href={joinUrl} target="_blank" rel="noreferrer">{symbol('open_in_new')}{t('live.joinPage')}</a></div><p className="mt-4 break-all text-xs text-slate-400">{joinUrl}</p><p className="mt-2 text-xs text-slate-400">{t('live.qrPending')}</p></section><section className="lc-lobby-right">
 <div className="lc-panel p-8" data-testid="live-quiz-details">
  <div className="flex items-center justify-between gap-3"><div className="text-xs font-bold uppercase tracking-[.18em] text-[#ffb95f]">{t('live.quizDetails')}</div><span className="lc-state">{state.status}</span></div>
  <h2 className="mt-4 text-2xl font-extrabold" data-testid="live-quiz-title">{quiz?.title??t('live.quizUnavailable')}</h2>
  <div className="lc-details-grid mt-5">
   <div className="lc-detail"><span>{t('live.questions')}</span><strong data-testid="live-quiz-question-count">{questions.length}</strong></div>
   <div className="lc-detail"><span>{t('live.totalPoints')}</span><strong data-testid="live-quiz-total-points">{questions.reduce((sum,q)=>sum+q.points,0)}</strong></div>
   <div className="lc-detail"><span>{t('live.connectedTeams')}</span><strong data-testid="live-team-count">{active}/{teams.length}</strong></div>
  </div>
  <button className="lc-primary mt-6 w-full" data-testid="live-start" disabled={busy||!questions.length} onClick={()=>void transition('LOCK_IN_ROUND')}>{symbol('play_arrow')}{t('live.start')}</button>
  {!questions.length&&<p className="mt-3 text-xs text-amber-300">{t('live.noQuestions')}</p>}
 </div>
 <div className="lc-panel p-8" data-testid="live-connected-teams">
  <h2 className="text-xl font-bold">{t('live.connectedTeams')} <span className="text-[#d0bcff]">{active}</span></h2>
  <div className="mt-6 space-y-3">{teams.map(team=><div key={team.id} data-testid={`live-team-${team.id}`} className="lc-team"><span className={team.isActive?'lc-dot':'lc-dot opacity-20'}></span><span>{team.name}</span><span className="ml-auto text-xs text-slate-400">{team.isActive?t('live.online'):t('live.offline')}</span></div>)}{teams.length===0&&<p className="py-10 text-center text-slate-400">{t('live.waiting')}</p>}</div>
 </div>
</section></div>:
 <div className="lc-layout"><aside className="lc-panel p-5"><h2 className="mb-4 font-bold">{t('live.questions')}</h2>{questions.map((q,i)=><button type="button" key={q.id} data-testid={`live-question-${q.id}`} onClick={()=>setSelected(q.id)} disabled={state.status==='QUESTION_ACTIVE'} data-played={played.includes(q.id)||undefined} className={`lc-question ${selected===q.id?'lc-question-active':''} ${played.includes(q.id)&&selected!==q.id?'opacity-50':''}`}><span className="font-bold text-[#ffb95f]">{String(i+1).padStart(2,'0')}</span><span className="truncate">{q.prompt}</span>{played.includes(q.id)&&<span className="ml-auto shrink-0 text-xs text-emerald-300">✓ {t('live.played')}</span>}</button>)}</aside><section className="lc-panel p-6"><div className="mb-5 flex flex-wrap gap-2">{(['control','review','paper'] as const).map(value=><button data-testid={`live-tab-${value}`} key={value} className={tab===value?'lc-primary':'lc-outline'} onClick={()=>setTab(value)}>{t('live.tab.'+value as Parameters<typeof t>[0])}</button>)}</div>{tab==='control'?<><p className="text-xs font-bold uppercase tracking-widest text-[#ffb95f]">{state.status}</p><h2 className="mt-4 text-2xl font-extrabold">{state.currentQuestion?.prompt??questions.find(q=>q.id===selected)?.prompt??t('live.selectQuestion')}</h2><div className="mt-5 text-sm text-slate-400">{state.currentQuestion?.points??'—'} {t('live.points')}</div>{countdown!==null&&<div className="my-8 text-center text-6xl font-extrabold text-[#d0bcff]" data-testid="live-timer">{Math.floor(countdown/60)}:{String(countdown%60).padStart(2,'0')}</div>}{state.status==='QUESTION_REVEAL'&&state.currentQuestion&&<div className="mt-6 rounded-xl bg-[#0c0e15] p-4"><div className="mb-3 text-xs font-bold text-emerald-300">{t('live.answer')}</div>{state.currentQuestion.type==='MULTIPLE_CHOICE'?state.currentQuestion.options?.find(o=>o.id===state.currentQuestion?.correctOptionId)?.label:state.currentQuestion.type==='FREE_TEXT'?state.currentQuestion.acceptedAnswers?.join(', '):state.currentQuestion.correctNumeric}</div>}
 <div className="mt-8 flex flex-wrap gap-3">{next[state.status].filter(v=>v!=='FINISHED').map(v=><button key={v} data-testid={`live-transition-${v}`} disabled={busy||(v==='LOCK_IN_ROUND'&&!selected)} className="lc-primary" onClick={()=>void transition(v)}>{symbol('arrow_forward')}{t('live.state.'+v as Parameters<typeof t>[0])}</button>)}{state.status==='QUESTION_REVEAL'&&nextQuestion&&<button className="lc-outline" data-testid="live-pick-next" onClick={()=>setSelected(nextQuestion.id)}>{symbol('skip_next')}{t('live.nextQuestion')}</button>}</div>{state.status==='FINISHED'&&<p className="mt-6 text-emerald-300">{t('live.finished')}</p>}{state.status!=='FINISHED'&&<button data-testid="live-finish" disabled={busy} className="mt-8 text-sm text-rose-300" onClick={()=>void transition('FINISHED')}>{t('live.finish')}</button>}</>:tab==='review'?<DisputeQueue sessionId={sessionId} token={token}/>:<PaperModeGrid sessionId={sessionId} token={token}/>}</section><aside className="lc-panel p-5"><h2 className="mb-4 text-xl font-bold">{t('live.leaderboard')}</h2>{teams.map((team,i)=><div key={team.id} className="lc-leader"><span className="w-6 text-[#ffb95f]">{i+1}</span><span className="min-w-0 flex-1 truncate">{team.name}</span><b>{team.score} {t('live.points')}</b></div>)}{!teams.length&&<p className="text-sm text-slate-400">{t('live.waiting')}</p>}</aside></div>}
 </>}
 </div>;
}
