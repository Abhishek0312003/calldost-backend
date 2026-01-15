import express from "express";

import {
  createAdmin,
  // future-ready (optional)
  // getAllAdmins,
  // getAdminById,
  // updateAdmin,
  // deactivateAdmin,
} from "../controllers/admin.controller.js";

import { isAuthenticated } from "../middlewares/isAuthenticated.middleware.js";
import { superAdminOnly } from "../middlewares/superAdminOnly.middleware.js";

const AdminRouter = express.Router();

/* ============================================================
   ADMIN MANAGEMENT ROUTES
   Scope  : Super Admin
   Domain : Administration / District Governance
============================================================ */

/* ================= CREATE ADMIN ================= */
/*
  POST /api/v1/admins/create
  - One admin per district
  - Super Admin only
*/
AdminRouter.post(
  "/create",
  isAuthenticated,
  superAdminOnly,
  createAdmin
);



export default AdminRouter;
