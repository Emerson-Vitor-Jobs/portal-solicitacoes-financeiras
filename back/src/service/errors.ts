// Erros de domínio lançados pelos services (o equivalente dos `var ErrX` sentinela em Go).
// O mapeamento para HTTP acontece num lugar só: handler/http/errors.ts (DECISOES_FUNDACAO §4a, §5).

export interface FieldError {
  field: string;
  message: string;
}

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    // Nome da subclasse concreta (ex.: "DuplicateInvoiceError"), útil em log e em teste.
    this.name = new.target.name;
  }
}

// Conteúdo bem formado que viola uma regra (CNPJ com DV errado, pagamento no futuro…) → 422.
export class ValidationError extends DomainError {
  constructor(readonly errors: FieldError[]) {
    super(errors.map((e) => `${e.field}: ${e.message}`).join('; '));
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('E-mail ou senha inválidos.');
  }
}

export class UnauthenticatedError extends DomainError {
  constructor() {
    super('Sessão ausente ou expirada.');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Seu perfil não permite esta ação.') {
    super(message);
  }
}

// Inexistente, de outra pessoa ou id que não é UUID: a mesma resposta (§5.4, §5.8).
export class NotFoundError extends DomainError {
  constructor(message = 'Recurso não encontrado.') {
    super(message);
  }
}

export class DuplicateInvoiceError extends DomainError {
  constructor() {
    super('Já existe uma solicitação com este CNPJ e número de nota fiscal.');
  }
}

// O estado atual não permite a ação (inclui o perdedor de uma corrida). A mensagem traz o status atual (§5.5).
export class InvalidTransitionError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
