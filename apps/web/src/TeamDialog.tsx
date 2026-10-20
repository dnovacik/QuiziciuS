import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from './lib/api-client';
import { supabase } from './lib/supabase-client';
import { useI18n } from './lib/i18n';

type Tab = 'quick' | 'register' | 'login';
type IconName = 'close' | 'users' | 'bolt' | 'plusUser' | 'mail' | 'lock' | 'table' | 'arrow';
const paths: Record<IconName, string> = {
  close: 'M6 18L18 6M6 6l12 12',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  plusUser: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  table: 'M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z',
  arrow: 'M14 5l7 7m0 0l-7 7m7-7H3',
};
function StitchIcon({name,className='w-4 h-4'}:{name:IconName;className?:string}){
 return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>;
}
interface BarcodeResult { rawValue:string }
interface QrDetector { detect(source: ImageBitmap): Promise<BarcodeResult[]> }
type QrDetectorClass = new (options:{formats:string[]}) => QrDetector;

export function TeamDialog({onClose,onHost}:{onClose:()=>void;onHost:()=>void}) {
 const {t}=useI18n();
 const navigate=useNavigate();
 const [tab,setTab]=useState<Tab>('quick');
 const [code,setCode]=useState('');
 const [name,setName]=useState('');
 const [table,setTable]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [members,setMembers]=useState('4');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [resultCode,setResultCode]=useState<string|null>(null);
 const qrRef=useRef<HTMLInputElement>(null);
 const field='glass-input w-full rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none';
 const submit='w-full mt-2 py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50';
 const iconField=(icon:IconName)=><span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400"><StitchIcon name={icon}/></span>;
 function parseQr(raw:string){
   try { const url=new URL(raw); if(url.origin===window.location.origin && url.pathname.startsWith('/play/')) {navigate(url.pathname+url.search);onClose();return;} }catch { /* plain code */ }
   if (/^[A-Za-z0-9]{4}$/.test(raw.trim())) {setCode(raw.trim().toUpperCase());setTab('quick');setError(null);return;}
   setResultCode('TEAM_QR_INVALID');setError(t('stitch.team.qrInvalid'));
 }
 async function loadQr(event:ChangeEvent<HTMLInputElement>) {
   const file=event.target.files?.[0];event.target.value='';
   if(!file)return;
   const Detector=(window as Window & {BarcodeDetector?:QrDetectorClass}).BarcodeDetector;
   if(!Detector || typeof createImageBitmap!=='function'){setResultCode('TEAM_QR_UNSUPPORTED');setError(t('stitch.team.qrUnsupported'));return;}
   try {const image=await createImageBitmap(file);try{const values=await new Detector({formats:['qr_code']}).detect(image);if(values[0])parseQr(values[0].rawValue);else{setResultCode('TEAM_QR_INVALID');setError(t('stitch.team.qrInvalid'));}}finally{image.close();}}
   catch{setResultCode('TEAM_QR_INVALID');setError(t('stitch.team.qrInvalid'));}
 }
 async function quickJoin(e:FormEvent){e.preventDefault();if(pending)return;setPending(true);setError(null);setResultCode(null);
  try {
   const session=await apiGet<{id:string}>(`/sessions/by-code/${encodeURIComponent(code.trim().toUpperCase())}`);
   const joined=await apiPost<{teamId:string;token:string}>(`/sessions/${session.id}/teams/join`,{name:name.trim()});
   localStorage.setItem(`quizicius:team:${session.id}`,JSON.stringify({sessionId:session.id,teamId:joined.teamId,token:joined.token}));
   navigate(`/play/${session.id}`);onClose();
  }catch(err){setResultCode('TEAM_JOIN_FAILED');setError(err instanceof Error?err.message:t('stitch.auth.failed'))}finally{setPending(false)}
 }
 async function register(e:FormEvent){e.preventDefault();if(pending)return;setPending(true);setError(null);setResultCode(null);
  try {const {data,error:signupError}=await supabase.auth.signUp({email,password,options:{data:{team_name:name.trim(),members_count:Number(members)}}});
   if(signupError)throw signupError;
   if(data.session){navigate('/team');onClose();return;}
   setResultCode('TEAM_EMAIL_CONFIRMATION_REQUIRED');setError(t('stitch.team.confirmEmail'));
  }catch(err){setResultCode('TEAM_REGISTER_FAILED');setError(err instanceof Error?err.message:t('stitch.auth.failed'))}finally{setPending(false)}
 }
 async function login(e:FormEvent){e.preventDefault();if(pending)return;setPending(true);setError(null);setResultCode(null);
  try{const {error:loginError}=await supabase.auth.signInWithPassword({email,password});if(loginError)throw loginError;navigate('/team');onClose();}
  catch(err){setResultCode('TEAM_LOGIN_FAILED');setError(err instanceof Error?err.message:t('stitch.auth.failed'))}finally{setPending(false)}
 }
 async function resetPassword(){if(!email||pending)return;setPending(true);setError(null);setResultCode(null);
  try{const {error:resetError}=await supabase.auth.resetPasswordForEmail(email);if(resetError)throw resetError;setResultCode('TEAM_PASSWORD_RESET_SENT');setError(t('stitch.team.resetSent'));}
  catch(err){setResultCode('TEAM_PASSWORD_RESET_FAILED');setError(err instanceof Error?err.message:t('stitch.auth.failed'))}finally{setPending(false)}
 }
 return <div data-testid="stitch-team-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
   <section role="dialog" aria-modal="true" aria-labelledby="teamModalTitle" className="stitch-card relative w-full max-w-[500px] max-h-[92vh] overflow-y-auto rounded-3xl border border-white/20 p-6 shadow-2xl sm:p-8">
     <div className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-purple-600/30 blur-3xl"/>
     <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl"/>
     <button data-testid="stitch-team-close" type="button" aria-label={t('stitch.team.close')} onClick={onClose} className="absolute right-5 top-5 rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><StitchIcon name="close" className="h-5 w-5"/></button>
     <div className="mb-6 text-center">
       <div className="stitch-team-badge mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-600/30 to-indigo-600/30"><StitchIcon name="users" className="h-7 w-7 text-purple-400"/></div>
       <h2 className="text-2xl font-extrabold text-white" id="teamModalTitle">{t('stitch.team.title')}</h2>
       <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400 sm:text-sm">{t('stitch.team.description')}</p>
     </div>
     <div className="mb-6 grid grid-cols-3 rounded-2xl border border-white/10 bg-[#06080f]/80 p-1">
       <button data-testid="team-tab-quick" type="button" onClick={()=>{setTab('quick');setError(null)}} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm ${tab==='quick'?'bg-purple-600 font-bold text-white shadow-md':'font-semibold text-slate-400 hover:text-white'}`}><StitchIcon name="bolt"/>{t('stitch.team.tabQuick')}</button>
       <button data-testid="team-tab-register" type="button" onClick={()=>{setTab('register');setError(null)}} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm ${tab==='register'?'bg-purple-600 font-bold text-white shadow-md':'font-semibold text-slate-400 hover:text-white'}`}><StitchIcon name="plusUser"/>{t('stitch.team.tabRegister')}</button>
       <button data-testid="team-tab-login" type="button" onClick={()=>{setTab('login');setError(null);setResultCode(null)}} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs sm:text-sm ${tab==='login'?'bg-purple-600 font-bold text-white shadow-md':'font-semibold text-slate-400 hover:text-white'}`}><StitchIcon name="lock"/>{t('stitch.team.tabLogin')}</button>
     </div>
     {tab==='quick' ? <form data-testid="team-quick-form" onSubmit={quickJoin} className="space-y-4">
       <label className="block text-xs font-semibold text-slate-300"><span className="mb-1.5 flex justify-between"><span>{t('stitch.team.codeLabel')}</span><span className="font-medium text-purple-400">{t('stitch.team.pinHint')}</span></span>
         <input data-testid="team-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4))} className={field+' border border-purple-500/30 bg-purple-950/20 px-4 py-3 text-center text-2xl font-black uppercase tracking-[0.3em]'} maxLength={4} minLength={4} pattern="[A-Za-z0-9]{4}" placeholder="AB12" autoCapitalize="characters" required/>
       </label>
       <input ref={qrRef} data-testid="team-qr-file" type="file" accept="image/*" capture="environment" className="hidden" onChange={loadQr}/>
       <button data-testid="team-load-qr" className="stitch-secondary flex w-full justify-center px-4 py-2.5 text-sm" type="button" onClick={()=>qrRef.current?.click()}>{t('stitch.team.loadQr')}</button>
       <label className="block text-xs font-semibold text-slate-300">{t('stitch.team.teamName')}<span className="relative mt-1.5 block">{iconField('users')}<input data-testid="team-name" value={name} onChange={e=>setName(e.target.value)} className={field+' py-2.5 pl-10 pr-4'} required placeholder={t('stitch.team.nameExample')}/></span></label>
       <label className="block text-xs font-semibold text-slate-300"><span className="flex justify-between">{t('stitch.team.tableNumber')}<span className="text-[11px] font-normal text-slate-400">{t('stitch.team.optional')}</span></span><span className="relative mt-1.5 block">{iconField('table')}<input data-testid="team-table" value={table} onChange={e=>setTable(e.target.value)} className={field+' py-2.5 pl-10 pr-4'} placeholder={t('stitch.team.tableExample')}/></span></label>
       <button data-testid="team-join-submit" disabled={pending} type="submit" className={submit}>{t('stitch.team.joinButton')}<StitchIcon name="arrow"/></button>
     </form> : tab==='register' ? <form data-testid="team-register-form" className="space-y-3.5" onSubmit={register}>
       <label className="block text-xs font-semibold text-slate-300">{t('stitch.team.teamName')}<span className="relative mt-1 block">{iconField('users')}<input data-testid="team-register-name" value={name} onChange={e=>setName(e.target.value)} className={field+' py-2 pl-10 pr-4'} placeholder={t('stitch.team.nameExample')} required/></span></label>
       <label className="block text-xs font-semibold text-slate-300">{t('stitch.team.captainEmail')}<span className="relative mt-1 block">{iconField('mail')}<input data-testid="team-register-email" value={email} onChange={e=>setEmail(e.target.value)} className={field+' py-2 pl-10 pr-4'} type="email" required/></span></label>
       <label className="block text-xs font-semibold text-slate-300">{t('stitch.team.teamPassword')}<span className="relative mt-1 block">{iconField('lock')}<input data-testid="team-register-password" value={password} onChange={e=>setPassword(e.target.value)} className={field+' py-2 pl-10 pr-4'} type="password" minLength={6} required/></span></label>
       <label className="block text-xs font-semibold text-slate-300">{t('stitch.team.membersCount')}<span className="relative mt-1 block">{iconField('users')}<select data-testid="team-register-members" value={members} onChange={e=>setMembers(e.target.value)} className={field+' cursor-pointer bg-[#0b0d17] py-2 pl-10 pr-4'}>{[2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></span></label>
       <button data-testid="team-register-submit" disabled={pending} type="submit" className={submit}>{t('stitch.team.registerButton')}<StitchIcon name="arrow"/></button>
     </form> : <form data-testid="team-login-form" className="space-y-4" onSubmit={login}>
       <label className="block text-xs font-semibold text-slate-300">{t('stitch.team.captainEmail')}<span className="relative mt-1.5 block">{iconField('mail')}<input data-testid="team-login-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} className={field+' py-2.5 pl-10 pr-4'}/></span></label>
       <label className="block text-xs font-semibold text-slate-300">{t('stitch.team.teamPassword')}<span className="relative mt-1.5 block">{iconField('lock')}<input data-testid="team-login-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className={field+' py-2.5 pl-10 pr-4'}/></span></label>
       <button data-testid="team-login-submit" disabled={pending} className={submit} type="submit">{t('stitch.team.loginButton')}<StitchIcon name="arrow"/></button>
       <button data-testid="team-forgot-password" disabled={pending||!email} onClick={()=>void resetPassword()} className="block w-full text-center text-xs text-purple-300 disabled:opacity-50" type="button">{t('stitch.team.forgotPassword')}</button>
     </form>}
     {error && <p data-testid="team-feedback" data-feedback-code={resultCode??''} role={resultCode==='TEAM_EMAIL_CONFIRMATION_REQUIRED'||resultCode==='TEAM_PASSWORD_RESET_SENT'?'status':'alert'} className="mt-4 rounded-lg border border-purple-500/30 p-3 text-xs text-slate-200">{error}</p>}
     <div className="mt-5 border-t border-white/10 pt-4 text-center"><button type="button" data-testid="team-switch-host" onClick={onHost} className="text-xs font-medium text-slate-400 hover:text-purple-300">{t('stitch.team.switchHost')} <span className="text-amber-400">→</span></button></div>
   </section>
 </div>;
}
