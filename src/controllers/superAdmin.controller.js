import SuperAdmin from "../models/superAdmin.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import { Op } from "sequelize";
import sendEmail from "../utils/sendEmail.js";
import { v2 as cloudinary } from "cloudinary";
import fast2sms from "../utils/fast2sms.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { redis } from "../config/redis.js";
import { signAccessToken, signRefreshToken } from "../utils/token.js";

/* ============================================================
   1️⃣ CREATE SUPER ADMIN
============================================================ */


export const createSuperAdmin = catchAsyncError(async (req, res, next) => {
  const { name, email, phone_number, post, password } = req.body;

  if (!name || !email || !password) {
    return next(
      new ErrorHandler(
        "Please provide all required details to create the account.",
        400
      )
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return next(
      new ErrorHandler("Please enter a valid email address.", 400)
    );
  }

  const existing = await SuperAdmin.findOne({
    where: {
      [Op.or]: [
        { email },
        phone_number ? { phone_number } : null,
      ].filter(Boolean),
    },
  });

  if (existing) {
    return next(
      new ErrorHandler(
        "An account already exists with the provided contact details.",
        409
      )
    );
  }

  /* ================= HASH PASSWORD ================= */
  const hashedPassword = await bcrypt.hash(password, 12);

  /* ================= PROFILE PHOTO ================= */
  let profile_photo_url = null;
  if (req.file?.buffer) {
    try {
      const upload = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "super_admin_profiles", resource_type: "image" },
          (err, result) => (err ? reject(err) : resolve(result))
        ).end(req.file.buffer);
      });
      profile_photo_url = upload.secure_url;
    } catch {
      // optional image
    }
  }

  const public_user_id =
    "SA-" + crypto.randomBytes(4).toString("hex").toUpperCase();

  const superAdmin = await SuperAdmin.create({
    public_user_id,
    name,
    email,
    phone_number: phone_number || null,
    post: post || null,
    password_hash: hashedPassword, // ✅ hashed here
    profile_photo_url,
    is_active: true,
  });

  sendEmail({
    email,
    subject: "Welcome to CALDOST – Super Admin Access",
    template: "superAdminCreated.ejs",
    data: { name: superAdmin.name },
  }).catch(() => {});

  if (phone_number) {
    fast2sms
      .sendSuperAdminCreatedSMS(phone_number, superAdmin.name)
      .catch(() => {});
  }

  res.status(201).json({
    success: true,
    message: "Super admin account has been created successfully.",
    data: {
      public_user_id: superAdmin.public_user_id,
      name: superAdmin.name,
      email: superAdmin.email,
      phone_number: superAdmin.phone_number,
      post: superAdmin.post,
      profile_photo_url: superAdmin.profile_photo_url,
      is_active: superAdmin.is_active,
    },
  });
});

/* ============================================================
   2️⃣ LOGIN STEP 1 — EMAIL + PASSWORD → SEND OTP
============================================================ */
export const loginUsingEmailOtpRequest = catchAsyncError(
  async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(
        new ErrorHandler(
          "Please enter your email and password to continue.",
          400
        )
      );
    }

    const superAdmin = await SuperAdmin.findOne({
      where: { email, is_active: true },
    });

    if (!superAdmin) {
      return next(
        new ErrorHandler(
          "Invalid login details. Please try again.",
          401
        )
      );
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      superAdmin.password_hash
    );

    if (!isPasswordValid) {
      return next(
        new ErrorHandler(
          "Invalid login details. Please try again.",
          401
        )
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await redis.set(
      `login_otp:${superAdmin.public_user_id}`,
      JSON.stringify({ otp }),
      { EX: 300 } // 5 minutes
    );

    await sendEmail({
      email: superAdmin.email,
      subject: "Your CALDOST Login Verification Code",
      template: "loginOtp.ejs",
      data: {
        name: superAdmin.name,
        otp,
      },
    });

    res.status(200).json({
      success: true,
      message:
        "A verification code has been sent to your email address.",
    });
  }
);

