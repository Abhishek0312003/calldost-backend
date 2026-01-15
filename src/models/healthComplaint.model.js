import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const HealthComplaint = sequelize.define('health_complaints', {
  complaint_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  complaint_number: { type: DataTypes.STRING, unique: true },
  district: { type: DataTypes.STRING, allowNull: false },
  facility_name: DataTypes.STRING,
  facility_type: DataTypes.STRING,
  mentioned_persons: DataTypes.JSON,
  complainant_name: DataTypes.STRING,
  complainant_phone: DataTypes.STRING,
  complainant_email: DataTypes.STRING,
  is_anonymous: { type: DataTypes.BOOLEAN, defaultValue: false },
  complaint_title: DataTypes.STRING,
  complaint_description: DataTypes.TEXT,
  attachments: DataTypes.JSON,
  current_status: DataTypes.STRING,
  priority_level: DataTypes.STRING,
  resolution_details: DataTypes.JSON,
  status_history: DataTypes.JSON,
}, { timestamps: true });

export default HealthComplaint;
