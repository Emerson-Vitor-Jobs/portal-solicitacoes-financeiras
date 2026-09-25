/** Types generated for queries found in "src/repository/postgres/queries/users.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

/** 'FindUserByEmail' parameters type */
export interface IFindUserByEmailParams {
  email: string;
}

/** 'FindUserByEmail' return type */
export interface IFindUserByEmailResult {
  email: string;
  id: string;
  name: string;
  password_hash: string;
  role: string;
}

/** 'FindUserByEmail' query type */
export interface IFindUserByEmailQuery {
  params: IFindUserByEmailParams;
  result: IFindUserByEmailResult;
}

const findUserByEmailIR: any = {"usedParamSet":{"email":true},"params":[{"name":"email","required":true,"transform":{"type":"scalar"},"locs":[{"a":69,"b":75}]}],"statement":"SELECT id, name, email, role, password_hash\nFROM users\nWHERE email = :email!"};

/**
 * Query generated from SQL:
 * ```
 * SELECT id, name, email, role, password_hash
 * FROM users
 * WHERE email = :email!
 * ```
 */
export const findUserByEmail = new PreparedQuery<IFindUserByEmailParams,IFindUserByEmailResult>(findUserByEmailIR);


