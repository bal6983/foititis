export type ColumnType = 'uuid' | 'text' | 'smallint' | 'boolean' | 'timestamptz' | 'text[]';

export type TableColumn = {
  name: string;
  type: ColumnType;
  nullable: boolean;
  hasDefault: boolean;
  fk?: { table: string; column: string };
};

export type TableDef = {
  name: string;
  pk: string;
  columns: TableColumn[];
  displayColumns: string[];
};

export const tables: Record<string, TableDef> = {
  profiles: {
    name: 'profiles',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: false, fk: { table: 'auth.users', column: 'id' } },
      { name: 'display_name', type: 'text', nullable: true, hasDefault: false },
      { name: 'full_name', type: 'text', nullable: true, hasDefault: false },
      { name: 'email', type: 'text', nullable: true, hasDefault: false },
      { name: 'university_email', type: 'text', nullable: true, hasDefault: false },
      { name: 'university', type: 'text', nullable: true, hasDefault: false },
      { name: 'school', type: 'text', nullable: true, hasDefault: false },
      { name: 'department', type: 'text', nullable: true, hasDefault: false },
      { name: 'study_year', type: 'smallint', nullable: true, hasDefault: false },
      { name: 'onboarding_completed', type: 'boolean', nullable: false, hasDefault: true },
      { name: 'is_verified_student', type: 'boolean', nullable: false, hasDefault: true },
      { name: 'is_pre_student', type: 'boolean', nullable: false, hasDefault: true },
      { name: 'verification_status', type: 'text', nullable: true, hasDefault: false },
      { name: 'avatar_url', type: 'text', nullable: true, hasDefault: false },
      { name: 'city_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'cities', column: 'id' } },
      { name: 'university_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'universities', column: 'id' } },
      { name: 'school_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'schools', column: 'id' } },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
      { name: 'updated_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'display_name', 'email', 'is_verified_student', 'is_pre_student', 'created_at'],
  },

  listings: {
    name: 'listings',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'title', type: 'text', nullable: false, hasDefault: false },
      { name: 'description', type: 'text', nullable: false, hasDefault: false },
      { name: 'price', type: 'text', nullable: false, hasDefault: false },
      { name: 'category', type: 'text', nullable: false, hasDefault: false },
      { name: 'condition', type: 'text', nullable: false, hasDefault: false },
      { name: 'location', type: 'text', nullable: false, hasDefault: false },
      { name: 'seller_id', type: 'uuid', nullable: false, hasDefault: false, fk: { table: 'profiles', column: 'id' } },
      { name: 'category_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'categories', column: 'id' } },
      { name: 'location_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'locations', column: 'id' } },
      { name: 'condition_rating', type: 'smallint', nullable: true, hasDefault: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'title', 'price', 'category', 'seller_id', 'created_at'],
  },

  wanted_listings: {
    name: 'wanted_listings',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'user_id', type: 'uuid', nullable: false, hasDefault: false, fk: { table: 'profiles', column: 'id' } },
      { name: 'title', type: 'text', nullable: false, hasDefault: false },
      { name: 'description', type: 'text', nullable: false, hasDefault: false },
      { name: 'category', type: 'text', nullable: false, hasDefault: false },
      { name: 'location', type: 'text', nullable: false, hasDefault: false },
      { name: 'category_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'categories', column: 'id' } },
      { name: 'location_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'locations', column: 'id' } },
      { name: 'condition_rating', type: 'smallint', nullable: true, hasDefault: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'title', 'category', 'user_id', 'created_at'],
  },

  conversations: {
    name: 'conversations',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'last_message_at', type: 'timestamptz', nullable: true, hasDefault: false },
    ],
    displayColumns: ['id', 'last_message_at'],
  },

  conversation_participants: {
    name: 'conversation_participants',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'conversation_id', type: 'uuid', nullable: false, hasDefault: false, fk: { table: 'conversations', column: 'id' } },
      { name: 'user_id', type: 'uuid', nullable: false, hasDefault: false, fk: { table: 'profiles', column: 'id' } },
      { name: 'last_read_at', type: 'timestamptz', nullable: true, hasDefault: false },
    ],
    displayColumns: ['id', 'conversation_id', 'user_id', 'last_read_at'],
  },

  messages: {
    name: 'messages',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'conversation_id', type: 'uuid', nullable: false, hasDefault: false, fk: { table: 'conversations', column: 'id' } },
      { name: 'sender_id', type: 'uuid', nullable: false, hasDefault: false, fk: { table: 'profiles', column: 'id' } },
      { name: 'content', type: 'text', nullable: false, hasDefault: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'conversation_id', 'sender_id', 'content', 'created_at'],
  },

  cities: {
    name: 'cities',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'name', type: 'text', nullable: false, hasDefault: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'name', 'created_at'],
  },

  universities: {
    name: 'universities',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'name', type: 'text', nullable: false, hasDefault: false },
      { name: 'city_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'cities', column: 'id' } },
      { name: 'email_domains', type: 'text[]', nullable: true, hasDefault: true },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'name', 'city_id', 'email_domains', 'created_at'],
  },

  schools: {
    name: 'schools',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'name', type: 'text', nullable: false, hasDefault: false },
      { name: 'university_id', type: 'uuid', nullable: true, hasDefault: false, fk: { table: 'universities', column: 'id' } },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'name', 'university_id', 'created_at'],
  },

  categories: {
    name: 'categories',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'name', type: 'text', nullable: false, hasDefault: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'name', 'created_at'],
  },

  locations: {
    name: 'locations',
    pk: 'id',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, hasDefault: true },
      { name: 'name', type: 'text', nullable: false, hasDefault: false },
      { name: 'created_at', type: 'timestamptz', nullable: false, hasDefault: true },
    ],
    displayColumns: ['id', 'name', 'created_at'],
  },
};

export function getTableNames(): string[] {
  return Object.keys(tables);
}

export function getTableDef(name: string): TableDef | undefined {
  return tables[name];
}

export function getEditableColumns(tableDef: TableDef): TableColumn[] {
  return tableDef.columns.filter((col) => !col.hasDefault || col.name === tableDef.pk);
}

export function getInsertableColumns(tableDef: TableDef): TableColumn[] {
  return tableDef.columns.filter((col) => !col.hasDefault);
}
