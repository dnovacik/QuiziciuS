import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {I18nProvider} from '../lib/i18n';
import {apiGet,apiPost} from '../lib/api-client';
import {useSessionState} from '../lib/use-session-state';
import {LiveControlRoom} from './LiveControlRoom';
vi.mock('../lib/api-client',()=>({apiGet:vi.fn(),apiPost:vi.fn()}));
vi.mock('../lib/use-session-state',()=>({useSessionState:vi.fn()}));
vi.mock('./DisputeQueue',()=>({DisputeQueue:()=>null}));
vi.mock('./PaperModeGrid',()=>({PaperModeGrid:()=>null}));
const get=vi.mocked(apiGet),post=vi.mocked(apiPost),stateHook=vi.mocked(useSessionState);
const session={id:'s1',quiz_id:'quiz1',host_id:'host',join_code:'AB12',status:'LOBBY'};
const question={id:'q1',prompt:'What is the answer?',type:'MULTIPLE_CHOICE',order_index:0,points:1};
const mockState={id:'s1',joinCode:'AB12',status:'LOBBY' as const,currentQuestion:null,questionEndsAt:null,teams:[]};
const setup=()=>render(<I18nProvider><LiveControlRoom sessionId="s1" token="jwt" onLeave={vi.fn()}/></I18nProvider>);
beforeEach(()=>{vi.clearAllMocks();get.mockImplementation(async path=>path==='/host/sessions/s1'?session:path==='/quizzes/quiz1/questions'?[question]:path==='/quizzes'?[{id:'quiz1',title:'Friday Night',category_id:null}]:[] as never);stateHook.mockReturnValue({state:mockState,error:null,refetch:vi.fn()})});
describe('Live Control Room',()=>{
 it('renders real lobby code and lets the host start using server transition',async()=>{
  setup();expect(await screen.findByTestId('live-join-code')).toHaveTextContent('AB12');await waitFor(()=>expect(screen.getByTestId('live-start')).not.toBeDisabled());fireEvent.click(screen.getByTestId('live-start'));await waitFor(()=>expect(post).toHaveBeenCalledWith('/sessions/s1/transition',{status:'LOCK_IN_ROUND',questionId:'q1'},'jwt'));
 });
 it('shows real quiz details above connected teams in the lobby',async()=>{
  stateHook.mockReturnValue({state:{...mockState,teams:[{id:'team1',name:'Team One',isActive:true,score:0,infractionCount:0}]},error:null,refetch:vi.fn()});
  setup();
  expect(await screen.findByTestId('live-quiz-title')).toHaveTextContent('Friday Night');
  expect(screen.getByTestId('live-quiz-question-count')).toHaveTextContent('1');
  expect(screen.getByTestId('live-quiz-total-points')).toHaveTextContent('1');
  expect(screen.getByTestId('live-team-count')).toHaveTextContent('1/1');
  expect(screen.getByTestId('live-connected-teams')).toContainElement(screen.getByTestId('live-team-team1'));
 });
 it('shows finished session without available transition action',async()=>{
  stateHook.mockReturnValue({state:{...mockState,status:'FINISHED'},error:null,refetch:vi.fn()});
  setup();expect(await screen.findByTestId('live-status')).toHaveTextContent('FINISHED');expect(screen.queryByTestId('live-start')).not.toBeInTheDocument();
 });
});