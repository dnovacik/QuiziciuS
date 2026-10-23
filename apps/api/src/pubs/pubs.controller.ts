import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentHost, CurrentHostPayload } from '../auth/current-host.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PubRecord } from '../data/pubs.repository';
import { AddPubDto } from './dto/add-pub.dto';
import { PubsService } from './pubs.service';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class PubsController {
  constructor(private readonly pubs: PubsService) {}

  /** The shared pub list (hosts adding a venue, captains picking their pubs). */
  @Get('pubs')
  search(@Query('q') query?: string): Promise<PubRecord[]> {
    return this.pubs.search(query ?? null);
  }

  @Get('host/pubs')
  mine(@CurrentHost() host: CurrentHostPayload): Promise<PubRecord[]> {
    return this.pubs.listForHost(host.id);
  }

  @Post('host/pubs')
  add(@CurrentHost() host: CurrentHostPayload, @Body() dto: AddPubDto): Promise<PubRecord> {
    return this.pubs.addForHost(host.id, dto);
  }

  @Put('host/pubs/:pubId')
  link(@CurrentHost() host: CurrentHostPayload, @Param('pubId') pubId: string): Promise<PubRecord> {
    return this.pubs.linkForHost(host.id, pubId);
  }

  /** Removes the pub from the host's list; the shared pub itself stays. */
  @Delete('host/pubs/:pubId')
  @HttpCode(204)
  unlink(@CurrentHost() host: CurrentHostPayload, @Param('pubId') pubId: string): Promise<void> {
    return this.pubs.unlinkForHost(host.id, pubId);
  }
}
