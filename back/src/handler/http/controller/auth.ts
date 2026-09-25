// Controller fino: chama o service e converte domínio → contrato (toXResponse). Nenhuma regra aqui.
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
  // `Secure` por env: false no compose local (http), true em produção com HTTPS (§8.4).
  secure: boolean;
}

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: CookieOptions,
  ) {}

  async login(body: LoginBody, reply: FastifyReply): Promise<z.infer<typeof loginResponseSchema>> {
    const session = await this.auth.login(body.email, body.password);
    // HttpOnly + SameSite=Strict + Path=/; sem o prefixo __Host- (o Chrome recusa em http://localhost, §8.4).
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
