import type { FastifyReply } from 'fastify';
import type { z } from 'zod';
import type { AuthService } from '../../../service/auth.js';
import type {
  LoginBody,
  loginResponseSchema,
  meResponseSchema,
  userSchema,
} from '../../../types/auth.js';
import type { User } from '../../../types/domain.js';
import { SESSION_COOKIE } from '../session.js';

export function toUserResponse(user: User): z.infer<typeof userSchema> {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export interface CookieOptions {
  secure: boolean;
}

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: CookieOptions,
  ) {}

  async login(body: LoginBody, reply: FastifyReply): Promise<z.infer<typeof loginResponseSchema>> {
    const session = await this.auth.login(body.email, body.password);
    reply.setCookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: this.cookie.secure,
      expires: session.expiresAt,
    });
    return { user: toUserResponse(session.user) };
  }

  async logout(token: string, reply: FastifyReply): Promise<void> {
    await this.auth.logout(token);
    reply.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: this.cookie.secure,
    });
  }

  me(user: User): z.infer<typeof meResponseSchema> {
    const context = this.auth.sessionContext(user);
    return { user: toUserResponse(context.user), reference_date: context.referenceDate };
  }
}