/* ============================================================
   3️⃣ LOGIN STEP 2 — VERIFY OTP → LOGIN
============================================================ */
export const loginUsingEmailOtpVerify = catchAsyncError(
  async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(
        new ErrorHandler(
          "Please enter the verification code to continue.",
          400
        )
      );
    }

    const superAdmin = await SuperAdmin.findOne({
      where: { email, is_active: true },
    });

    if (!superAdmin) {
      return next(
        new ErrorHandler(
          "Login session expired. Please login again.",
          401
        )
      );
    }

    const stored = await redis.get(
      `login_otp:${superAdmin.public_user_id}`
    );

    if (!stored) {
      return next(
        new ErrorHandler(
          "The verification code has expired. Please login again.",
          400
        )
      );
    }

    const { otp: savedOtp } = JSON.parse(stored);

    if (savedOtp !== otp) {
      return next(
        new ErrorHandler(
          "The verification code you entered is incorrect.",
          400
        )
      );
    }

    await redis.del(`login_otp:${superAdmin.public_user_id}`);

    superAdmin.login_details = {
      last_login_at: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    };
    await superAdmin.save();

    const sessionPayload = {
      public_user_id: superAdmin.public_user_id,
      is_super_admin: true,
    };

    const accessToken = signAccessToken(sessionPayload);
    const refreshToken = signRefreshToken(sessionPayload);

    await redis.set(
      `session:${superAdmin.public_user_id}`,
      JSON.stringify(sessionPayload),
      { EX: 604800 }
    );

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    res.status(200).json({
      success: true,
      message: "You have logged in successfully.",
      user: {
        public_user_id: superAdmin.public_user_id,
        name: superAdmin.name,
        email: superAdmin.email,
        phone_number: superAdmin.phone_number,
        post: superAdmin.post,
        profile_photo_url: superAdmin.profile_photo_url,
        is_active: superAdmin.is_active,
      },
      accessToken,
      refreshToken,
    });
  }
);



export const loginUsingPhoneOtpRequest = catchAsyncError(
  async (req, res, next) => {
    const { phone_number } = req.body;

    if (!phone_number) {
      return next(
        new ErrorHandler(
          "Please enter your registered phone number.",
          400
        )
      );
    }

    const superAdmin = await SuperAdmin.findOne({
      where: { phone_number, is_active: true },
    });

    if (!superAdmin) {
      return next(
        new ErrorHandler(
          "We could not find an active account with this phone number.",
          404
        )
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await redis.set(
      `phone_login_otp:${superAdmin.public_user_id}`,
      JSON.stringify({ otp }),
      { EX: 300 }
    );

    await fast2sms.sendSuperAdminCreatedSMS(
      phone_number,
      `Your CALDOST login OTP is ${otp}`
    );

    res.status(200).json({
      success: true,
      message:
        "A verification code has been sent to your phone number.",
    });
  }
);




export const loginUsingPhoneOtpVerify = catchAsyncError(
  async (req, res, next) => {
    const { phone_number, otp } = req.body;

    if (!phone_number || !otp) {
      return next(
        new ErrorHandler(
          "Please enter the verification code to continue.",
          400
        )
      );
    }

    const superAdmin = await SuperAdmin.findOne({
      where: { phone_number, is_active: true },
    });

    if (!superAdmin) {
      return next(
        new ErrorHandler(
          "Login session expired. Please try again.",
          401
        )
      );
    }

    const storedOtp = await redis.get(
      `phone_login_otp:${superAdmin.public_user_id}`
    );

    if (!storedOtp) {
      return next(
        new ErrorHandler(
          "The verification code has expired. Please login again.",
          400
        )
      );
    }

    const { otp: savedOtp } = JSON.parse(storedOtp);

    if (savedOtp !== otp) {
      return next(
        new ErrorHandler(
          "The verification code you entered is incorrect.",
          400
        )
      );
    }

    await redis.del(`phone_login_otp:${superAdmin.public_user_id}`);

    superAdmin.login_details = {
      last_login_at: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    };
    await superAdmin.save();

    const sessionPayload = {
      public_user_id: superAdmin.public_user_id,
      is_super_admin: true,
    };

    const accessToken = signAccessToken(sessionPayload);
    const refreshToken = signRefreshToken(sessionPayload);

    await redis.set(
      `session:${superAdmin.public_user_id}`,
      JSON.stringify(sessionPayload),
      { EX: 604800 }
    );

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    res.status(200).json({
      success: true,
      message: "You have logged in successfully.",
      user: {
        public_user_id: superAdmin.public_user_id,
        name: superAdmin.name,
        email: superAdmin.email,
        phone_number: superAdmin.phone_number,
        post: superAdmin.post,
        profile_photo_url: superAdmin.profile_photo_url,
        is_active: superAdmin.is_active,
      },
      accessToken,
      refreshToken,
    });
  }
);


/* ============================================================
   4️⃣ FORGOT PASSWORD — REQUEST OTP (EMAIL)
============================================================ */
/* ============================================================
   FORGOT PASSWORD — REQUEST OTP (EMAIL)
============================================================ */
export const forgotPasswordEmailOtpRequest = catchAsyncError(
  async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
      return next(
        new ErrorHandler(
          "Please enter your registered email address.",
          400
        )
      );
    }

    const superAdmin = await SuperAdmin.findOne({
      where: { email, is_active: true },
    });

    // Always return same response (security)
    if (!superAdmin) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a verification code has been sent.",
        otp_expires_in_seconds: 300,
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresInSeconds = 300;
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    await redis.set(
      `forgot_pwd_otp:${superAdmin.public_user_id}`,
      JSON.stringify({
        otp,
        expires_at: expiresAt,
      }),
      { EX: expiresInSeconds }
    );

    await sendEmail({
      email: superAdmin.email,
      subject: "CALDOST Password Reset Verification Code",
      template: "forgotPasswordOtp.ejs",
      data: {
        name: superAdmin.name,
        otp,
        expires_in_minutes: 5,
      },
    });

    res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a verification code has been sent.",
      otp_expires_in_seconds: expiresInSeconds,
    });
  }
);



