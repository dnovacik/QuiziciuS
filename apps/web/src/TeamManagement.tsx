import {useEffect,useState,type FormEvent} from 'react';
import {apiGet,apiPost,apiPatch,apiDelete} from './lib/api-client';
import {useI18n} from './lib/i18n';

export type ManagedTeam={id:string;name:string;description:string|null;badge:string;badge_color:string;expected_members:number;home_pub:string|null;created_at:string};
type Player={id:string;name:string;created_at:string};
const badges=['shield','crown','bolt','star','brain','trophy'];
const colors=['purple','amber','cyan','green','pink'];
export function TeamManagement({team,token,onUpdated}:{team:ManagedTeam;token:string;onUpdated:(team:ManagedTeam)=>void}){
 const {t}=useI18n();
 const [players,setPlayers]=useState<Player[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [newPlayer,setNewPlayer]=useState('');
 const [renaming,setRenaming]=useState<string|null>(null);
 const [editedPlayer,setEditedPlayer]=useState('');
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState({name:team.name,description:team.description??'',badge:team.badge,color:team.badge_color,expectedMembers:team.expected_members,homePub:team.home_pub??''});
 useEffect(()=>{let alive=true;setLoading(true);apiGet<Player[]>(`/registered-teams/${team.id}/players`,token).then(data=>{if(alive)setPlayers(data)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:t('management.error'))}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[team.id,token]);
 async function add(e:FormEvent){e.preventDefault();if(!newPlayer.trim()||busy||players.length>=6)return;setBusy(true);setError(null);
  try{const player=await apiPost<Player>(`/registered-teams/${team.id}/players`,{name:newPlayer.trim()},token);setPlayers(p=>[...p,player]);setNewPlayer('')}catch(e){setError(e instanceof Error?e.message:t('management.error'))}finally{setBusy(false)}
 }
 async function savePlayer(e:FormEvent){e.preventDefault();if(!renaming||!editedPlayer.trim()||busy)return;setBusy(true);setError(null);
  try{const result=await apiPatch<Player>(`/registered-teams/${team.id}/players/${renaming}`,{name:editedPlayer.trim()},token);setPlayers(p=>p.map(x=>x.id===result.id?result:x));setRenaming(null)}
  catch(e){setError(e instanceof Error?e.message:t('management.error'))}finally{setBusy(false)}
 }
 async function remove(id:string){if(busy)return;setBusy(true);setError(null);
  try{await apiDelete(`/registered-teams/${team.id}/players/${id}`,token);setPlayers(p=>p.filter(x=>x.id!==id))}
  catch(e){setError(e instanceof Error?e.message:t('management.error'))}finally{setBusy(false)}
 }
 async function saveTeam(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError(null);
  try{const result=await apiPatch<ManagedTeam>(`/registered-teams/${team.id}`,draft,token);onUpdated(result);setEditing(false)}
  catch(e){setError(e instanceof Error?e.message:t('management.error'))}finally{setBusy(false)}
 }
 return <div data-testid="team-management" className="space-y-6">
 <section className="hub-card p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{t('management.players')}</h2><p data-testid="roster-count" className="mt-1 text-xs text-slate-400">{players.length} / 6</p></div><button data-testid="team-edit-open" className="hub-outline px-4 py-2 text-sm" onClick={()=>{setDraft({name:team.name,description:team.description??'',badge:team.badge,color:team.badge_color,expectedMembers:team.expected_members,homePub:team.home_pub??''});setEditing(v=>!v)}}>{t('management.editTeam')}</button></div>
 {loading?<p data-testid="roster-loading">{t('hub.loading')}</p>:<div data-testid="roster-list" className="space-y-2">{players.map(player=><div key={player.id} data-testid="roster-player" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#11131a] p-3">{renaming===player.id?<form data-testid="roster-rename-form" onSubmit={savePlayer} className="flex flex-1 gap-2"><input data-testid="roster-rename-input" className="hub-input" maxLength={60} required value={editedPlayer} onChange={e=>setEditedPlayer(e.target.value)}/><button disabled={busy} className="hub-primary px-3" type="submit">{t('management.save')}</button><button type="button" onClick={()=>setRenaming(null)} className="hub-outline px-3">{t('management.cancel')}</button></form>:<><span className="font-medium">{player.name}</span><div className="flex gap-2"><button data-testid={`roster-edit-${player.id}`} disabled={busy} className="hub-outline px-3 py-2 text-xs" onClick={()=>{setRenaming(player.id);setEditedPlayer(player.name)}}>{t('management.rename')}</button><button data-testid={`roster-remove-${player.id}`} disabled={busy} className="hub-outline px-3 py-2 text-xs text-rose-300" onClick={()=>void remove(player.id)}>{t('management.remove')}</button></div></>}</div>)}{players.length===0&&<p data-testid="roster-empty" className="text-sm text-slate-400">{t('management.empty')}</p>}</div>}
 <form data-testid="roster-add-form" onSubmit={add} className="mt-5 flex flex-wrap gap-2"><input data-testid="roster-new-name" className="hub-input min-w-40 flex-1" value={newPlayer} maxLength={60} disabled={busy||players.length>=6} onChange={e=>setNewPlayer(e.target.value)} placeholder={t('management.playerPlaceholder')} required/><button data-testid="roster-add-submit" disabled={busy||players.length>=6||!newPlayer.trim()} type="submit" className="hub-primary px-5 disabled:opacity-50">{t('management.add')}</button></form>
 </section>
 {editing&&<section data-testid="team-edit-panel" className="hub-card p-6"><h2 className="mb-5 text-xl font-bold">{t('management.editTeam')}</h2><form data-testid="team-edit-form" onSubmit={saveTeam} className="space-y-4">
 <label className="block text-sm">{t('hub.teamName')}<input data-testid="team-edit-name" className="hub-input mt-2" value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} required minLength={3} maxLength={30}/></label>
 <label className="block text-sm">{t('hub.description')}<textarea data-testid="team-edit-description" className="hub-input mt-2" value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))} maxLength={160}/></label>
 <label className="block text-sm">{t('hub.badgeHeading')}<select data-testid="team-edit-badge" className="hub-input mt-2" value={draft.badge} onChange={e=>setDraft(v=>({...v,badge:e.target.value}))}>{badges.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
 <label className="block text-sm">{t('management.color')}<select data-testid="team-edit-color" className="hub-input mt-2" value={draft.color} onChange={e=>setDraft(v=>({...v,color:e.target.value}))}>{colors.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
 <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{t('hub.memberCount')}<select data-testid="team-edit-count" className="hub-input mt-2" value={draft.expectedMembers} onChange={e=>setDraft(v=>({...v,expectedMembers:Number(e.target.value)}))}>{[2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label><label className="block text-sm">{t('hub.homePub')}<input data-testid="team-edit-pub" className="hub-input mt-2" maxLength={100} value={draft.homePub} onChange={e=>setDraft(v=>({...v,homePub:e.target.value}))}/></label></div>
 <div className="flex gap-3"><button data-testid="team-edit-save" className="hub-primary px-6 py-3 disabled:opacity-50" disabled={busy} type="submit">{t('management.save')}</button><button className="hub-outline px-6" type="button" onClick={()=>setEditing(false)}>{t('management.cancel')}</button></div></form></section>}
 {error&&<p role="alert" data-testid="team-management-error" className="text-sm text-rose-300">{error}</p>}
 </div>;
}