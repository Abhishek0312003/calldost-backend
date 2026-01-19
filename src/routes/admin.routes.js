import express from "express";

import {
  createAdmin,
  getAllAdminsWithDistricts,
  getAdminByPublicUserId,
  getAdminDistrictComplaints,
  adminLoginEmailOtpRequest,
  adminLoginEmailOtpVerify,
  logoutAdmin,

  // ✅ EDUCATION
  adminUpdateEducationComplaint,
  adminCloseEducationComplaint,

  // ✅ HEALTH
  adminUpdateHealthComplaint,
  adminCloseHealthComplaint,
} from "../controllers/admin.controller.js";

import { isAuthenticated } from "../middlewares/isAuthenticated.middleware.js";
import { superAdminOnly } from "../middlewares/superAdminOnly.middleware.js";
import { adminOnly } from "../middlewares/adminOnly.middleware.js";

const AdminRouter = express.Router();

/* ============================================================
   ADMIN AUTH
============================================================ */

AdminRouter.post("/login/request-otp", adminLoginEmailOtpRequest);
AdminRouter.post("/login/verify-otp", adminLoginEmailOtpVerify);

AdminRouter.post(
  "/logout",
  isAuthenticated,
  adminOnly,
  logoutAdmin
);

/* ============================================================
   SUPER ADMIN
============================================================ */

AdminRouter.post(
  "/create",
  isAuthenticated,
  superAdminOnly,
  createAdmin
);

AdminRouter.get(
  "/get/admin/list",
  isAuthenticated,
  superAdminOnly,
  getAllAdminsWithDistricts
);

AdminRouter.get(
  "/get/:public_user_id",
  isAuthenticated,
  superAdminOnly,
  getAdminByPublicUserId
);

/* ============================================================
   ADMIN – DISTRICT COMPLAINTS
============================================================ */

AdminRouter.get(
  "/complaints",
  isAuthenticated,
  adminOnly,
  getAdminDistrictComplaints
);

/* ============================================================
   EDUCATION COMPLAINT ADMIN ACTIONS
============================================================ */

AdminRouter.patch(
  "/complaints/education/:complaint_number",
  isAuthenticated,
  adminOnly,
  adminUpdateEducationComplaint
);

AdminRouter.patch(
  "/complaints/education/:complaint_number/close",
  isAuthenticated,
  adminOnly,
  adminCloseEducationComplaint
);

/* ============================================================
   HEALTH COMPLAINT ADMIN ACTIONS
============================================================ */

AdminRouter.patch(
  "/complaints/health/:complaint_number",
  isAuthenticated,
  adminOnly,
  adminUpdateHealthComplaint
);

AdminRouter.patch(
  "/complaints/health/:complaint_number/close",
  isAuthenticated,
  adminOnly,
  adminCloseHealthComplaint
);

export default AdminRouter;
