import sequelize from "../config/db.js";
import Admin from "../models/admin.model.js";
import BiharDistrict from "../models/biharDistrict.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import EducationComplaint from "../models/educationComplaint.model.js";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import SuperAdmin from "../models/superAdmin.model.js";
import sendEmail from "../utils/sendEmail.js";
import { signAccessToken,signRefreshToken } from "../utils/token.js";
import { redis } from "../config/redis.js";
import fast2sms from "../utils/fast2sms.js";
/* ============================================================
   CREATE ADMIN (ONE ADMIN PER DISTRICT)
   Scope: Super Admin
============================================================ */

export const createAdmin = catchAsyncError(async (req, res, next) => {
  const {
    name,
    email,
    phone_number,
    district_code_alpha,
    password,
    post,
    profile_photo_url,
  } = req.body;

  /* ================= BASIC VALIDATION ================= */

  if (!name || !email || !district_code_alpha || !password) {
    return next(
      new ErrorHandler(
        "Name, email, password, and district are required",
        400
      )
    );
  }

  const transaction = await sequelize.transaction();

  try {
    /* ================= DISTRICT VALIDATION ================= */

    const district = await BiharDistrict.findOne({
      where: { district_code_alpha },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!district) {
      await transaction.rollback();
      return next(
        new ErrorHandler("Invalid district selected", 400)
      );
    }

    /* ================= ONE ADMIN PER DISTRICT ================= */

    if (district.assigned_admin_public_user_ids.length > 0) {
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "An admin is already assigned to this district",
          409
        )
      );
    }

    /* ================= EMAIL / PHONE UNIQUENESS ================= */

    const existingAdmin = await Admin.findOne({
      where: {
        [Op.or]: [
          { email },
          phone_number ? { phone_number } : null,
        ].filter(Boolean),
      },
      transaction,
    });

    if (existingAdmin) {
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "Admin with same email or phone number already exists",
          409
        )
      );
    }

    /* ================= CREATE ADMIN ================= */

    const password_hash = await bcrypt.hash(password, 12);

    const public_user_id =
      "AD-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const admin = await Admin.create(
      {
        public_user_id,
        name,
        email,
        phone_number,
        post,
        profile_photo_url,
        district_code_alpha,
        password_hash,
        created_by_super_admin_public_user_id:
          req.user.public_user_id,
      },
      { transaction }
    );

    /* ================= UPDATE DISTRICT ================= */

    district.assigned_admin_public_user_ids = [
      admin.public_user_id,
    ];

    await district.save({ transaction });

    /* ================= COMMIT ================= */

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Admin created and assigned to district successfully",
      admin: {
        public_user_id: admin.public_user_id,
        name: admin.name,
        email: admin.email,
        phone_number: admin.phone_number,
        district_code_alpha: admin.district_code_alpha,
        post: admin.post,
        is_active: admin.is_active,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});




/* ============================================================
   GET ALL ADMINS WITH THEIR DISTRICT
   Scope: Super Admin
============================================================ */

