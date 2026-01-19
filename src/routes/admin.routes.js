import express from "express";

import {
  createAdmin,
  getAllAdminsWithDistricts,
  getAdminByPublicUserId,
  getAdminDistrictComplaints,
  adminUpdateComplaint, // ✅ ADD THIS
} from "../controllers/admin.controller.js";

import {
  adminLoginEmailOtpRequest,
  adminLoginEmailOtpVerify,
  logoutAdmin,
  adminCloseComplaint
} from "../controllers/admin.controller.js";

import { isAuthenticated } from "../middlewares/isAuthenticated.middleware.js";
import { superAdminOnly } from "../middlewares/superAdminOnly.middleware.js";
import { adminOnly } from "../middlewares/adminOnly.middleware.js";

const AdminRouter = express.Router();

/* ============================================================
   ADMIN AUTH ROUTES
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
   SUPER ADMIN ROUTES
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
   ADMIN COMPLAINT ROUTES (DISTRICT SCOPED)
============================================================ */

/**
 * GET complaints of admin's district
 * GET /api/v1/admin/complaints
 */
AdminRouter.get(
  "/complaints",
  isAuthenticated,
  adminOnly,
  getAdminDistrictComplaints
);

/**
 * UPDATE complaint (status, resolution, attachments)
 * PATCH /api/v1/admin/complaints/:complaint_number
 */
AdminRouter.patch(
  "/complaints/:complaint_number",
  isAuthenticated,
  adminOnly,
  adminUpdateComplaint
);


AdminRouter.patch(
    "/complaints/:complaint_number/close",
    isAuthenticated,
    adminOnly,
    adminCloseComplaint
  );

export default AdminRouter;
