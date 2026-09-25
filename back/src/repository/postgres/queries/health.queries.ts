/** Types generated for queries found in "src/repository/postgres/queries/health.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

/** 'Ping' parameters type */
export type IPingParams = void;

/** 'Ping' return type */
export interface IPingResult {
  ok: number;
}

/** 'Ping' query type */
export interface IPingQuery {
  params: IPingParams;
  result: IPingResult;
}

const pingIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT 1 AS \"ok!\""};

/**
 * Query generated from SQL:
 * ```
 * SELECT 1 AS "ok!"
 * ```
 */
export const ping = new PreparedQuery<IPingParams,IPingResult>(pingIR);


