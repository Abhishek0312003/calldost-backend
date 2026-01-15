import express from "express";

import {
  createDistrict,
  createDistrictsBulk,
  getAllDistricts,
  getDistrictById,
  updateDistrict,
  deleteDistrict,
} from "../controllers/biharDistrict.controller.js";

import { isAuthenticated } from "../middlewares/isAuthenticated.middleware.js";
import { superAdminOnly } from "../middlewares/superAdminOnly.middleware.js";

const BiharDistrictRouter = express.Router();

/* ============================================================
   BIHAR DISTRICT MANAGEMENT
   Scope  : Super Admin
   Domain : Administration / Geography
============================================================ */

/* ================= CREATE DISTRICT ================= */

// Create single district
BiharDistrictRouter.post(
  "/create",
  isAuthenticated,
  superAdminOnly,
  createDistrict
);

/* ================= BULK CREATE DISTRICTS ================= */

BiharDistrictRouter.post(
  "/create-bulk",
  isAuthenticated,
  superAdminOnly,
  createDistrictsBulk
);

/* ================= LIST DISTRICTS ================= */

BiharDistrictRouter.get(
  "/get-all",

  getAllDistricts
);

/* ================= GET DISTRICT DETAILS ================= */

BiharDistrictRouter.get(
  "/get/:district_id",
  isAuthenticated,
  superAdminOnly,
  getDistrictById
);

/* ================= UPDATE DISTRICT ================= */

BiharDistrictRouter.put(
  "/update/:district_id",
  isAuthenticated,
  superAdminOnly,
  updateDistrict
);

/* ================= DELETE DISTRICT ================= */

BiharDistrictRouter.delete(
  "/delete/:district_id",
  isAuthenticated,
  superAdminOnly,
  deleteDistrict
);

export default BiharDistrictRouter;
