---
name: kysely-migration-generator
description: Reads a Mermaid ERD (docs/architecture/schema.mmd, or the compiled docs/architecture/erd.svg) and translates it into a type-safe Kysely PostgreSQL migration in src/db/migrations/ with up and down functions, then type-checks and runs it. Use when asked to generate, write, or create a database migration, Kysely migration, tables, or DDL from an ERD, Mermaid diagram, schema.mmd, or data model.
---

# Kysely Migration Generator

Translate a Mermaid `erDiagram` into one Kysely migration file. Never report success until
`npm run build` and `npm run migrate:up` both pass.

## Inputs and reference

1. Read `docs/architecture/schema.mmd`. Only if it is missing, read `docs/architecture/erd.svg` and recover entities, attributes, and relationships from its text labels.
2. Read every file in `src/db/migrations/`. `001_initial_schema.ts` is the style baseline (`serial` ids, `varchar(255)`, `sql\`NOW()\`` defaults) and shows which tables already exist.
3. Read `src/db/migrator.ts` only if a run fails.

## Translation rules

### Entities to tables

- Each Mermaid entity becomes one table named in lower `snake_case`: `USERS` to `users`, `BOOK_AUTHORS` to `book_authors`, `LoanItems` to `loan_items`. Keep the plurality used in the diagram.
- **Existing tables are not recreated.** A table is existing if it is listed in a `%% existing:` comment in the `.mmd` file or is created by any file already in `src/db/migrations/` (for example `users`). Reference it in foreign keys, but never create, alter, or drop it.
- Column names stay as written, converted to `snake_case` if needed.

### Data types

| Mermaid type | Kysely data type |
|---|---|
| `int` (non-key) | `'integer'` |
| `bigint` | `'bigint'` |
| `uuid` | `'uuid'` |
| `varchar(N)` / `string` | `'varchar(N)'` (`'varchar(255)'` if no length) |
| `text` | `'text'` |
| `boolean` / `bool` | `'boolean'` |
| `date` | `'date'` |
| `timestamp` / `datetime` | `'timestamp'` |
| `decimal` / `numeric` / `money` | `'numeric(10, 2)'` |
| `float` / `double` | `'double precision'` |

### Keys and columns

- **Primary key, `int id PK`**: `.addColumn('id', 'serial', (col) => col.primaryKey())`
- **Primary key, `uuid id PK`**: `.addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql\`gen_random_uuid()\`))`
- **Composite PK** (two attributes marked `PK` in one entity, as in junction tables): add the columns without `.primaryKey()`, then `.addPrimaryKeyConstraint('<table>_pkey', ['col_a', 'col_b'])`.
- **Foreign key (`FK`)**: the column type must match the referenced PK. A `serial` PK is referenced with `'integer'`, a `uuid` PK with `'uuid'`. Every FK uses this form:
  ```ts
  .addColumn('genre_id', 'integer', (col) =>
    col.references('genres.id').onDelete('cascade').notNull()
  )
  ```
  Find the referenced table from the relationship line that connects the two entities. The parent is the side with `||`.
- **Unique (`UK`)**: add `.unique()`. For several unique columns that are unique only together, use `.addUniqueConstraint('<table>_<cols>_unique', [...])`.
- **Nullability**: every column is `.notNull()` unless its Mermaid comment contains `optional` (or `nullable`). PK columns never get an explicit `.notNull()`.
- **Defaults** from a `"default X"` comment: `default now` becomes `.defaultTo(sql\`NOW()\`)`; numbers and booleans become `.defaultTo(0)` or `.defaultTo(false)`; strings become `.defaultTo('value')`. A `created_at timestamp` column with no comment gets `.defaultTo(sql\`NOW()\`).notNull()`, matching the baseline.

### Cardinalities

| Mermaid | Meaning | Kysely |
|---|---|---|
| `A ||--o{ B` | one-to-many | FK column on `B` referencing `a.id`, `.notNull()` |
| `A ||--|{ B` | one-to-many (at least one) | same as above (the "at least one" rule cannot be enforced in DDL; mention it in your reply) |
| `A ||--o| B` | one-to-one | FK column on `B` referencing `a.id`, `.notNull().unique()` |
| `A |o--o{ B` | optional parent | FK column on `B` without `.notNull()` |
| `A }o--o{ B` | many-to-many | create a junction table `a_b` with two FKs and a composite PK, even if the diagram did not draw one |

If the FK column on a one-to-one relationship is missing a `UK` marker, still add `.unique()`. The cardinality wins.

## File output

- Path: `src/db/migrations/<timestamp>_<migration_name>.ts`
- `<timestamp>` is the current UTC time as `YYYYMMDDHHmmss` (get it with `date -u +%Y%m%d%H%M%S`). Kysely runs migrations in alphabetical order, and this keeps new files after `001_initial_schema`.
- `<migration_name>` is short `snake_case` describing the change, for example `library_schema`.
- Never edit or rename an existing migration file.

## Required structure

```ts
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // createTable calls, parents before children
}

export async function down(db: Kysely<any>): Promise<void> {
  // dropTable calls, exact reverse order of up
}
```

- Export both `up(db: Kysely<any>)` and `down(db: Kysely<any>)`, each `async` and returning `Promise<void>`. Every builder chain ends with `.execute()` and is awaited.
- Import `sql` only when a default uses it.
- **Creation order (`up`)**: topological order. A table is created only after every table it references. Junction tables come last.
- **Drop order (`down`)**: the exact reverse of creation order, so children drop before parents. Do not drop existing tables (for example `users`).
- Name every table and constraint explicitly. Do not use `ifNotExists()`; a clean failure is better than a silent skip.

## Verification loop (up to 3 retries)

Run from the repository root, in order:

1. `npm run build`. On TypeScript errors, fix the migration file and re-run.
2. `npm run migrate:up`. This needs the Postgres container (`docker compose up -d`). If the database is not reachable, stop and tell the user to start it instead of editing code. On a SQL error, fix the migration and re-run. PostgreSQL rolls back a failed migration, so re-running is safe.
3. Optional round trip: `npm run migrate:down` then `npm run migrate:up` confirms the `down` order works.

After 3 failed retries, stop and show the user the last error.

## Final output

Reply with:

1. The migration file path.
2. A table showing each Mermaid entity, its table name, and its foreign keys.
3. The creation order and drop order.
4. The `npm run build` and `npm run migrate:up` results.
