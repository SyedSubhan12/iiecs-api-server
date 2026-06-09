declare module 'pg' {
  export class Pool {
    constructor(config: any);
    query(query: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
  }
  
  export interface PoolConfig {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  }
  
  export interface QueryResult<T> {
    rows: T[];
    fields: any[];
    command: string;
    rowCount: number;
    oid?: number;
  }
  
  export interface QueryConfig<T> {
    text: string;
    values?: any[];
    rowMode?: 'array';
    name?: string;
  }
}