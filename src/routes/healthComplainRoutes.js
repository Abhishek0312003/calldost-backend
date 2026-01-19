import express from "express";
import {
  createHealthComplaint,
  verifyHealthComplaintAccess,
  updateHealthComplaintViaLink,
} from "../controllers/healthComplaint.controller.js";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const HealthComplaintRouter = express.Router();

HealthComplaintRouter.post(
  "/complaints/create",
  apiKeyAuth,
  createHealthComplaint
);

HealthComplaintRouter.get(
  "/access/:complaint_number",
  verifyHealthComplaintAccess
);

HealthComplaintRouter.patch(
  "/update/:complaint_number",
  upload.array("attachments", 5),
  updateHealthComplaintViaLink
);

export default HealthComplaintRouter;
