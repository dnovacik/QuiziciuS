import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {I18nProvider} from '../lib/i18n';
import {QuizBuilder} from './QuizBuilder';
import {apiGet,apiPost,apiPatch,apiDelete} from '../lib/api-client';
vi.mock('../lib/api-client',()=>({apiGet:vi.fn(),apiPost:vi.fn(),apiPatch:vi.fn(),apiDelete:vi.fn()}));
const q={id:'q1',quiz_id:'quiz',type:'MULTIPLE_CHOICE',prompt:'Question',options:[{id:'a',label:'A',isCorrect:true},{id:'b',label:'B',isCorrect:false}],accepted_answers:null,correct_numeric:null,points:1,time_limit_seconds:30,order_index:0};
const setup=()=>render(<I18nProvider><QuizBuilder quizId="quiz" quizTitle="Quiz" token="token" onBack={vi.fn()}/></I18nProvider>);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(apiGet).mockResolvedValue([q] as never);vi.mocked(apiPost).mockResolvedValue({...q,id:'q2'} as never);vi.mocked(apiPatch).mockResolvedValue(q as never);vi.mocked(apiDelete).mockResolvedValue({deleted:true} as never)});
describe('Stitch quiz builder',()=>{
 it('loads question and edits its prompt with an authenticated PATCH',async()=>{setup();await screen.findByTestId('builder-select-q1');fireEvent.change(screen.getByTestId('builder-prompt'),{target:{value:'Changed question'}});fireEvent.submit(screen.getByTestId('builder-form'));await waitFor(()=>expect(apiPatch).toHaveBeenCalledWith('/quizzes/quiz/questions/q1',expect.objectContaining({prompt:'Changed question'}),'token'))});
 it('creates a numeric question using correct API payload',async()=>{setup();await screen.findByTestId('builder-select-q1');fireEvent.click(screen.getByTestId('builder-add'));fireEvent.click(screen.getByTestId('builder-type-NUMERIC_NEAREST'));fireEvent.change(screen.getByTestId('builder-prompt'),{target:{value:'Number?'}});fireEvent.change(screen.getByTestId('builder-numeric'),{target:{value:'42'}});fireEvent.submit(screen.getByTestId('builder-form'));await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/quizzes/quiz/questions',expect.objectContaining({type:'NUMERIC_NEAREST',correctNumeric:42}),'token'))});
 it('deletes a persisted question only after confirmation',async()=>{setup();await screen.findByTestId('builder-select-q1');fireEvent.click(screen.getByTestId('builder-delete'));expect(apiDelete).not.toHaveBeenCalled();fireEvent.click(screen.getByTestId('builder-delete-confirm'));await waitFor(()=>expect(apiDelete).toHaveBeenCalledWith('/quizzes/quiz/questions/q1','token'))});
});
