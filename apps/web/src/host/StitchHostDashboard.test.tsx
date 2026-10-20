import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../lib/i18n';
import {StitchHostDashboard} from './StitchHostDashboard';
import {apiGet,apiPost} from '../lib/api-client';
vi.mock('../lib/api-client',()=>({apiGet:vi.fn(),apiPost:vi.fn()}));
const get=vi.mocked(apiGet),post=vi.mocked(apiPost);
const setup=(onSessionCreated=vi.fn())=>render(<MemoryRouter><I18nProvider><StitchHostDashboard token="host-token" onSessionCreated={onSessionCreated}/></I18nProvider></MemoryRouter>);
beforeEach(()=>{vi.clearAllMocks();get.mockImplementation(async(path:string)=>path==='/quizzes'?[{id:'q1',title:'Quiz Alpha',category_id:null,created_at:'2026-10-20'}]:[]);post.mockResolvedValue({id:'s1',join_code:'A7F3'} as never)});
describe('Stitch host dashboard',()=>{
 it('lists real quizzes and can search without matching translated labels',async()=>{setup();expect(await screen.findByTestId('host-quiz-q1')).toBeInTheDocument();fireEvent.change(screen.getByTestId('host-quiz-search'),{target:{value:'unmatched'}});expect(screen.getByTestId('host-dashboard-empty')).toBeInTheDocument()});
 it('launches a real session and reports ids',async()=>{const fn=vi.fn();setup(fn);await screen.findByTestId('host-quiz-q1');fireEvent.click(screen.getByTestId('host-start-q1'));fireEvent.click(screen.getByTestId('host-launch-confirm'));await waitFor(()=>expect(post).toHaveBeenCalledWith('/quizzes/q1/sessions',{},'host-token'));expect(fn).toHaveBeenCalledWith('s1','q1')});
 it('creates a quiz via API and shows its card',async()=>{post.mockResolvedValueOnce({id:'q2',title:'New Quiz',category_id:null} as never);setup();await screen.findByTestId('host-quiz-q1');fireEvent.click(screen.getByTestId('host-create-quiz'));fireEvent.change(screen.getByTestId('host-new-title'),{target:{value:'New Quiz'}});fireEvent.submit(screen.getByTestId('host-create-form'));await waitFor(()=>expect(post).toHaveBeenCalledWith('/quizzes',{title:'New Quiz',categoryId:undefined},'host-token'));expect(await screen.findByTestId('host-quiz-q2')).toBeInTheDocument()});
});
