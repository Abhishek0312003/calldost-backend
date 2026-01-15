import express from "express";
import multer from "multer";

import {
  createSuperAdmin,
  loginUsingEmailOtpRequest,
  loginUsingEmailOtpVerify,
  loginUsingPhoneOtpRequest,
  loginUsingPhoneOtpVerify,
  forgotPasswordEmailOtpRequest,
  forgotPasswordEmailOtpVerify,
} from "../controllers/superAdmin.controller.js";

const upload = multer({ storage: multer.memoryStorage() });
const SuperAdminRouter = express.Router();

/* ============================================================
   SUPER ADMIN ROUTES
============================================================ */

// CREATE SUPER ADMIN
SuperAdminRouter.post(
  "/create",
  upload.single("profile_photo"),
  createSuperAdmin
);

/* ================= EMAIL LOGIN (PASSWORD + OTP) ================= */

// Step 1: Email + Password → OTP
SuperAdminRouter.post(
  "/login/email-otp/request",
  loginUsingEmailOtpRequest
);

// Step 2: Verify OTP → Login
SuperAdminRouter.post(
  "/login/email-otp/verify",
  loginUsingEmailOtpVerify
);

/* ================= PHONE LOGIN (OTP ONLY) ================= */

// Step 1: Phone → OTP
SuperAdminRouter.post(
  "/login/phone-otp/request",
  loginUsingPhoneOtpRequest
);

// Step 2: Verify OTP → Login
SuperAdminRouter.post(
  "/login/phone-otp/verify",
  loginUsingPhoneOtpVerify
);

/* ================= FORGOT PASSWORD ================= */

// Step 1: Email → OTP
SuperAdminRouter.post(
  "/forgot-password/email-otp/request",
  forgotPasswordEmailOtpRequest
);

// Step 2: Verify OTP + New Password
SuperAdminRouter.post(
  "/forgot-password/email-otp/verify",
  forgotPasswordEmailOtpVerify
);


export default SuperAdminRouter;
