import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TeamsRepository } from '../data/teams.repository';
import { hashToken } from './hash-token';
import { TeamTokenService } from './team-token.service';

@Injectable()
export class TeamTokenGuard implements CanActivate {
  constructor(
    private readonly teamTokens: TeamTokenService,
    private readonly teams: TeamsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing team token');
    }
    const token = header.slice('Bearer '.length);

    const payload = (() => {
      try {
        return this.teamTokens.verify(token);
      } catch {
        throw new UnauthorizedException('Invalid or expired team token');
      }
    })();

    const team = await this.teams.findById(payload.teamId);
    if (!team || team.device_token_hash !== hashToken(token)) {
      throw new UnauthorizedException('This team is now active on another device');
    }

    req.team = payload;
    return true;
  }
}
