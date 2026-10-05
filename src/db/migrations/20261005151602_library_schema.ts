import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('genres')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(100)', (col) => col.notNull().unique())
    .execute();

  await db.schema
    .createTable('authors')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('first_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('last_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('birth_date', 'date')
    .addColumn('bio', 'text')
    .execute();

  await db.schema
    .createTable('borrowers')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull().unique()
    )
    .addColumn('card_number', 'varchar(50)', (col) => col.notNull().unique())
    .addColumn('phone', 'varchar(50)')
    .addColumn('max_active_loans', 'integer', (col) =>
      col.defaultTo(5).notNull()
    )
    .addColumn('fine_balance', 'numeric(10, 2)', (col) =>
      col.defaultTo(0).notNull()
    )
    .execute();

  await db.schema
    .createTable('books')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('genre_id', 'integer', (col) =>
      col.references('genres.id').onDelete('cascade').notNull()
    )
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('isbn', 'varchar(50)', (col) => col.notNull().unique())
    .addColumn('published_year', 'integer')
    .addColumn('total_copies', 'integer', (col) => col.defaultTo(1).notNull())
    .addColumn('available_copies', 'integer', (col) =>
      col.defaultTo(1).notNull()
    )
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .execute();

  await db.schema
    .createTable('loans')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('borrower_id', 'integer', (col) =>
      col.references('borrowers.id').onDelete('cascade').notNull()
    )
    .addColumn('book_id', 'integer', (col) =>
      col.references('books.id').onDelete('cascade').notNull()
    )
    .addColumn('loaned_at', 'timestamp', (col) =>
      col.defaultTo(sql`NOW()`).notNull()
    )
    .addColumn('due_date', 'date', (col) => col.notNull())
    .addColumn('returned_at', 'timestamp')
    .addColumn('fine_amount', 'numeric(10, 2)', (col) =>
      col.defaultTo(0).notNull()
    )
    .execute();

  await db.schema
    .createTable('book_authors')
    .addColumn('book_id', 'integer', (col) =>
      col.references('books.id').onDelete('cascade').notNull()
    )
    .addColumn('author_id', 'integer', (col) =>
      col.references('authors.id').onDelete('cascade').notNull()
    )
    .addColumn('author_order', 'integer', (col) => col.defaultTo(1).notNull())
    .addPrimaryKeyConstraint('book_authors_pkey', ['book_id', 'author_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('book_authors').execute();
  await db.schema.dropTable('loans').execute();
  await db.schema.dropTable('books').execute();
  await db.schema.dropTable('borrowers').execute();
  await db.schema.dropTable('authors').execute();
  await db.schema.dropTable('genres').execute();
}
