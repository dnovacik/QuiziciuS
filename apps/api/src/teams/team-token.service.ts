import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface TeamTokenPayload {
  sessionId: string;
  teamId: string;
}

@Injectable()
export class TeamTokenService {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: TeamTokenPayload): string {
    return this.jwt.sign(payload, { expiresIn: '6h' });
  }

  verify(token: string): TeamTokenPayload {
    return this.jwt.verify<TeamTokenPayload>(token);
  }
}
