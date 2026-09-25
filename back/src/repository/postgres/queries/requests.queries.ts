/** Types generated for queries found in "src/repository/postgres/queries/requests.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type DateOrString = Date | string;

export type NumberOrString = number | string;

/** 'InsertRequest' parameters type */
export interface IInsertRequestParams {
  amountCents: NumberOrString;
  category: string;
  competence: string;
  description?: string | null | void;
  dueDate: string;
  id: string;
  invoiceNumber: string;
  requesterId: string;
  supplierCnpj: string;
  supplierName: string;
}

/** 'InsertRequest' return type */
export type IInsertRequestResult = void;

/** 'InsertRequest' query type */
export interface IInsertRequestQuery {
  params: IInsertRequestParams;
  result: IInsertRequestResult;
}

const insertRequestIR: any = {"usedParamSet":{"id":true,"requesterId":true,"supplierName":true,"supplierCnpj":true,"invoiceNumber":true,"amountCents":true,"competence":true,"dueDate":true,"category":true,"description":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":170,"b":173}]},{"name":"requesterId","required":true,"transform":{"type":"scalar"},"locs":[{"a":176,"b":188}]},{"name":"supplierName","required":true,"transform":{"type":"scalar"},"locs":[{"a":191,"b":204}]},{"name":"supplierCnpj","required":true,"transform":{"type":"scalar"},"locs":[{"a":207,"b":220}]},{"name":"invoiceNumber","required":true,"transform":{"type":"scalar"},"locs":[{"a":223,"b":237}]},{"name":"amountCents","required":true,"transform":{"type":"scalar"},"locs":[{"a":240,"b":252}]},{"name":"competence","required":true,"transform":{"type":"scalar"},"locs":[{"a":255,"b":266}]},{"name":"dueDate","required":true,"transform":{"type":"scalar"},"locs":[{"a":269,"b":277}]},{"name":"category","required":true,"transform":{"type":"scalar"},"locs":[{"a":282,"b":291}]},{"name":"description","required":false,"transform":{"type":"scalar"},"locs":[{"a":294,"b":305}]}],"statement":"INSERT INTO requests (\n  id, requester_id, supplier_name, supplier_cnpj, invoice_number, amount_cents, competence, due_date,\n  category, description, status\n)\nVALUES (\n  :id!, :requesterId!, :supplierName!, :supplierCnpj!, :invoiceNumber!, :amountCents!, :competence!, :dueDate!,\n  :category!, :description, 'PENDING'\n)"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO requests (
 *   id, requester_id, supplier_name, supplier_cnpj, invoice_number, amount_cents, competence, due_date,
 *   category, description, status
 * )
 * VALUES (
 *   :id!, :requesterId!, :supplierName!, :supplierCnpj!, :invoiceNumber!, :amountCents!, :competence!, :dueDate!,
 *   :category!, :description, 'PENDING'
 * )
 * ```
 */
export const insertRequest = new PreparedQuery<IInsertRequestParams,IInsertRequestResult>(insertRequestIR);


/** 'UpdateRequestStatus' parameters type */
export interface IUpdateRequestStatusParams {
  from: string;
  id: string;
  paidAt?: DateOrString | null | void;
  paymentReference?: string | null | void;
  rejectionReason?: string | null | void;
  to: string;
}

/** 'UpdateRequestStatus' return type */
export interface IUpdateRequestStatusResult {
  id: string;
}

/** 'UpdateRequestStatus' query type */
export interface IUpdateRequestStatusQuery {
  params: IUpdateRequestStatusParams;
  result: IUpdateRequestStatusResult;
}

const updateRequestStatusIR: any = {"usedParamSet":{"to":true,"rejectionReason":true,"paidAt":true,"paymentReference":true,"id":true,"from":true},"params":[{"name":"to","required":true,"transform":{"type":"scalar"},"locs":[{"a":29,"b":32}]},{"name":"rejectionReason","required":false,"transform":{"type":"scalar"},"locs":[{"a":58,"b":73}]},{"name":"paidAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":90,"b":96}]},{"name":"paymentReference","required":false,"transform":{"type":"scalar"},"locs":[{"a":123,"b":139}]},{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":176,"b":179}]},{"name":"from","required":true,"transform":{"type":"scalar"},"locs":[{"a":194,"b":199}]}],"statement":"UPDATE requests\nSET status = :to!,\n    rejection_reason = :rejectionReason,\n    paid_at = :paidAt,\n    payment_reference = :paymentReference,\n    updated_at = now()\nWHERE id = :id! AND status = :from!\nRETURNING id"};

/**
 * Query generated from SQL:
 * ```
 * UPDATE requests
 * SET status = :to!,
 *     rejection_reason = :rejectionReason,
 *     paid_at = :paidAt,
 *     payment_reference = :paymentReference,
 *     updated_at = now()
 * WHERE id = :id! AND status = :from!
 * RETURNING id
 * ```
 */
export const updateRequestStatus = new PreparedQuery<IUpdateRequestStatusParams,IUpdateRequestStatusResult>(updateRequestStatusIR);


/** 'FindRequestStatus' parameters type */
export interface IFindRequestStatusParams {
  id: string;
}

/** 'FindRequestStatus' return type */
export interface IFindRequestStatusResult {
  status: string;
}

/** 'FindRequestStatus' query type */
export interface IFindRequestStatusQuery {
  params: IFindRequestStatusParams;
  result: IFindRequestStatusResult;
}

const findRequestStatusIR: any = {"usedParamSet":{"id":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":39,"b":42}]}],"statement":"SELECT status\nFROM requests\nWHERE id = :id!"};

/**
 * Query generated from SQL:
 * ```
 * SELECT status
 * FROM requests
 * WHERE id = :id!
 * ```
 */
export const findRequestStatus = new PreparedQuery<IFindRequestStatusParams,IFindRequestStatusResult>(findRequestStatusIR);


/** 'InsertAuditEvent' parameters type */
export interface IInsertAuditEventParams {
  actorId: string;
  id: string;
  newStatus: string;
  previousStatus?: string | null | void;
  reason?: string | null | void;
  requestId: string;
}

/** 'InsertAuditEvent' return type */
export type IInsertAuditEventResult = void;

/** 'InsertAuditEvent' query type */
export interface IInsertAuditEventQuery {
  params: IInsertAuditEventParams;
  result: IInsertAuditEventResult;
}

const insertAuditEventIR: any = {"usedParamSet":{"id":true,"requestId":true,"actorId":true,"previousStatus":true,"newStatus":true,"reason":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":97,"b":100}]},{"name":"requestId","required":true,"transform":{"type":"scalar"},"locs":[{"a":103,"b":113}]},{"name":"actorId","required":true,"transform":{"type":"scalar"},"locs":[{"a":116,"b":124}]},{"name":"previousStatus","required":false,"transform":{"type":"scalar"},"locs":[{"a":127,"b":141}]},{"name":"newStatus","required":true,"transform":{"type":"scalar"},"locs":[{"a":144,"b":154}]},{"name":"reason","required":false,"transform":{"type":"scalar"},"locs":[{"a":157,"b":163}]}],"statement":"INSERT INTO audit_events (id, request_id, actor_id, previous_status, new_status, reason)\nVALUES (:id!, :requestId!, :actorId!, :previousStatus, :newStatus!, :reason)                                                                                                              "};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO audit_events (id, request_id, actor_id, previous_status, new_status, reason)
 * VALUES (:id!, :requestId!, :actorId!, :previousStatus, :newStatus!, :reason)                                                                                                              
 * ```
 */
export const insertAuditEvent = new PreparedQuery<IInsertAuditEventParams,IInsertAuditEventResult>(insertAuditEventIR);


/** 'FindTransitionInstant' parameters type */
export interface IFindTransitionInstantParams {
  newStatus: string;
  requestId: string;
}

/** 'FindTransitionInstant' return type */
export interface IFindTransitionInstantResult {
  created_at: Date;
}

/** 'FindTransitionInstant' query type */
export interface IFindTransitionInstantQuery {
  params: IFindTransitionInstantParams;
  result: IFindTransitionInstantResult;
}

const findTransitionInstantIR: any = {"usedParamSet":{"requestId":true,"newStatus":true},"params":[{"name":"requestId","required":true,"transform":{"type":"scalar"},"locs":[{"a":55,"b":65}]},{"name":"newStatus","required":true,"transform":{"type":"scalar"},"locs":[{"a":84,"b":94}]}],"statement":"SELECT created_at\nFROM audit_events\nWHERE request_id = :requestId! AND new_status = :newStatus!\nORDER BY created_at DESC\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT created_at
 * FROM audit_events
 * WHERE request_id = :requestId! AND new_status = :newStatus!
 * ORDER BY created_at DESC
 * LIMIT 1
 * ```
 */
export const findTransitionInstant = new PreparedQuery<IFindTransitionInstantParams,IFindTransitionInstantResult>(findTransitionInstantIR);


/** 'FindRequestById' parameters type */
export interface IFindRequestByIdParams {
  id: string;
}

/** 'FindRequestById' return type */
export interface IFindRequestByIdResult {
  amount_cents: string;
  category: string;
  competence: string;
  created_at: Date;
  description: string | null;
  due_date: string;
  id: string;
  invoice_number: string;
  paid_at: Date | null;
  payment_reference: string | null;
  rejection_reason: string | null;
  requester_id: string;
  requester_name: string;
  status: string;
  supplier_cnpj: string;
  supplier_name: string;
  updated_at: Date;
}

/** 'FindRequestById' query type */
export interface IFindRequestByIdQuery {
  params: IFindRequestByIdParams;
  result: IFindRequestByIdResult;
}

const findRequestByIdIR: any = {"usedParamSet":{"id":true},"params":[{"name":"id","required":true,"transform":{"type":"scalar"},"locs":[{"a":346,"b":349}]}],"statement":"SELECT r.id, r.requester_id, u.name AS requester_name, r.supplier_name, r.supplier_cnpj, r.invoice_number,\n       r.amount_cents, r.competence, r.due_date, r.category, r.description, r.status, r.rejection_reason,\n       r.paid_at, r.payment_reference, r.created_at, r.updated_at\nFROM requests r\nJOIN users u ON u.id = r.requester_id\nWHERE r.id = :id!"};

/**
 * Query generated from SQL:
 * ```
 * SELECT r.id, r.requester_id, u.name AS requester_name, r.supplier_name, r.supplier_cnpj, r.invoice_number,
 *        r.amount_cents, r.competence, r.due_date, r.category, r.description, r.status, r.rejection_reason,
 *        r.paid_at, r.payment_reference, r.created_at, r.updated_at
 * FROM requests r
 * JOIN users u ON u.id = r.requester_id
 * WHERE r.id = :id!
 * ```
 */
export const findRequestById = new PreparedQuery<IFindRequestByIdParams,IFindRequestByIdResult>(findRequestByIdIR);


/** 'ListAuditEvents' parameters type */
export interface IListAuditEventsParams {
  requestId: string;
}

/** 'ListAuditEvents' return type */
export interface IListAuditEventsResult {
  actor_id: string;
  actor_name: string;
  created_at: Date;
  id: string;
  new_status: string;
  previous_status: string | null;
  reason: string | null;
}

/** 'ListAuditEvents' query type */
export interface IListAuditEventsQuery {
  params: IListAuditEventsParams;
  result: IListAuditEventsResult;
}

const listAuditEventsIR: any = {"usedParamSet":{"requestId":true},"params":[{"name":"requestId","required":true,"transform":{"type":"scalar"},"locs":[{"a":178,"b":188}]}],"statement":"SELECT e.id, e.previous_status, e.new_status, e.reason, e.created_at, e.actor_id, u.name AS actor_name\nFROM audit_events e\nJOIN users u ON u.id = e.actor_id\nWHERE e.request_id = :requestId!\nORDER BY e.created_at, e.id                                                                                                                                                                                                                                                                                                    "};

/**
 * Query generated from SQL:
 * ```
 * SELECT e.id, e.previous_status, e.new_status, e.reason, e.created_at, e.actor_id, u.name AS actor_name
 * FROM audit_events e
 * JOIN users u ON u.id = e.actor_id
 * WHERE e.request_id = :requestId!
 * ORDER BY e.created_at, e.id                                                                                                                                                                                                                                                                                                    
 * ```
 */
export const listAuditEvents = new PreparedQuery<IListAuditEventsParams,IListAuditEventsResult>(listAuditEventsIR);


/** 'ListRequests' parameters type */
export interface IListRequestsParams {
  dueFrom?: string | null | void;
  dueTo?: string | null | void;
  limit: NumberOrString;
  offset: NumberOrString;
  requesterId?: string | null | void;
  status?: string | null | void;
  supplier?: string | null | void;
}

/** 'ListRequests' return type */
export interface IListRequestsResult {
  amount_cents: string;
  category: string;
  competence: string;
  created_at: Date;
  description: string | null;
  due_date: string;
  id: string;
  invoice_number: string;
  paid_at: Date | null;
  payment_reference: string | null;
  rejection_reason: string | null;
  requester_id: string;
  requester_name: string;
  status: string;
  supplier_cnpj: string;
  supplier_name: string;
  updated_at: Date;
}

/** 'ListRequests' query type */
export interface IListRequestsQuery {
  params: IListRequestsParams;
  result: IListRequestsResult;
}

const listRequestsIR: any = {"usedParamSet":{"requesterId":true,"status":true,"supplier":true,"dueFrom":true,"dueTo":true,"limit":true,"offset":true},"params":[{"name":"requesterId","required":false,"transform":{"type":"scalar"},"locs":[{"a":340,"b":351},{"a":387,"b":398}]},{"name":"status","required":false,"transform":{"type":"scalar"},"locs":[{"a":408,"b":414},{"a":444,"b":450}]},{"name":"supplier","required":false,"transform":{"type":"scalar"},"locs":[{"a":460,"b":468},{"a":535,"b":543}]},{"name":"dueFrom","required":false,"transform":{"type":"scalar"},"locs":[{"a":561,"b":568},{"a":601,"b":608}]},{"name":"dueTo","required":false,"transform":{"type":"scalar"},"locs":[{"a":618,"b":623},{"a":656,"b":661}]},{"name":"limit","required":true,"transform":{"type":"scalar"},"locs":[{"a":708,"b":714}]},{"name":"offset","required":true,"transform":{"type":"scalar"},"locs":[{"a":723,"b":730}]}],"statement":"SELECT r.id, r.requester_id, u.name AS requester_name, r.supplier_name, r.supplier_cnpj, r.invoice_number,\n       r.amount_cents, r.competence, r.due_date, r.category, r.description, r.status, r.rejection_reason,\n       r.paid_at, r.payment_reference, r.created_at, r.updated_at\nFROM requests r\nJOIN users u ON u.id = r.requester_id\nWHERE (:requesterId::uuid IS NULL OR r.requester_id = :requesterId)\n  AND (:status::text IS NULL OR r.status = :status)\n  AND (:supplier::text IS NULL OR unaccent(r.supplier_name) ILIKE unaccent('%' || :supplier || '%'))\n  AND (:dueFrom::date IS NULL OR r.due_date >= :dueFrom)\n  AND (:dueTo::date IS NULL OR r.due_date <= :dueTo)\nORDER BY r.created_at DESC, r.id DESC\nLIMIT :limit! OFFSET :offset!"};

/**
 * Query generated from SQL:
 * ```
 * SELECT r.id, r.requester_id, u.name AS requester_name, r.supplier_name, r.supplier_cnpj, r.invoice_number,
 *        r.amount_cents, r.competence, r.due_date, r.category, r.description, r.status, r.rejection_reason,
 *        r.paid_at, r.payment_reference, r.created_at, r.updated_at
 * FROM requests r
 * JOIN users u ON u.id = r.requester_id
 * WHERE (:requesterId::uuid IS NULL OR r.requester_id = :requesterId)
 *   AND (:status::text IS NULL OR r.status = :status)
 *   AND (:supplier::text IS NULL OR unaccent(r.supplier_name) ILIKE unaccent('%' || :supplier || '%'))
 *   AND (:dueFrom::date IS NULL OR r.due_date >= :dueFrom)
 *   AND (:dueTo::date IS NULL OR r.due_date <= :dueTo)
 * ORDER BY r.created_at DESC, r.id DESC
 * LIMIT :limit! OFFSET :offset!
 * ```
 */
export const listRequests = new PreparedQuery<IListRequestsParams,IListRequestsResult>(listRequestsIR);


/** 'CountRequests' parameters type */
export interface ICountRequestsParams {
  dueFrom?: string | null | void;
  dueTo?: string | null | void;
  requesterId?: string | null | void;
  status?: string | null | void;
  supplier?: string | null | void;
}

/** 'CountRequests' return type */
export interface ICountRequestsResult {
  total: string;
}

/** 'CountRequests' query type */
export interface ICountRequestsQuery {
  params: ICountRequestsParams;
  result: ICountRequestsResult;
}

const countRequestsIR: any = {"usedParamSet":{"requesterId":true,"status":true,"supplier":true,"dueFrom":true,"dueTo":true},"params":[{"name":"requesterId","required":false,"transform":{"type":"scalar"},"locs":[{"a":51,"b":62},{"a":98,"b":109}]},{"name":"status","required":false,"transform":{"type":"scalar"},"locs":[{"a":119,"b":125},{"a":155,"b":161}]},{"name":"supplier","required":false,"transform":{"type":"scalar"},"locs":[{"a":171,"b":179},{"a":246,"b":254}]},{"name":"dueFrom","required":false,"transform":{"type":"scalar"},"locs":[{"a":272,"b":279},{"a":312,"b":319}]},{"name":"dueTo","required":false,"transform":{"type":"scalar"},"locs":[{"a":329,"b":334},{"a":367,"b":372}]}],"statement":"SELECT COUNT(*) AS \"total!\"\nFROM requests r\nWHERE (:requesterId::uuid IS NULL OR r.requester_id = :requesterId)\n  AND (:status::text IS NULL OR r.status = :status)\n  AND (:supplier::text IS NULL OR unaccent(r.supplier_name) ILIKE unaccent('%' || :supplier || '%'))\n  AND (:dueFrom::date IS NULL OR r.due_date >= :dueFrom)\n  AND (:dueTo::date IS NULL OR r.due_date <= :dueTo)"};

/**
 * Query generated from SQL:
 * ```
 * SELECT COUNT(*) AS "total!"
 * FROM requests r
 * WHERE (:requesterId::uuid IS NULL OR r.requester_id = :requesterId)
 *   AND (:status::text IS NULL OR r.status = :status)
 *   AND (:supplier::text IS NULL OR unaccent(r.supplier_name) ILIKE unaccent('%' || :supplier || '%'))
 *   AND (:dueFrom::date IS NULL OR r.due_date >= :dueFrom)
 *   AND (:dueTo::date IS NULL OR r.due_date <= :dueTo)
 * ```
 */
export const countRequests = new PreparedQuery<ICountRequestsParams,ICountRequestsResult>(countRequestsIR);


