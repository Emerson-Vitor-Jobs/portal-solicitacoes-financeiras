export interface FieldError {
  field: string;
  message: string;
}

export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

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

export class InvalidTransitionError extends DomainError {}
