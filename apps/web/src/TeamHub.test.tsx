import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './lib/i18n';
import { TeamHub } from './TeamHub';
import { apiGet, apiPost } from './lib/api-client';

vi.mock('./lib/use-host-session',()=>({
  useHostSession:()=>({loading:false,token:'captain-token',session:{user:{id:'captain-id',email:'captain@example.com'}}})
}));
vi.mock('./lib/api-client',()=>({apiGet:vi.fn(),apiPost:vi.fn()}));
const list=vi.mocked(apiGet);
const post=vi.mocked(apiPost);
function renderHub(){return render(<MemoryRouter><I18nProvider><TeamHub /></I18nProvider></MemoryRouter>)}
beforeEach(()=>{vi.clearAllMocks();list.mockImplementation(async(path:string)=>path.includes('/availability/')?{available:true,code:'NAME_AVAILABLE'}:[]);post.mockResolvedValue({id:'newteam',name:'Brainstorm',description:'',badge:'shield',badge_color:'purple',expected_members:4,home_pub:null,created_at:'2026-10-20'} as never)});

describe('Captain onboarding and dashboard',()=>{
 it('loads captain teams and shows onboarding when none exist',async()=>{
   renderHub();
   await waitFor(()=>expect(list).toHaveBeenCalledWith('/api/registered-teams/mine','captain-token'));
   expect(await screen.findByTestId('team-create-form')).toBeInTheDocument();
 });
 it('validates a unique name and creates a team with captain token',async()=>{
   renderHub();
   await screen.findByTestId('team-create-form');
   fireEvent.change(screen.getByTestId('hub-team-name'),{target:{value:'Brainstorm'}});
   await waitFor(()=>expect(screen.getByTestId('hub-name-availability')).toHaveAttribute('data-status','available'));
   fireEvent.submit(screen.getByTestId('team-create-form'));
   await waitFor(()=>expect(post).toHaveBeenCalledWith('/api/registered-teams',{name:'Brainstorm',description:'',badge:'shield',color:'purple',expectedMembers:4,homePub:''},'captain-token'));
   expect(await screen.findByTestId('dashboard-team-name')).toBeInTheDocument();
 });
 it('shows real persisted team without fictitious roster or results',async()=>{
   list.mockResolvedValueOnce([{id:'one',name:'Existing team',description:null,badge:'shield',badge_color:'purple',expected_members:4,home_pub:null,created_at:'2026-10-20'}] as never);
   renderHub();
   expect(await screen.findByTestId('dashboard-team-name')).toBeInTheDocument();
   expect(screen.queryByTestId('team-create-form')).not.toBeInTheDocument();
   fireEvent.click(screen.getByTestId('dashboard-join-toggle'));
   expect(screen.getByTestId('dashboard-join-code')).toHaveAttribute('maxLength','4');
 });
});
