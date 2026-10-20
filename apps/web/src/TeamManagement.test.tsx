import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {I18nProvider} from './lib/i18n';
import {TeamManagement} from './TeamManagement';
import {apiGet,apiPost,apiPatch,apiDelete} from './lib/api-client';
vi.mock('./lib/api-client',()=>({apiGet:vi.fn(),apiPost:vi.fn(),apiPatch:vi.fn(),apiDelete:vi.fn()}));
const team={id:'t1',name:'Quiz Wolves',description:null,badge:'shield',badge_color:'purple',expected_members:4,home_pub:null,created_at:'2026-10-20'};
const player={id:'p1',name:'Alex',created_at:'2026-10-20'};
const setup=()=>render(<I18nProvider><TeamManagement team={team} token="captain-token" onUpdated={vi.fn()}/></I18nProvider>);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(apiGet).mockResolvedValue([] as never);vi.mocked(apiPost).mockResolvedValue(player as never);vi.mocked(apiPatch).mockResolvedValue(player as never);vi.mocked(apiDelete).mockResolvedValue({deleted:true} as never)});
describe('captain-managed roster',()=>{
 it('loads empty players and adds named player without an account',async()=>{
  setup();await screen.findByTestId('roster-empty');
  fireEvent.change(screen.getByTestId('roster-new-name'),{target:{value:'Alex'}});
  fireEvent.submit(screen.getByTestId('roster-add-form'));
  await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/registered-teams/t1/players',{name:'Alex'},'captain-token'));
  expect(await screen.findByTestId('roster-player')).toBeInTheDocument();
 });
 it('can rename and remove a player',async()=>{
  vi.mocked(apiGet).mockResolvedValueOnce([player] as never);setup();
  await screen.findByTestId('roster-player');
  fireEvent.click(screen.getByTestId('roster-edit-p1'));
  fireEvent.change(screen.getByTestId('roster-rename-input'),{target:{value:'Alex S.'}});
  vi.mocked(apiPatch).mockResolvedValueOnce({...player,name:'Alex S.'} as never);
  fireEvent.submit(screen.getByTestId('roster-rename-form'));
  await waitFor(()=>expect(apiPatch).toHaveBeenCalledWith('/registered-teams/t1/players/p1',{name:'Alex S.'},'captain-token'));
  fireEvent.click(screen.getByTestId('roster-remove-p1'));
  await waitFor(()=>expect(apiDelete).toHaveBeenCalledWith('/registered-teams/t1/players/p1','captain-token'));
 });
 it('disables add when six players exist',async()=>{
  vi.mocked(apiGet).mockResolvedValueOnce(Array.from({length:6},(_,i)=>({...player,id:String(i),name:'P'+i})) as never);
  setup();await waitFor(()=>expect(screen.getAllByTestId('roster-player')).toHaveLength(6));
  expect(screen.getByTestId('roster-add-submit')).toBeDisabled();
 });
});
