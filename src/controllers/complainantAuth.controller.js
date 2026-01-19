import crypto from "crypto";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import { redis } from "../config/redis.js";
import fast2sms from "../utils/fast2sms.js";
import sendEmail from "../utils/sendEmail.js";
import { signAccessToken, signRefreshToken } from "../utils/token.js";

import HealthComplaint from "../models/healthComplaint.model.js";
import EducationComplaint from "../models/educationComplaint.model.js";

/* ============================================================
   HELPER — GET COMPLAINT TYPES
============================================================ */
const getComplaintTypesByPhone = async (phone_number) => {
  const types = [];

  if (
    await HealthComplaint.count({
      where: { complainant_phone: phone_number },
    })
  ) {
    types.push("HEALTH");
  }

  if (
    await EducationComplaint.count({
      where: { complainant_phone: phone_number },
    })
  ) {
    types.push("EDUCATION");
  }

  return types;
};

const getComplaintTypesByEmail = async (email) => {
  const types = [];

  if (
    await HealthComplaint.count({
      where: { complainant_email: email },
    })
  ) {
    types.push("HEALTH");
  }

  if (
    await EducationComplaint.count({
      where: { complainant_email: email },
    })
  ) {
    types.push("EDUCATION");
  }

  return types;
};

/* ============================================================
   PHONE LOGIN — REQUEST OTP
============================================================ */
export const complainantPhoneOtpRequest = catchAsyncError(
  async (req, res, next) => {
    const { phone_number } = req.body;

    if (!phone_number) {
      return next(new ErrorHandler("Phone number is required.", 400));
    }

    const exists =
      (await HealthComplaint.count({
        where: { complainant_phone: phone_number },
      })) +
      (await EducationComplaint.count({
        where: { complainant_phone: phone_number },
      }));

    if (!exists) {
      return next(
        new ErrorHandler("No complaint found with this phone number.", 404)
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const public_user_id =
      "CMP-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    await redis.set(
      `complainant_phone_otp:${phone_number}`,
      JSON.stringify({ otp, public_user_id }),
      { EX: 300 }
    );

    await fast2sms.sendSuperAdminCreatedSMS(
      phone_number,
      `Your complaint login OTP is ${otp}`
    );

    res.status(200).json({
      success: true,
      message: "OTP sent to your phone number.",
      otp_expires_in_seconds: 300,
    });
  }
);

/* ============================================================
   PHONE LOGIN — VERIFY OTP
============================================================ */
export const complainantPhoneOtpVerify = catchAsyncError(
  async (req, res, next) => {
    const { phone_number, otp } = req.body;

    if (!phone_number || !otp) {
      return next(
        new ErrorHandler("Phone number and OTP are required.", 400)
      );
    }

    const stored = await redis.get(
      `complainant_phone_otp:${phone_number}`
    );

    if (!stored) {
      return next(new ErrorHandler("OTP expired.", 400));
    }

    const { otp: savedOtp, public_user_id } = JSON.parse(stored);

    if (savedOtp !== otp) {
      return next(new ErrorHandler("Invalid OTP.", 400));
    }

    await redis.del(`complainant_phone_otp:${phone_number}`);

    const complaintTypes = await getComplaintTypesByPhone(phone_number);

    const payload = {
      public_user_id,
      role: "COMPLAINANT",
      phone_number,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await redis.set(
      `complainant_session:${public_user_id}`,
      JSON.stringify(payload),
      { EX: 604800 }
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        public_user_id,
        phone_number,
        complaint_types: complaintTypes,
      },
      accessToken,
      refreshToken,
    });
  }
);

/* ============================================================
   EMAIL LOGIN — REQUEST OTP
============================================================ */
export const complainantEmailOtpRequest = catchAsyncError(
  async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
      return next(new ErrorHandler("Email is required.", 400));
    }

    const exists =
      (await HealthComplaint.count({
        where: { complainant_email: email },
      })) +
      (await EducationComplaint.count({
        where: { complainant_email: email },
      }));

    if (!exists) {
      return next(
        new ErrorHandler("No complaint found with this email.", 404)
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const public_user_id =
      "CMP-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    await redis.set(
      `complainant_email_otp:${email}`,
      JSON.stringify({ otp, public_user_id }),
      { EX: 300 }
    );

    await sendEmail({
      email,
      subject: "Complaint Login Verification Code",
      template: "complainantLoginOtp.ejs",
      data: { otp },
    });

    res.status(200).json({
      success: true,
      message: "OTP sent to your email.",
      otp_expires_in_seconds: 300,
    });
  }
);

/* ============================================================
   EMAIL LOGIN — VERIFY OTP
============================================================ */
export const complainantEmailOtpVerify = catchAsyncError(
  async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(
        new ErrorHandler("Email and OTP are required.", 400)
      );
    }

    const stored = await redis.get(
      `complainant_email_otp:${email}`
    );

    if (!stored) {
      return next(new ErrorHandler("OTP expired.", 400));
    }

    const { otp: savedOtp, public_user_id } = JSON.parse(stored);

    if (savedOtp !== otp) {
      return next(new ErrorHandler("Invalid OTP.", 400));
    }

    await redis.del(`complainant_email_otp:${email}`);

    const complaintTypes = await getComplaintTypesByEmail(email);

    const payload = {
      public_user_id,
      role: "COMPLAINANT",
      email,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await redis.set(
      `complainant_session:${public_user_id}`,
      JSON.stringify(payload),
      { EX: 604800 }
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        public_user_id,
        email,
        complaint_types: complaintTypes,
      },
      accessToken,
      refreshToken,
    });
  }
);
