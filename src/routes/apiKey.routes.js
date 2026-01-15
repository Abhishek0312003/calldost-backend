import express from "express";

import {
  createApiKey,
  getAllApiKeys,
  getApiKeyById,
  updateApiKey,
  deleteApiKey,
} from "../controllers/apiKey.controller.js";
import { superAdminOnly } from "../middlewares/superAdminOnly.middleware.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.middleware.js";


const ApiKeyRouter = express.Router();

/* ============================================================
   ADMIN API KEY MANAGEMENT
   Scope  : Super Admin
   Domain : Access / Integrations / Security
============================================================ */

/* ================= CREATE API KEY ================= */
/* POST /api/admin/api-keys */
ApiKeyRouter.post(
  "/create",
  isAuthenticated,
  superAdminOnly,
  createApiKey
);

/* ================= LIST API KEYS ================= */
/* GET /api/admin/api-keys */
ApiKeyRouter.get(
  "/get-all",
  isAuthenticated,
  superAdminOnly,
  getAllApiKeys
);

/* ================= GET API KEY DETAILS ================= */
/* GET /api/admin/api-keys/:api_key_id */
ApiKeyRouter.get(
  "/get/:api_key_id",
  isAuthenticated,
  superAdminOnly,
  getApiKeyById
);

/* ================= UPDATE API KEY ================= */
/* PUT /api/admin/api-keys/:api_key_id */
ApiKeyRouter.put(
  "/update/:api_key_id",
  isAuthenticated,
  superAdminOnly,
  updateApiKey
);

/* ================= REVOKE / DELETE API KEY ================= */
/* DELETE /api/admin/api-keys/:api_key_id */
ApiKeyRouter.delete(
  "/control/:api_key_id",
  isAuthenticated,
  superAdminOnly,
  deleteApiKey
);

export default ApiKeyRouter;
