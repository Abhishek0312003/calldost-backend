import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Admin = sequelize.define('admins', {
  user_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  public_user_id: { type: DataTypes.STRING, unique: true },
  district: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true },
  phone_number: { type: DataTypes.STRING, unique: true },
  post: DataTypes.STRING,
  profile_photo_url: DataTypes.TEXT,
  password_hash: { type: DataTypes.TEXT, allowNull: false },
  password_change_history: DataTypes.JSON,
  login_details: DataTypes.JSON,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  timestamps: true,
});
export default Admin;
