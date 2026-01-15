import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import crypto from "crypto";

const SuperAdmin = sequelize.define(
  "super_admins",
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    public_user_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      defaultValue: () =>
        "SA-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: "Email is required" },
        isEmail: { msg: "Invalid email format" },
      },
    },

    phone_number: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },

    send_whatsapp_notification: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    whatsapp_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    post: DataTypes.STRING,

    profile_photo_url: DataTypes.TEXT,

    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    password_change_history: DataTypes.JSON,

    login_details: DataTypes.JSON,

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,

    hooks: {
      beforeCreate: (superAdmin) => {
        if (!superAdmin.public_user_id) {
          superAdmin.public_user_id =
            "SA-" + crypto.randomBytes(4).toString("hex").toUpperCase();
        }
      },
    },

    validate: {
      whatsappNumberRequiredIfEnabled() {
        if (this.send_whatsapp_notification && !this.whatsapp_number) {
          throw new Error(
            "WhatsApp number is required when WhatsApp notifications are enabled"
          );
        }
      },
    },
  }
);

export default SuperAdmin;
