import type { QueryResultRow } from "pg";

export type RowDataPacket = QueryResultRow;

export type ResultSetHeader = {
  affectedRows: number;
  insertId: number;
};

export type QueryTuple<T> = [T];

export interface PoolConnection {
  query<T = RowDataPacket[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  execute<T = ResultSetHeader[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export type CompatiblePool = {
  query<T = RowDataPacket[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  execute<T = ResultSetHeader[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  connect(): Promise<PoolConnection & { release(): void }>;
};
