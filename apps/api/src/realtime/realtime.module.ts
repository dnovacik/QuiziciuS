import { Global, Module } from '@nestjs/common';
import { RealtimeBroadcastService } from './realtime-broadcast.service';

@Global()
@Module({
  providers: [RealtimeBroadcastService],
  exports: [RealtimeBroadcastService],
})
export class RealtimeModule {}
