export interface Datasource {
  id: string;
  name: string;
  type: string;
  typeName?: string;
  languages?: string[];
  family?: string;
  description?: string;
}

export interface Mapping {
  id: string;
  restId: string;
  mappingId: string;
  name: string;
  schemaId?: string;
  description?: string;
}

export interface Field {
  id: string;
  name: string;
  fieldId: string;
  dataType: string;
  rawType?: string;
  description?: string;
  isPk?: boolean;
  isFk?: boolean;
}

export interface QueryResult {
  records: Record<string, unknown>[];
  fields?: { name: string; dataType: string }[];
  total?: number;
  truncated?: boolean;
}

export interface QueryError {
  message: string;
  statusCode?: number;
}
