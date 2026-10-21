import {SessionQuestionMediaController} from './session-question-media.controller';
describe('SessionQuestionMediaController',()=>{
 const sign=jest.fn().mockResolvedValue({data:{signedUrl:'https://example.test/signed'},error:null});
 const sessions={findById:jest.fn()};
 const questions={findById:jest.fn()};
 const controller=new SessionQuestionMediaController(sessions as never,questions as never,{getClient:()=>({storage:{from:()=>({createSignedUrl:sign})}})} as never);
 beforeEach(()=>{jest.clearAllMocks();sessions.findById.mockResolvedValue({id:'s1',quiz_id:'quiz',current_question_id:'q1',status:'QUESTION_ACTIVE'});questions.findById.mockResolvedValue({id:'q1',quiz_id:'quiz',media_type:'image',media_path:'host/quiz/a.png'})});
 it('issues short lived URL for active current question',async()=>{
   await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({mediaType:'image',url:'https://example.test/signed'});
   expect(sign).toHaveBeenCalledWith('host/quiz/a.png',900);
 });
 it('does not serve media from a lobby or future question',async()=>{
   sessions.findById.mockResolvedValueOnce({quiz_id:'quiz',current_question_id:'q1',status:'LOBBY'});
   await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({mediaType:null,url:null});
   expect(questions.findById).not.toHaveBeenCalled();
 });
 it('does not expose question media from a different quiz',async()=>{
   questions.findById.mockResolvedValueOnce({quiz_id:'another',media_type:'video',media_path:'other.mp4'});
   await expect(controller.currentQuestionMedia('s1')).resolves.toEqual({mediaType:null,url:null});
   expect(sign).not.toHaveBeenCalled();
 });
});