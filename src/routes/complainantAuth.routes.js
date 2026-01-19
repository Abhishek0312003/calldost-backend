import express from "express";

import {
  complainantPhoneOtpRequest,
  complainantPhoneOtpVerify,
  complainantEmailOtpRequest,
  complainantEmailOtpVerify,
} from "../controllers/complainantAuth.controller.js";



const ComplainantAuthRouter = express.Router();

/* ============================================================
   COMPLAINANT AUTHENTICATION
   Scope  : Complainant (Health / Education)
   Domain : Complaint Login & Access
============================================================ */

/* ================= PHONE LOGIN ================= */

// Request OTP via phone number
ComplainantAuthRouter.post(
  "/login/phone/otp-request",
  complainantPhoneOtpRequest
);

// Verify phone OTP & login
ComplainantAuthRouter.post(
  "/login/phone/otp-verify",
  complainantPhoneOtpVerify
);

/* ================= EMAIL LOGIN ================= */

// Request OTP via email
ComplainantAuthRouter.post(
  "/login/email/otp-request",
  complainantEmailOtpRequest
);

// Verify email OTP & login
ComplainantAuthRouter.post(
  "/login/email/otp-verify",
  complainantEmailOtpVerify
);


export default ComplainantAuthRouter;
