import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const ApiKey = sequelize.define(
  "api_keys",
  {
    api_key_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    key_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Encrypted RAW api key (decryptable)
    api_key_encrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // Who created this API key
    created_by_public_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Permissions for this key
    permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },

    // Usage count (fast analytics)
    usage_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    // Full usage history
    usage_logs: {
      type: DataTypes.JSON,
      defaultValue: [],
      /*
        Example:
        [
          {
            used_at: "2026-01-15T10:30:00Z",
            used_by_public_user_id: "OU-92KDK3",
            ip: "192.168.1.1",
            user_agent: "PostmanRuntime/7.36.0"
          }
        ]
      */
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
  }
);

export default ApiKey;
