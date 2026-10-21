import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {I18nProvider} from '../lib/i18n';
import {QuizBuilder} from './QuizBuilder';
import {apiGet,apiPost,apiPatch,apiDelete} from '../lib/api-client';
const signedUpload=vi.hoisted(()=>vi.fn());
vi.mock('../lib/supabase-client',()=>({supabase:{storage:{from:()=>({uploadToSignedUrl:signedUpload})}}}));
vi.mock('../lib/api-client',()=>({apiGet:vi.fn(),apiPost:vi.fn(),apiPatch:vi.fn(),apiDelete:vi.fn()}));
const q={id:'q1',quiz_id:'quiz',type:'MULTIPLE_CHOICE',prompt:'Question',options:[{id:'a',label:'A',isCorrect:true},{id:'b',label:'B',isCorrect:false}],accepted_answers:null,correct_numeric:null,points:1,time_limit_seconds:30,order_index:0};
const setup=()=>render(<I18nProvider><QuizBuilder quizId="quiz" quizTitle="Quiz" token="token" onBack={vi.fn()}/></I18nProvider>);
beforeEach(()=>{vi.clearAllMocks();signedUpload.mockResolvedValue({error:null});vi.mocked(apiGet).mockResolvedValue([q] as never);vi.mocked(apiPost).mockResolvedValue({...q,id:'q2'} as never);vi.mocked(apiPatch).mockResolvedValue(q as never);vi.mocked(apiDelete).mockResolvedValue({deleted:true} as never)});
describe('Stitch quiz builder',()=>{
 it('uploads a host-authorized image and saves its private storage reference',async()=>{
  vi.mocked(apiPost).mockImplementation(async path=>path.includes('media/upload-url')?{path:'host/quiz/test.webp',token:'signed',mediaType:'image'} as never:q as never);
  setup();
  await screen.findByTestId('builder-select-q1');
  fireEvent.change(screen.getByTestId('builder-media-file'),{target:{files:[new File(['image'],'sample.webp',{type:'image/webp'})]}});
  await waitFor(()=>expect(signedUpload).toHaveBeenCalledWith('host/quiz/test.webp','signed',expect.any(File),{contentType:'image/webp'}));
  await waitFor(()=>expect(screen.getByTestId('builder-media-remove')).toBeInTheDocument());
  fireEvent.submit(screen.getByTestId('builder-form'));
  await waitFor(()=>expect(apiPatch).toHaveBeenCalledWith('/quizzes/quiz/questions/q1',expect.objectContaining({mediaType:'image',mediaPath:'host/quiz/test.webp'}),'token'));
 });
 it('rejects unsupported media types without requesting an upload',async()=>{
  setup();await screen.findByTestId('builder-select-q1');
  fireEvent.change(screen.getByTestId('builder-media-file'),{target:{files:[new File(['data'],'sample.gif',{type:'image/gif'})]}});
  expect(screen.getByTestId('builder-error')).toBeInTheDocument();
  expect(signedUpload).not.toHaveBeenCalled();
 });

 it('loads question and edits its prompt with an authenticated PATCH',async()=>{setup();await screen.findByTestId('builder-select-q1');fireEvent.change(screen.getByTestId('builder-prompt'),{target:{value:'Changed question'}});fireEvent.submit(screen.getByTestId('builder-form'));await waitFor(()=>expect(apiPatch).toHaveBeenCalledWith('/quizzes/quiz/questions/q1',expect.objectContaining({prompt:'Changed question'}),'token'))});
 it('creates a numeric question using correct API payload',async()=>{setup();await screen.findByTestId('builder-select-q1');fireEvent.click(screen.getByTestId('builder-add'));fireEvent.click(screen.getByTestId('builder-type-NUMERIC_NEAREST'));fireEvent.change(screen.getByTestId('builder-prompt'),{target:{value:'Number?'}});fireEvent.change(screen.getByTestId('builder-numeric'),{target:{value:'42'}});fireEvent.submit(screen.getByTestId('builder-form'));await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/quizzes/quiz/questions',expect.objectContaining({type:'NUMERIC_NEAREST',correctNumeric:42}),'token'))});
 it('deletes a persisted question only after confirmation',async()=>{setup();await screen.findByTestId('builder-select-q1');fireEvent.click(screen.getByTestId('builder-delete'));expect(apiDelete).not.toHaveBeenCalled();fireEvent.click(screen.getByTestId('builder-delete-confirm'));await waitFor(()=>expect(apiDelete).toHaveBeenCalledWith('/quizzes/quiz/questions/q1','token'))});
});
