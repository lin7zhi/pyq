import dotenv from "dotenv";
import sequelize from "../config/database";

dotenv.config();

async function apply(statement: string, label: string) {
  try {
    await sequelize.query(statement);
    console.log(`Applied: ${label}`);
  } catch (error: any) {
    const message = String(error?.message || error);
    if (/duplicate column|already exists/i.test(message)) {
      console.log(`Already present: ${label}`);
      return;
    }
    throw error;
  }
}

/** Adds optional external image and Labs project-link fields to catalog cards. */
export async function migrateCatalogItemFields() {
  await apply(
    "ALTER TABLE catalog_items ADD COLUMN image_url VARCHAR(500) NOT NULL DEFAULT ''",
    "catalog_items.image_url"
  );
  await apply(
    "ALTER TABLE catalog_items ADD COLUMN link_url VARCHAR(2048) NOT NULL DEFAULT ''",
    "catalog_items.link_url"
  );
}

async function main() {
  try {
    await sequelize.authenticate();
    await migrateCatalogItemFields();
  } catch (error) {
    console.error("Catalog item fields migration failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
}

if (require.main === module) {
  void main();
}
