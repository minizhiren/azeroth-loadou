import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const packages = sqliteTable("packages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  uploader: text("uploader").notNull(),
  note: text("note").notNull().default(""),
  gameVersion: text("game_version").notNull().default("retail"),
  sizeBytes: integer("size_bytes").notNull(),
  totalParts: integer("total_parts").notNull(),
  sha256: text("sha256").notNull(),
  status: text("status").notNull().default("uploading"),
  downloadCount: integer("download_count").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_packages_status_created_at").on(table.status, table.createdAt),
]);
