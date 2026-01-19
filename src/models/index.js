import Admin from "./admin.model.js";
import BiharDistrict from "./biharDistrict.model.js";
import SuperAdmin from "./superAdmin.model.js";
import EducationComplaint from "./biharDistrict.model.js";
/* ============================================================
   ASSOCIATIONS
============================================================ */

// Admin ↔ District
Admin.belongsTo(BiharDistrict, {
  foreignKey: "district_code_alpha",
  targetKey: "district_code_alpha",
  as: "district",
});

BiharDistrict.hasOne(Admin, {
  foreignKey: "district_code_alpha",
  sourceKey: "district_code_alpha",
  as: "admin",
});

// Admin ↔ Super Admin (creator)
Admin.belongsTo(SuperAdmin, {
  foreignKey: "created_by_super_admin_public_user_id",
  targetKey: "public_user_id",
  as: "created_by_super_admin",
});

SuperAdmin.hasMany(Admin, {
  foreignKey: "created_by_super_admin_public_user_id",
  sourceKey: "public_user_id",
  as: "created_admins",
});




EducationComplaint.belongsTo(BiharDistrict, {
    foreignKey: "district_code_alpha",
    targetKey: "district_code_alpha",
    as: "district",
  });
  
  BiharDistrict.hasMany(EducationComplaint, {
    foreignKey: "district_code_alpha",
    sourceKey: "district_code_alpha",
    as: "education_complaints",
  });
export {
  Admin,
  BiharDistrict,
  SuperAdmin,
};
