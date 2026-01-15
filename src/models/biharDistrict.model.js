import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const BiharDistrict = sequelize.define(
  "bihar_districts",
  {
    district_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    district_code_alpha: {
      type: DataTypes.STRING(5),
      allowNull: false,
      comment: "Alphabetical district code (e.g. AW, AR)",
    },

    district_code_numeric: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Numeric district code (e.g. 9274)",
    },

    district_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    assigned_admin_public_user_ids: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "bihar_districts",
    timestamps: true,

    // ✅ UNIQUE handled correctly here
    indexes: [
      {
        unique: true,
        fields: ["district_code_alpha"],
      },
      {
        unique: true,
        fields: ["district_code_numeric"],
      },
      {
        unique: true,
        fields: ["district_name"],
      },
    ],
  }
);

export default BiharDistrict;