/* ============================================================
   FORGOT PASSWORD — VERIFY OTP & RESET PASSWORD
============================================================ */
export const forgotPasswordEmailOtpVerify = catchAsyncError(
  async (req, res, next) => {
    const { email, otp, new_password } = req.body;

    if (!email || !otp || !new_password) {
      return next(
        new ErrorHandler(
          "Please provide all required details to reset your password.",
          400
        )
      );
    }

    if (new_password.length < 8) {
      return next(
        new ErrorHandler(
          "Your new password must be at least 8 characters long.",
          400
        )
      );
    }

    const superAdmin = await SuperAdmin.findOne({
      where: { email, is_active: true },
    });

    if (!superAdmin) {
      return next(
        new ErrorHandler(
          "The password reset session has expired. Please try again.",
          400
        )
      );
    }

    const redisKey = `forgot_pwd_otp:${superAdmin.public_user_id}`;
    const stored = await redis.get(redisKey);

    if (!stored) {
      return next(
        new ErrorHandler(
          "The verification code has expired. Please request a new one.",
          400
        )
      );
    }

    const { otp: savedOtp, expires_at } = JSON.parse(stored);

    if (Date.now() > expires_at) {
      await redis.del(redisKey);
      return next(
        new ErrorHandler(
          "The verification code has expired. Please request a new one.",
          400
        )
      );
    }

    if (savedOtp !== otp) {
      return next(
        new ErrorHandler(
          "The verification code you entered is incorrect.",
          400
        )
      );
    }

    // OTP is valid → delete it
    await redis.del(redisKey);

    // Update password
    const hashedPassword = await bcrypt.hash(new_password, 12);
    superAdmin.password_hash = hashedPassword;
    superAdmin.password_change_history = {
      changed_at: new Date().toISOString(),
      ip_address: req.ip,
    };

    await superAdmin.save();

    res.status(200).json({
      success: true,
      message:
        "Your password has been updated successfully. You can now log in using your new password.",
    });
  }
);


/* ============================================================
   LOGOUT — INVALIDATE SESSION
============================================================ */
export const logoutSuperAdmin = catchAsyncError(
  async (req, res, next) => {
    const { public_user_id } = req.user || {};

    if (!public_user_id) {
      return next(
        new ErrorHandler(
          "Unable to log out. Please try again.",
          400
        )
      );
    }

    // Remove session from Redis
    await redis.del(`session:${public_user_id}`);

    // Clear auth cookies
    res.clearCookie("access_token", {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    res.clearCookie("refresh_token", {
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    });

    res.status(200).json({
      success: true,
      message: "You have been logged out successfully.",
    });
  }
);
