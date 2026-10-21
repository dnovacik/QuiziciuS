import {fireEvent,render,screen} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import type {QuizSessionStateDto} from '@quizicius/shared-types';
import {I18nProvider} from '../lib/i18n';
import {StitchQuestionScreen} from './StitchQuestionScreen';
const base:QuizSessionStateDto={id:'s1',joinCode:'AB12',status:'QUESTION_REVEAL',currentQuestion:{id:'q1',type:'MULTIPLE_CHOICE',prompt:'Capital?',options:[{id:'a',label:'Paris'},{id:'b',label:'Lyon'}],points:2,timeLimitSeconds:20,orderIndex:0,correctOptionId:'a',correctNumeric:null,acceptedAnswers:null},questionEndsAt:null,teams:[{id:'team1',name:'Wrong Team',score:0,isActive:true,infractionCount:0}]};
const renderState=(state:QuizSessionStateDto,onExit=vi.fn())=>render(<I18nProvider><StitchQuestionScreen state={state} teamId="team1" token="jwt" onTapToLockIn={vi.fn()} onExit={onExit}/></I18nProvider>);
describe('Stitch player reveal and finish',()=>{
 it('identifies the answer without falsely showing a success checkmark for a losing team',()=>{
   renderState(base);
   expect(screen.getByTestId('player-correct-answer')).toHaveTextContent('Paris');
   expect(screen.getByTestId('player-reveal-not-grade')).toBeInTheDocument();
   expect(screen.queryByText('✓')).not.toBeInTheDocument();
 });
 it('provides a working exit action on the final results screen',()=>{
   const exit=vi.fn();renderState({...base,status:'FINISHED',currentQuestion:null},exit);
   fireEvent.click(screen.getByTestId('player-back-home'));
   expect(exit).toHaveBeenCalledOnce();
 });
});