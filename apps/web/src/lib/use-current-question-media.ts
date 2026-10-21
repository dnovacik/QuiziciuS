import {useEffect,useState} from 'react';
import {apiGet} from './api-client';
type Media={mediaType:'image'|'video'|null;url:string|null};
export function useCurrentQuestionMedia(sessionId:string|undefined,questionId:string|undefined,status:string|undefined){
 const [media,setMedia]=useState<Media|null>(null);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  if(!sessionId||!questionId||!['QUESTION_ACTIVE','QUESTION_REVEAL'].includes(status??'')){setMedia(null);setError(null);return;}
  let active=true;setMedia(null);setError(null);
  apiGet<Media>(`/sessions/${sessionId}/media`).then(row=>{if(active)setMedia(row)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Media unavailable')});
  return()=>{active=false};
 },[sessionId,questionId,status]);
 return {media,error};
}
