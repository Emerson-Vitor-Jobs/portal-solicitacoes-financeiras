/** Types generated for queries found in "src/repository/postgres/queries/seed.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type DateOrString = Date | string;

export type NumberOrString = number | string;

/** 'InsertSeedUser' parameters type */
export interface IInsertSeedUserParams {
  email: string;
  id: string;
  name: string;
  passwordHash: string;
  role: string;
}

/** 'InsertSeedUser' return type */
export interface IInsertSeedUserResult {
  id: string;
}

/** 'InsertSeedUser' query type */
export interface IInsertSeedUserQuery {
  params: IInsertSeedUserParams;
  result: IInsertSeedUserResult;
}

const insertSeedUserIR: any = {"usedParamSet":{"id":true,"name":true,"email":true,"role":true,"passwordHash":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":65,"b":68}]},{"name":"name","required":true,"transform":{"type":"scalar"},"locs":[{"a":71,"b":76}]},{"name":"email","required":true,"transform":{"type":"scalar"},"locs":[{"a":79,"b":85}]},{"name":"role","required":true,"transform":{"type":"scalar"},"locs":[{"a":88,"b":93}]},{"name":"passwordHash","required":true,"transform":{"type":"scalar"},"locs":[{"a":96,"b":109}]}],"statement":"INSERT INTO users (id, name, email, role, password_hash)\nVALUES (:id!, :name!, :email!, :role!, :passwordHash!)\nON CONFLICT DO NOTHING\nRETURNING id"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO users (id, name, email, role, password_hash)
 * VALUES (:id!, :name!, :email!, :role!, :passwordHash!)
 * ON CONFLICT DO NOTHING
 * RETURNING id
 * ```
 */
export const insertSeedUser = new PreparedQuery<IInsertSeedUserParams,IInsertSeedUserResult>(insertSeedUserIR);


/** 'InsertSeedRequest' parameters type */
export interface IInsertSeedRequestParams {
  amountCents: NumberOrString;
  category: string;
  competence: string;
  createdAt: DateOrString;
  description?: string | null | void;
  dueDate: string;
  id: string;
  invoiceNumber: string;
  paidAt?: DateOrString | null | void;
  paymentReference?: string | null | void;
  rejectionReason?: string | null | void;
  requesterId: string;
  status: string;
  supplierCnpj: string;
  supplierName: string;
  updatedAt: DateOrString;
}

/** 'InsertSeedRequest' return type */
export interface IInsertSeedRequestResult {
  id: string;
}

/** 'InsertSeedRequest' query type */
export interface IInsertSeedRequestQuery {
  params: IInsertSeedRequestParams;
  result: IInsertSeedRequestResult;
}

const insertSeedRequestIR: any = {"usedParamSet":{"id":true,"requesterId":true,"supplierName":true,"supplierCnpj":true,"invoiceNumber":true,"amountCents":true,"competence":true,"dueDate":true,"category":true,"description":true,"status":true,"rejectionReason":true,"paidAt":true,"paymentReference":true,"createdAt":true,"updatedAt":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":240,"b":243}]},{"name":"requesterId","required":true,"transform":{"type":"scalar"},"locs":[{"a":246,"b":258}]},{"name":"supplierName","required":true,"transform":{"type":"scalar"},"locs":[{"a":261,"b":274}]},{"name":"supplierCnpj","required":true,"transform":{"type":"scalar"},"locs":[{"a":277,"b":290}]},{"name":"invoiceNumber","required":true,"transform":{"type":"scalar"},"locs":[{"a":293,"b":307}]},{"name":"amountCents","required":true,"transform":{"type":"scalar"},"locs":[{"a":310,"b":322}]},{"name":"competence","required":true,"transform":{"type":"scalar"},"locs":[{"a":325,"b":336}]},{"name":"dueDate","required":true,"transform":{"type":"scalar"},"locs":[{"a":339,"b":347}]},{"name":"category","required":true,"transform":{"type":"scalar"},"locs":[{"a":352,"b":361}]},{"name":"description","required":false,"transform":{"type":"scalar"},"locs":[{"a":364,"b":375}]},{"name":"status","required":true,"transform":{"type":"scalar"},"locs":[{"a":378,"b":385}]},{"name":"rejectionReason","required":false,"transform":{"type":"scalar"},"locs":[{"a":388,"b":403}]},{"name":"paidAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":406,"b":412}]},{"name":"paymentReference","required":false,"transform":{"type":"scalar"},"locs":[{"a":415,"b":431}]},{"name":"createdAt","required":true,"transform":{"type":"scalar"},"locs":[{"a":434,"b":444}]},{"name":"updatedAt","required":true,"transform":{"type":"scalar"},"locs":[{"a":447,"b":457}]}],"statement":"INSERT INTO requests (\n  id, requester_id, supplier_name, supplier_cnpj, invoice_number, amount_cents, competence, due_date,\n  category, description, status, rejection_reason, paid_at, payment_reference, created_at, updated_at\n)\nVALUES (\n  :id!, :requesterId!, :supplierName!, :supplierCnpj!, :invoiceNumber!, :amountCents!, :competence!, :dueDate!,\n  :category!, :description, :status!, :rejectionReason, :paidAt, :paymentReference, :createdAt!, :updatedAt!\n)\nON CONFLICT DO NOTHING\nRETURNING id"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO requests (
 *   id, requester_id, supplier_name, supplier_cnpj, invoice_number, amount_cents, competence, due_date,
 *   category, description, status, rejection_reason, paid_at, payment_reference, created_at, updated_at
 * )
 * VALUES (
 *   :id!, :requesterId!, :supplierName!, :supplierCnpj!, :invoiceNumber!, :amountCents!, :competence!, :dueDate!,
 *   :category!, :description, :status!, :rejectionReason, :paidAt, :paymentReference, :createdAt!, :updatedAt!
 * )
 * ON CONFLICT DO NOTHING
 * RETURNING id
 * ```
 */
export const insertSeedRequest = new PreparedQuery<IInsertSeedRequestParams,IInsertSeedRequestResult>(insertSeedRequestIR);


/** 'InsertSeedAuditEvent' parameters type */
export interface IInsertSeedAuditEventParams {
  actorId: string;
  createdAt: DateOrString;
  id: string;
  newStatus: string;
  previousStatus?: string | null | void;
  reason?: string | null | void;
  requestId: string;
}

/** 'InsertSeedAuditEvent' return type */
export interface IInsertSeedAuditEventResult {
  id: string;
}

/** 'InsertSeedAuditEvent' query type */
export interface IInsertSeedAuditEventQuery {
  params: IInsertSeedAuditEventParams;
  result: IInsertSeedAuditEventResult;
}

const insertSeedAuditEventIR: any = {"usedParamSet":{"id":true,"requestId":true,"actorId":true,"previousStatus":true,"newStatus":true,"reason":true,"createdAt":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":109,"b":112}]},{"name":"requestId","required":true,"transform":{"type":"scalar"},"locs":[{"a":115,"b":125}]},{"name":"actorId","required":true,"transform":{"type":"scalar"},"locs":[{"a":128,"b":136}]},{"name":"previousStatus","required":false,"transform":{"type":"scalar"},"locs":[{"a":139,"b":153}]},{"name":"newStatus","required":true,"transform":{"type":"scalar"},"locs":[{"a":156,"b":166}]},{"name":"reason","required":false,"transform":{"type":"scalar"},"locs":[{"a":169,"b":175}]},{"name":"createdAt","required":true,"transform":{"type":"scalar"},"locs":[{"a":178,"b":188}]}],"statement":"INSERT INTO audit_events (id, request_id, actor_id, previous_status, new_status, reason, created_at)\nVALUES (:id!, :requestId!, :actorId!, :previousStatus, :newStatus!, :reason, :createdAt!)\nON CONFLICT DO NOTHING\nRETURNING id"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO audit_events (id, request_id, actor_id, previous_status, new_status, reason, created_at)
 * VALUES (:id!, :requestId!, :actorId!, :previousStatus, :newStatus!, :reason, :createdAt!)
 * ON CONFLICT DO NOTHING
 * RETURNING id
 * ```
 */
export const insertSeedAuditEvent = new PreparedQuery<IInsertSeedAuditEventParams,IInsertSeedAuditEventResult>(insertSeedAuditEventIR);


