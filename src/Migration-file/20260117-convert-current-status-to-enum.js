import sequelize from "../config/db.js";

async function migrate() {
  console.log("🚀 Starting ENUM migration...");

  // 1️⃣ Drop default first
  await sequelize.query(`
    ALTER TABLE education_complaints
    ALTER COLUMN current_status DROP DEFAULT;
  `);

  // 2️⃣ Create ENUM type safely
  await sequelize.query(`
    DO $$
    BEGIN
      CREATE TYPE enum_education_complaints_current_status AS ENUM (
        'PENDING',
        'ACKNOWLEDGED',
        'IN_PROGRESS',
        'ON_HOLD',
        'RESOLVED',
        'REJECTED',
        'ESCALATED'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END$$;
  `);

  // 3️⃣ Convert column
  await sequelize.query(`
    ALTER TABLE education_complaints
    ALTER COLUMN current_status
    TYPE enum_education_complaints_current_status
    USING current_status::enum_education_complaints_current_status;
  `);

  // 4️⃣ Restore default
  await sequelize.query(`
    ALTER TABLE education_complaints
    ALTER COLUMN current_status SET DEFAULT 'PENDING';
  `);

  // 5️⃣ Enforce NOT NULL
  await sequelize.query(`
    ALTER TABLE education_complaints
    ALTER COLUMN current_status SET NOT NULL;
  `);

  console.log("✅ ENUM migration completed successfully");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ ENUM migration failed:", err);
  process.exit(1);
});
