import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Admin = sequelize.define(
  "admins",
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    public_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Public identifier for Admin user",
    },

    created_by_super_admin_public_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Super Admin public_user_id who created this Admin",
    },

    district_code_alpha: {
      type: DataTypes.STRING(5),
      allowNull: false,
      comment: "Bihar district code (e.g. PA, AR)",
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },

    phone_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    post: DataTypes.STRING,

    profile_photo_url: DataTypes.TEXT,

    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    password_change_history: {
      type: DataTypes.JSON,
      defaultValue: [],
    },

    login_details: {
      type: DataTypes.JSON,
      defaultValue: {},
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "admins",
    timestamps: true,

   
    indexes: [
      { unique: true, fields: ["public_user_id"] },
      { unique: true, fields: ["email"] },
      { unique: true, fields: ["phone_number"] },

      { fields: ["district_code_alpha"] },
      { fields: ["created_by_super_admin_public_user_id"] },
    ],
  }
);

export default Admin;



