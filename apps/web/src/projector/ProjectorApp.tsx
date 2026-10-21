import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {useSessionState} from '../lib/use-session-state';
import {apiGet} from '../lib/api-client';
import {useCurrentQuestionMedia} from '../lib/use-current-question-media';
import {I18nProvider,useI18n} from '../lib/i18n';
import {CountdownRing} from './CountdownRing';
import {Scoreboard} from './Scoreboard';
import './stitch-projector.css';
const symbol=(name:string)=><span aria-hidden="true" className="material-symbols-outlined">{name}</span>;
function Stage(){
 const {sessionId}=useParams<{sessionId:string}>();
 const {state,error,refetch}=useSessionState(sessionId);
 const {t,locale,setLocale}=useI18n();
 const [title,setTitle]=useState('');
 useEffect(()=>{if(!sessionId)return;let active=true;apiGet<{title:string}>(`/sessions/${sessionId}/display`).then(data=>{if(active)setTitle(data.title)}).catch(()=>{});return()=>{active=false}},[sessionId]);
 useEffect(()=>{const id=setInterval(()=>refetch(),15000);return()=>clearInterval(id)},[refetch]);
 const teams=[...(state?.teams??[])].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
 const active=teams.filter(team=>team.isActive).length;
 const q=state?.currentQuestion;
 const {media,error:mediaError}=useCurrentQuestionMedia(sessionId,q?.id,state?.status);
 const isReveal=state?.status==='QUESTION_REVEAL';
 const correct=q?.type==='MULTIPLE_CHOICE'?q.options?.find(o=>o.id===q.correctOptionId)?.label:q?.type==='FREE_TEXT'?q.acceptedAnswers?.join(', '):q?.correctNumeric?.toString();
 const joinUrl=typeof window!=='undefined'?new URL(`/play/${sessionId??''}`,window.location.origin).href:'';
 return <div data-testid="projector-app" className="pr-screen">
 <header className="pr-header"><div className="pr-brand">ϟ QuiziciuS</div><div className="pr-pill">{t('projector.room')} <strong>#{state?.joinCode??'—'}</strong></div><div className="pr-top-right"><span className="pr-pill">{title||t('projector.event')}</span><button data-testid="projector-language" onClick={()=>setLocale(locale==='sk'?'en':'sk')} className="pr-lang">{locale.toUpperCase()}</button></div></header>
 {error&&<div role="alert" data-testid="projector-error" className="pr-alert">{error}</div>}
 {!state?<main className="pr-middle" data-testid="projector-loading"><div className="pr-hero-icon">{symbol('hourglass_top')}</div><h1>{t('projector.loading')}</h1></main>:<>
 <div className="pr-heading"><div className="pr-eyebrow">{symbol('trophy')} {t('projector.pubQuiz')}</div><h1>{title||t('projector.event')}</h1></div>
 {state.status==='LOBBY'&&<main className="pr-lobby" data-testid="projector-lobby"><section className="pr-card pr-join"><p className="pr-eyebrow">{t('projector.howToJoin')}</p><h2>{t('projector.scanOrVisit')}</h2><div className="pr-qr-fallback" data-testid="projector-join-link"><span className="pr-hero-icon">{symbol('phone_iphone')}</span><p>{joinUrl}</p></div><div className="pr-join-code"><span>{t('projector.roomCode')}</span><strong data-testid="projector-join-code">#{state.joinCode}</strong></div></section><section className="pr-card pr-teams"><div className="pr-panel-head"><h2>{symbol('groups')} {t('projector.teamsInRoom')}</h2><span>{active} {t('projector.connected')}</span></div><div className="pr-team-grid">{teams.map(team=><div className="pr-team" key={team.id}><span className={team.isActive?'pr-dot':'pr-dot pr-offline'}/><span>{team.name}</span></div>)}{!teams.length&&<p className="pr-muted">{t('projector.waitingTeams')}</p>}</div><footer className="pr-wait">{symbol('sync')} {t('projector.waitingHost')}</footer></section></main>}
 {state.status==='LOCK_IN_ROUND'&&<main className="pr-middle" data-testid="projector-lock-in"><div className="pr-hero-icon">{symbol('bolt')}</div><div className="pr-eyebrow">{t('projector.nextQuestion')}</div><h2>{t('projector.getReady')}</h2><p className="pr-muted">{t('projector.lockIn')}</p></main>}
 {(state.status==='QUESTION_ACTIVE'||isReveal)&&q&&<main className="pr-question" data-testid={isReveal?'projector-reveal':'projector-question'}><div className="pr-question-meta"><span>{t('projector.question')} {q.orderIndex+1}</span><span>{q.points} {t('projector.points')}</span></div><h2>{q.prompt}</h2>{media?.mediaType==='image'&&media.url&&<img data-testid="projector-question-image" src={media.url} alt={t('projector.questionImage')} className="pr-question-media" />}{media?.mediaType==='video'&&media.url&&<video key={q.id} data-testid="projector-question-video" className="pr-question-media" src={media.url} autoPlay controls playsInline preload="metadata" />}{mediaError&&<p role="alert" className="pr-alert">{t('projector.mediaUnavailable')}</p>}{state.status==='QUESTION_ACTIVE'&&state.questionEndsAt&&<div className="pr-clock" data-testid="projector-timer"><CountdownRing endsAt={state.questionEndsAt} totalSeconds={q.timeLimitSeconds}/></div>}{q.type==='MULTIPLE_CHOICE'&&<div className="pr-options">{q.options?.map((o,i)=><div data-testid={`projector-option-${o.id}`} className={isReveal?(o.id===q.correctOptionId?'pr-option pr-correct':'pr-option pr-muted-option'):'pr-option'} key={o.id}><strong>{String.fromCharCode(65+i)}</strong><span>{o.label}</span></div>)}</div>}{q.type!=='MULTIPLE_CHOICE'&&!isReveal&&<p className="pr-instruction">{q.type==='FREE_TEXT'?t('projector.enterText'):t('projector.enterNumber')}</p>}{isReveal&&<div className="pr-answer" data-testid="reveal-banner"><div className="pr-eyebrow">{t('projector.correctAnswer')}</div><strong data-testid="projector-correct-answer">{correct||'—'}</strong></div>}</main>}
 {state.status==='PAUSE_BREAK'&&<main className="pr-middle" data-testid="projector-break"><div className="pr-hero-icon">{symbol('coffee')}</div><h2>{t('projector.break')}</h2><p className="pr-muted">{t('projector.backSoon')}</p><div className="pr-standings"><Scoreboard teams={state.teams}/></div></main>}
 {state.status==='FINISHED'&&<main className="pr-finished" data-testid="projector-finished"><div className="pr-eyebrow">{t('projector.finished')}</div><h2>{t('projector.winner')}</h2>{teams[0]&&<div className="pr-champion">{symbol('emoji_events')} {teams[0].name}<span>{teams[0].score} {t('projector.points')}</span></div>}<div className="pr-standings"><Scoreboard teams={state.teams}/></div></main>}
 {state.status==='QUESTION_ACTIVE'&&!q&&<main className="pr-middle" data-testid="projector-missing-question">{t('projector.noQuestion')}</main>}
 </>}
 <footer className="pr-footer"><span>QuiziciuS · PUB ENGINE</span><span>{state?.status??'…'}</span></footer>
 </div>;
}
export default function ProjectorApp(){return <I18nProvider><Stage/></I18nProvider>}