export const getAllAdminsWithDistricts = catchAsyncError(
  async (req, res) => {
    const admins = await Admin.findAll({
      attributes: [
        "user_id",
        "public_user_id",
        "name",
        "email",
        "phone_number",
        "post",
        "district_code_alpha",
        "is_active",
        "created_by_super_admin_public_user_id",
        "createdAt",
      ],
      include: [
        {
          model: BiharDistrict,
          as: "district",
          attributes: [
            "district_id",
            "district_code_alpha",
            "district_code_numeric",
            "district_name",
          ],
        },
        {
          model: SuperAdmin,
          as: "created_by_super_admin",
          attributes: [
            "public_user_id",
            "name",
            "email",
            "phone_number",
            "post",
            "is_active",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: admins.length,
      admins,
    });
  }
);

export const getAdminByPublicUserId = catchAsyncError(
    async (req, res, next) => {
      const { public_user_id } = req.params;
  
      if (!public_user_id) {
        return next(
          new ErrorHandler("Admin public_user_id is required", 400)
        );
      }
  
      const admin = await Admin.findOne({
        where: { public_user_id },
        attributes: [
          "user_id",
          "public_user_id",
          "name",
          "email",
          "phone_number",
          "post",
          "district_code_alpha",
          "is_active",
          "created_by_super_admin_public_user_id",
          "createdAt",
        ],
        include: [
          {
            model: BiharDistrict,
            as: "district",
            attributes: [
              "district_id",
              "district_code_alpha",
              "district_code_numeric",
              "district_name",
            ],
          },
          {
            model: SuperAdmin,
            as: "created_by_super_admin",
            attributes: [
              "public_user_id",
              "name",
              "email",
              "phone_number",
              "post",
              "is_active",
            ],
          },
        ],
      });
  
      if (!admin) {
        return next(
          new ErrorHandler("Admin not found", 404)
        );
      }
  
      res.status(200).json({
        success: true,
        admin,
      });
    }
  );





  // controllers/admin.complaints.controller.js



export const getAdminDistrictComplaints = catchAsyncError(
  async (req, res, next) => {
    const { district_code_alpha } = req.admin;

    /* ================= GET DISTRICT NAME ================= */
    const district = await BiharDistrict.findOne({
      where: { district_code_alpha },
      attributes: ["district_name"],
    });

    if (!district) {
      return next(
        new ErrorHandler("Admin district not found", 404)
      );
    }

    const districtName = district.district_name;

    /* ================= QUERY PARAMS ================= */
    const {
      status,
      priority,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (page - 1) * limit;

    /* ================= FILTER ================= */
    const where = {
      district: districtName, // 🔐 CORE SECURITY
    };

    if (status) {
      where.current_status = status;
    }

    if (priority) {
      where.priority_level = priority;
    }

    if (search) {
      where[Op.or] = [
        { complaint_number: { [Op.iLike]: `%${search}%` } },
        { complaint_title: { [Op.iLike]: `%${search}%` } },
        { institution_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    /* ================= FETCH ================= */
    const { rows, count } =
      await EducationComplaint.findAndCountAll({
        where,
        attributes: [
          "complaint_id",
          "complaint_number",
          "complaint_title",
          "district",
          "block",
          "institution_name",
          "current_status",
          "priority_level",
          "is_anonymous",
          "createdAt",
        ],
        order: [["createdAt", "DESC"]],
        limit: Number(limit),
        offset: Number(offset),
      });

    res.status(200).json({
      success: true,
      admin_district: districtName,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(count / limit),
      },
      complaints: rows,
    });
  }
);





export const adminLoginEmailOtpRequest = catchAsyncError(
    async (req, res, next) => {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return next(
          new ErrorHandler("Email and password are required.", 400)
        );
      }
  
      const admin = await Admin.findOne({
        where: { email, is_active: true },
      });
  
      if (!admin) {
        return next(
          new ErrorHandler("Invalid login credentials.", 401)
        );
      }
  
      const isValid = await bcrypt.compare(
        password,
        admin.password_hash
      );
  
      if (!isValid) {
        return next(
          new ErrorHandler("Invalid login credentials.", 401)
        );
      }
  
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
      await redis.set(
        `admin_login_otp:${admin.public_user_id}`,
        JSON.stringify({ otp }),
        { EX: 300 } // 5 minutes
      );
  
      await sendEmail({
        email: admin.email,
        subject: "CALDOST Admin Login Verification Code",
        template: "adminLoginOtp.ejs",
        data: {
          name: admin.name,
          otp,
        },
      });
  
      res.status(200).json({
        success: true,
        message:
          "A verification code has been sent to your email.",
        otp_expires_in_seconds: 300,
      });
    }
  );





  export const adminLoginEmailOtpVerify = catchAsyncError(
    async (req, res, next) => {
      const { email, otp } = req.body;
  
      if (!email || !otp) {
        return next(
          new ErrorHandler("Email and OTP are required.", 400)
        );
      }
  
      const admin = await Admin.findOne({
        where: { email, is_active: true },
      });
  
      if (!admin) {
        return next(
          new ErrorHandler("Login session expired.", 401)
        );
      }
  
      const stored = await redis.get(
        `admin_login_otp:${admin.public_user_id}`
      );
  
      if (!stored) {
        return next(
          new ErrorHandler("OTP expired. Please login again.", 400)
        );
      }
  
      const { otp: savedOtp } = JSON.parse(stored);
  
      if (savedOtp !== otp) {
        return next(
          new ErrorHandler("Invalid verification code.", 400)
        );
      }
  
      await redis.del(`admin_login_otp:${admin.public_user_id}`);
  
      /* ================= UPDATE LOGIN DETAILS ================= */
      admin.login_details = {
        last_login_at: new Date().toISOString(),
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
      };
      await admin.save();
  
      /* ================= TOKEN PAYLOAD ================= */
      const sessionPayload = {
        public_user_id: admin.public_user_id,
        is_admin: true,
        district_code_alpha: admin.district_code_alpha,
      };
  
      const accessToken = signAccessToken(sessionPayload);
      const refreshToken = signRefreshToken(sessionPayload);
  
      await redis.set(
        `session:${admin.public_user_id}`,
        JSON.stringify(sessionPayload),
        { EX: 60 * 60 * 24 * 7 } // 7 days
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
        message: "Admin logged in successfully.",
        user: {
          public_user_id: admin.public_user_id,
          name: admin.name,
          email: admin.email,
          phone_number: admin.phone_number,
          post: admin.post,
          district_code_alpha: admin.district_code_alpha,
          is_active: admin.is_active,
        },
        accessToken,
        refreshToken,
      });
    }
  );

  

  export const logoutAdmin = catchAsyncError(
    async (req, res, next) => {
      const { public_user_id } = req.user || {};
  
      if (!public_user_id) {
        return next(
          new ErrorHandler("Logout failed.", 400)
        );
      }
  
      await redis.del(`session:${public_user_id}`);
  
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
        message: "Logged out successfully.",
      });
    }
  );

  export const adminUpdateEducationComplaint = catchAsyncError(
    async (req, res, next) => {
      const { complaint_number } = req.params;
      let { status, resolution_note, final_resolution_note } = req.body;
      const admin = req.admin;
  
      resolution_note = resolution_note?.trim();
      final_resolution_note = final_resolution_note?.trim();
  
      if (!complaint_number) {
        return next(new ErrorHandler("Complaint number is required", 400));
      }
  
      if (
        !status &&
        !resolution_note &&
        !final_resolution_note &&
        !req.files?.length
      ) {
        return next(new ErrorHandler("Nothing to update", 400));
      }
  
      const complaint = await EducationComplaint.findOne({
        where: { complaint_number },
      });
  
      if (!complaint) {
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      /* ===== DISTRICT SECURITY ===== */
      const district = await BiharDistrict.findOne({
        where: { district_code_alpha: admin.district_code_alpha },
        attributes: ["district_name"],
      });
  
      if (!district || complaint.district !== district.district_name) {
        return next(new ErrorHandler("Access denied", 403));
      }
  
      /* ===== FINAL STATE CHECK ===== */
      const isClosed =
        complaint.current_status === "RESOLVED" ||
        complaint.current_status === "CLOSED";
  
      if (isClosed && status !== "IN_PROGRESS") {
        return next(
          new ErrorHandler(
            "Complaint already closed. Reopen before updating.",
            409
          )
        );
      }
  
      if (status) {
        const allowed = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"];
        if (!allowed.includes(status)) {
          return next(new ErrorHandler("Invalid status", 400));
        }
  
        complaint.current_status = status;
        complaint.complaint_end_at =
          status === "RESOLVED" ? new Date() : null;
      }
  
      if (resolution_note) {
        complaint.resolution_details = {
          ...(complaint.resolution_details || {}),
          timeline: [
            ...(complaint.resolution_details?.timeline || []),
            {
              note: resolution_note,
              by: admin.public_user_id,
              at: new Date().toISOString(),
            },
          ],
        };
      }
  
      if (final_resolution_note) {
        complaint.resolution_details = {
          ...(complaint.resolution_details || {}),
          final_note: final_resolution_note,
        };
      }
  
      if (req.files?.length) {
        const uploads = [];
        for (const file of req.files) {
          const upload = await uploadBuffer(
            file.buffer,
            "education_complaints/admin"
          );
          uploads.push({
            url: upload.secure_url.replace(
              "/upload/",
              "/upload/f_auto,q_auto/"
            ),
            public_id: upload.public_id,
            uploaded_by: admin.public_user_id,
            uploadedAt: new Date().toISOString(),
          });
        }
        complaint.attachments = [...complaint.attachments, ...uploads];
      }
  
      complaint.status_history.push({
        status: complaint.current_status,
        source: "ADMIN",
        by: admin.public_user_id,
        at: new Date().toISOString(),
      });
  
      await complaint.save();
  
      res.status(200).json({
        success: true,
        message: "Education complaint updated",
      });
    }
  );
  
  
  

  export const adminCloseEducationComplaint = catchAsyncError(
    async (req, res, next) => {
      const { complaint_number } = req.params;
      const { final_status, final_resolution_note } = req.body;
      const admin = req.admin;
  
      if (!["RESOLVED", "CLOSED"].includes(final_status)) {
        return next(
          new ErrorHandler("Final status must be RESOLVED or CLOSED", 400)
        );
      }
  
      const complaint = await EducationComplaint.findOne({
        where: { complaint_number },
      });
  
      if (!complaint) {
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      complaint.current_status = final_status;
      complaint.complaint_end_at = new Date();
  
      complaint.resolution_details = {
        ...(complaint.resolution_details || {}),
        final_note: final_resolution_note || null,
        closed_by: admin.public_user_id,
        closed_at: new Date().toISOString(),
      };
  
      complaint.status_history.push({
        status: final_status,
        source: "ADMIN",
        by: admin.public_user_id,
        at: new Date().toISOString(),
      });
  
      await complaint.save();
  
      res.status(200).json({
        success: true,
        message: "Education complaint closed",
      });
    }
  );
  



  export const adminCloseHealthComplaint = catchAsyncError(
    async (req, res, next) => {
      const { complaint_number } = req.params;
      const { final_status, final_resolution_note } = req.body;
      const admin = req.admin;
  
      if (!["RESOLVED", "CLOSED"].includes(final_status)) {
        return next(
          new ErrorHandler("Final status must be RESOLVED or CLOSED", 400)
        );
      }
  
      const complaint = await HealthComplaint.findOne({
        where: { complaint_number },
      });
  
      if (!complaint) {
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      complaint.current_status = final_status;
      complaint.complaint_end_at = new Date();
  
      complaint.resolution_details = {
        ...(complaint.resolution_details || {}),
        final_note: final_resolution_note || null,
        closed_by: admin.public_user_id,
        closed_at: new Date().toISOString(),
      };
  
      complaint.status_history.push({
        status: final_status,
        source: "ADMIN",
        by: admin.public_user_id,
        at: new Date().toISOString(),
      });
  
      await complaint.save();
  
      res.status(200).json({
        success: true,
        message: "Health complaint closed",
      });
    }
  );
  


  export const adminUpdateHealthComplaint = catchAsyncError(
    async (req, res, next) => {
      const { complaint_number } = req.params;
      let { status, resolution_note, final_resolution_note } = req.body;
      const admin = req.admin;
  
      const complaint = await HealthComplaint.findOne({
        where: { complaint_number },
      });
  
      if (!complaint) {
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      if (status) {
        const allowed = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"];
        if (!allowed.includes(status)) {
          return next(new ErrorHandler("Invalid status", 400));
        }
  
        complaint.current_status = status;
        complaint.complaint_end_at =
          status === "RESOLVED" ? new Date() : null;
      }
  
      if (resolution_note) {
        complaint.resolution_details = {
          ...(complaint.resolution_details || {}),
          timeline: [
            ...(complaint.resolution_details?.timeline || []),
            {
              note: resolution_note,
              by: admin.public_user_id,
              at: new Date().toISOString(),
            },
          ],
        };
      }
  
      if (final_resolution_note) {
        complaint.resolution_details.final_note = final_resolution_note;
      }
  
      if (req.files?.length) {
        const uploads = [];
        for (const file of req.files) {
          const upload = await uploadBuffer(
            file.buffer,
            "health_complaints/admin"
          );
          uploads.push({
            url: upload.secure_url.replace(
              "/upload/",
              "/upload/f_auto,q_auto/"
            ),
            uploaded_by: admin.public_user_id,
            uploadedAt: new Date().toISOString(),
          });
        }
        complaint.attachments.push(...uploads);
      }
  
      complaint.status_history.push({
        status: complaint.current_status,
        source: "ADMIN",
        by: admin.public_user_id,
        at: new Date().toISOString(),
      });
  
      await complaint.save();
  
      res.status(200).json({
        success: true,
        message: "Health complaint updated",
      });
    }
  );
  