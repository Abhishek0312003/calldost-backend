import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const ApiKey = sequelize.define('api_keys', {
  api_key_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  key_name: DataTypes.STRING,
  api_key_hash: DataTypes.TEXT,
  permissions: DataTypes.JSON,
  last_used_at: DataTypes.DATE,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: true });

export default ApiKey;
