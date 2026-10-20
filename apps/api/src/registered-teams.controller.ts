import { BadRequestException, ConflictException, Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CurrentHost, CurrentHostPayload } from './auth/current-host.decorator';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { SupabaseService } from './supabase/supabase.service';

class RegisterTeamDto {
 @IsString() @Length(3,30) name!:string;
 @IsOptional() @IsString() @Length(0,160) description?:string;
 @IsOptional() @IsIn(['shield','crown','bolt','star','brain','trophy']) badge?:string;
 @IsOptional() @IsIn(['purple','amber','cyan','green','pink']) color?:string;
 @IsInt() @Min(2) @Max(6) expectedMembers!:number;
 @IsOptional() @IsString() @Length(0,100) homePub?:string;
}
@Controller('registered-teams')
@UseGuards(SupabaseAuthGuard)
export class RegisteredTeamsController {
 constructor(private readonly supabase:SupabaseService){}
 @Get('mine')
 async mine(@CurrentHost() user:CurrentHostPayload){
  const {data,error}=await this.supabase.getClient().from('registered_teams').select('*').eq('captain_id',user.id).order('created_at',{ascending:false});
  if(error)throw error;
  return data??[];
 }
 @Get('availability/:name')
 async availability(@Param('name') name:string){
  const normalized=name.trim().toLowerCase();
  if(normalized.length<3||normalized.length>30)return {available:false,code:'INVALID_NAME'};
  const {data,error}=await this.supabase.getClient().from('registered_teams').select('id').eq('normalized_name',normalized).limit(1);
  if(error)throw error;
  return {available:!data?.length,code:data?.length?'NAME_TAKEN':'NAME_AVAILABLE'};
 }
 @Post()
 async create(@CurrentHost() user:CurrentHostPayload,@Body() dto:RegisterTeamDto){
  const name=dto.name.trim();if(name.length<3||name.length>30)throw new BadRequestException({code:'INVALID_NAME'});
  const {data,error}=await this.supabase.getClient().rpc('create_registered_team',{
   p_captain:user.id,p_name:name,p_description:dto.description??'',p_badge:dto.badge??'shield',
   p_color:dto.color??'purple',p_members:dto.expectedMembers,p_home_pub:dto.homePub??''
  });
  if(error){
   if(error.code==='23505')throw new ConflictException({code:'NAME_TAKEN'});
   if(error.code==='22023')throw new BadRequestException({code:'INVALID_NAME'});
   throw error;
  }
  return data;
 }
}
