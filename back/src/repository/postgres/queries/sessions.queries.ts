/** Types generated for queries found in "src/repository/postgres/queries/sessions.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type DateOrString = Date | string;

/** 'InsertSession' parameters type */
export interface IInsertSessionParams {
  expiresAt: DateOrString;
  idHash: Buffer;
  now: DateOrString;
  userId: string;
}

/** 'InsertSession' return type */
export type IInsertSessionResult = void;

/** 'InsertSession' query type */
export interface IInsertSessionQuery {
  params: IInsertSessionParams;
  result: IInsertSessionResult;
}

const insertSessionIR: any = {"usedParamSet":{"idHash":true,"userId":true,"now":true,"expiresAt":true},"params":[{"name":"idHash","required":true,"transform":{"type":"scalar"},"locs":[{"a":86,"b":93}]},{"name":"userId","required":true,"transform":{"type":"scalar"},"locs":[{"a":96,"b":103}]},{"name":"now","required":true,"transform":{"type":"scalar"},"locs":[{"a":106,"b":110},{"a":113,"b":117}]},{"name":"expiresAt","required":true,"transform":{"type":"scalar"},"locs":[{"a":120,"b":130}]}],"statement":"INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at)\nVALUES (:idHash!, :userId!, :now!, :now!, :expiresAt!)"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at)
 * VALUES (:idHash!, :userId!, :now!, :now!, :expiresAt!)
 * ```
 */
export const insertSession = new PreparedQuery<IInsertSessionParams,IInsertSessionResult>(insertSessionIR);


/** 'FindSessionWithUser' parameters type */
export interface IFindSessionWithUserParams {
  idHash: Buffer;
}

/** 'FindSessionWithUser' return type */
export interface IFindSessionWithUserResult {
  email: string;
  expires_at: Date;
  id: string;
  last_seen_at: Date;
  name: string;
  role: string;
}

/** 'FindSessionWithUser' query type */
export interface IFindSessionWithUserQuery {
  params: IFindSessionWithUserParams;
  result: IFindSessionWithUserResult;
}

const findSessionWithUserIR: any = {"usedParamSet":{"idHash":true},"params":[{"name":"idHash","required":true,"transform":{"type":"scalar"},"locs":[{"a":134,"b":141}]}],"statement":"SELECT s.last_seen_at, s.expires_at, u.id, u.name, u.email, u.role\nFROM sessions s\nJOIN users u ON u.id = s.user_id\nWHERE s.id_hash = :idHash!"};

/**
 * Query generated from SQL:
 * ```
 * SELECT s.last_seen_at, s.expires_at, u.id, u.name, u.email, u.role
 * FROM sessions s
 * JOIN users u ON u.id = s.user_id
 * WHERE s.id_hash = :idHash!
 * ```
 */
export const findSessionWithUser = new PreparedQuery<IFindSessionWithUserParams,IFindSessionWithUserResult>(findSessionWithUserIR);


/** 'TouchSession' parameters type */
export interface ITouchSessionParams {
  idHash: Buffer;
  now: DateOrString;
}

/** 'TouchSession' return type */
export type ITouchSessionResult = void;

/** 'TouchSession' query type */
export interface ITouchSessionQuery {
  params: ITouchSessionParams;
  result: ITouchSessionResult;
}

const touchSessionIR: any = {"usedParamSet":{"now":true,"idHash":true},"params":[{"name":"now","required":true,"transform":{"type":"scalar"},"locs":[{"a":35,"b":39}]},{"name":"idHash","required":true,"transform":{"type":"scalar"},"locs":[{"a":57,"b":64}]}],"statement":"UPDATE sessions SET last_seen_at = :now!\nWHERE id_hash = :idHash!"};

/**
 * Query generated from SQL:
 * ```
 * UPDATE sessions SET last_seen_at = :now!
 * WHERE id_hash = :idHash!
 * ```
 */
export const touchSession = new PreparedQuery<ITouchSessionParams,ITouchSessionResult>(touchSessionIR);


/** 'DeleteSession' parameters type */
export interface IDeleteSessionParams {
  idHash: Buffer;
}

/** 'DeleteSession' return type */
export type IDeleteSessionResult = void;

/** 'DeleteSession' query type */
export interface IDeleteSessionQuery {
  params: IDeleteSessionParams;
  result: IDeleteSessionResult;
}

const deleteSessionIR: any = {"usedParamSet":{"idHash":true},"params":[{"name":"idHash","required":true,"transform":{"type":"scalar"},"locs":[{"a":37,"b":44}]}],"statement":"DELETE FROM sessions\nWHERE id_hash = :idHash!"};

/**
 * Query generated from SQL:
 * ```
 * DELETE FROM sessions
 * WHERE id_hash = :idHash!
 * ```
 */
export const deleteSession = new PreparedQuery<IDeleteSessionParams,IDeleteSessionResult>(deleteSessionIR);


