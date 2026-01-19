import express from "express";
import {
  createEducationComplaint,
  verifyComplaintAccess,
  updateComplaintViaLink,
} from "../controllers/educationComplaint.controller.js";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const EducationComplaintRouter = express.Router();

/* ============================================================
   CREATE EDUCATION COMPLAINT
============================================================ */
EducationComplaintRouter.post(
  "/complaints/create",
  apiKeyAuth,
  createEducationComplaint
);

/* ============================================================
   VERIFY COMPLAINT ACCESS
============================================================ */
EducationComplaintRouter.get(
  "/access/:complaint_number",
  verifyComplaintAccess
);

/* ============================================================
   UPDATE COMPLAINT (24H LINK)
============================================================ */
EducationComplaintRouter.patch(
  "/update/:complaint_number",
  upload.array("attachments", 5),
  updateComplaintViaLink
);

export default EducationComplaintRouter;
