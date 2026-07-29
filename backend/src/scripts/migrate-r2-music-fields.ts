import dotenv from "dotenv";
import { QueryTypes } from "sequelize";
import sequelize from "../config/database";

dotenv.config();

async function columnExists(table: string, column: string) {
  const rows = await sequelize.query<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { replacements: { table, column }, type: QueryTypes.SELECT }
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(table: string, indexName: string) {
  const rows = await sequelize.query<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :indexName`,
    { replacements: { table, indexName }, type: QueryTypes.SELECT }
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function addColumn(sql: string, table: string, column: string) {
  if (await columnExists(table, column)) {
    console.log(`Already present: ${table}.${column}`);
    return;
  }
  await sequelize.query(sql);
  console.log(`Applied: ${table}.${column}`);
}

/** Adds the music fields required by the R2 playlist without using sync alter. */
export async function migrateR2MusicFields() {
  const mediaKindMissing = !(await columnExists("media", "kind"));
  await addColumn(
    "ALTER TABLE media ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'file'",
    "media",
    "kind"
  );
  await addColumn(
    "ALTER TABLE music_tracks ADD COLUMN lyric_media_id CHAR(36) NULL",
    "music_tracks",
    "lyric_media_id"
  );

  if (mediaKindMissing) {
    await sequelize.query(
      `UPDATE media
       SET kind = CASE
         WHEN mime_type LIKE 'image/%' THEN 'image'
         WHEN mime_type LIKE 'video/%' THEN 'video'
         WHEN mime_type LIKE 'audio/%' THEN 'audio'
         WHEN LOWER(filename) LIKE '%.lrc' THEN 'lyric'
         ELSE 'file'
       END`
    );
  } else {
    await sequelize.query("UPDATE media SET kind = 'file' WHERE kind IS NULL OR kind = ''");
  }
  await sequelize.query(
    "UPDATE media SET kind = 'lyric' WHERE kind = 'file' AND LOWER(filename) LIKE '%.lrc'"
  );
  await sequelize.query("UPDATE music_tracks SET lrc = '' WHERE lrc IS NULL").catch(() => {});

  if (!(await indexExists("music_tracks", "music_tracks_lyric_media_id"))) {
    await sequelize.query("CREATE INDEX music_tracks_lyric_media_id ON music_tracks (lyric_media_id)");
    console.log("Applied: music_tracks.lyric_media_id index");
  } else {
    console.log("Already present: music_tracks.lyric_media_id index");
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    await migrateR2MusicFields();
  } catch (error) {
    console.error("R2 music fields migration failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
}

if (require.main === module) void main();
