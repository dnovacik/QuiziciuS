import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PubsController } from './pubs.controller';
import { PubsService } from './pubs.service';

@Module({
  imports: [AuthModule],
  controllers: [PubsController],
  providers: [PubsService],
  exports: [PubsService],
})
export class PubsModule {}
