import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

/** The Supabase Auth admin calls the admin area needs; abstract so tests never send e-mail. */
export abstract class AuthAdminGateway {
  /** Creates the auth user and e-mails them an invite link to set a password. Returns the user id. */
  abstract inviteByEmail(email: string, displayName: string): Promise<string>;
}

@Injectable()
export class SupabaseAuthAdminGateway extends AuthAdminGateway {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async inviteByEmail(email: string, displayName: string): Promise<string> {
    const webUrl = this.config.get<string>('WEB_APP_URL');
    const { data, error } = await this.supabase.getClient().auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      // Without WEB_APP_URL Supabase falls back to the project's Site URL.
      redirectTo: webUrl ? `${webUrl.replace(/\/$/, '')}/host` : undefined,
    });
    if (error || !data.user) throw new InternalServerErrorException(error?.message ?? 'Invite failed');
    return data.user.id;
  }
}
