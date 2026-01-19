import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const EducationComplaint = sequelize.define(
  "education_complaints",
  {
    /* ================= PRIMARY ================= */

    complaint_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    /* ================= IDENTIFIER ================= */

    complaint_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Human readable complaint number",
    },

    /* ================= DISTRICT ================= */

    district: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "District name or code",
    },

    /* ================= LOCATION ================= */

    block: DataTypes.STRING(100),
    panchayat: DataTypes.STRING(100),
    village: DataTypes.STRING(100),

    /* ================= SCHOOL ================= */

  
institution_name: {
  type: DataTypes.STRING(255),
},

institution_code: {
  type: DataTypes.STRING(50),
},

institution_type: {
  type: DataTypes.STRING(50),
},

    /* ================= COMPLAINANT ================= */

    complainant_name: DataTypes.STRING(150),
    complainant_phone: DataTypes.STRING(20),

    complainant_email: {
      type: DataTypes.STRING,
      validate: { isEmail: true },
    },

    is_anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    /* ================= COMPLAINT ================= */

    complaint_title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    complaint_description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    attachments: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },

    /* ================= TIMING ================= */

    complaint_end_at: {
      type: DataTypes.DATE,
      comment: "When complaint was closed/resolved",
    },

    /* ================= STATUS ================= */

    current_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "PENDING",
      comment: "Lifecycle status of the complaint",
    },

    priority_level: {
      type: DataTypes.STRING(50),
      defaultValue: "MEDIUM",
    },

    resolution_details: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },

    status_history: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
  },
  {
    tableName: "education_complaints",
    timestamps: true, // createdAt, updatedAt

    /* ================= INDEXES ================= */

    indexes: [
      { unique: true, fields: ["complaint_number"] },
      { fields: ["district"] },
      { fields: ["current_status"] },
      { fields: ["priority_level"] },
      { fields: ["createdAt"] },
    ],

    /* ================= VALIDATION ================= */

    validate: {
      anonymousComplaintRules() {
        if (this.is_anonymous) {
          if (
            this.complainant_name ||
            this.complainant_phone ||
            this.complainant_email
          ) {
            throw new Error(
              "Anonymous complaint cannot contain complainant details"
            );
          }
        }
      },
    },
  }
);

export default EducationComplaint;
