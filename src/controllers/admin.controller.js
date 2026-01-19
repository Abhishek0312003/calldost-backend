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

  export const adminUpdateComplaint = catchAsyncError(
    async (req, res, next) => {
      console.log("[ADMIN_UPDATE_COMPLAINT] Request received", {
        complaint_number: req.params.complaint_number,
        body: req.body,
        admin: req.admin?.public_user_id,
      });
  
      const { complaint_number } = req.params;
      let { status, resolution_note, final_resolution_note } = req.body;
      const admin = req.admin;
  
      resolution_note = resolution_note?.trim();
      final_resolution_note = final_resolution_note?.trim();
  
      if (!complaint_number) {
        return next(new ErrorHandler("Complaint number is required", 400));
      }
  
      const hasUpdate =
        status ||
        resolution_note ||
        final_resolution_note ||
        req.files?.length;
  
      if (!hasUpdate) {
        return next(new ErrorHandler("Nothing to update", 400));
      }
  
      const complaint = await EducationComplaint.findOne({
        where: { complaint_number },
      });
  
      if (!complaint) {
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      console.log("[DB] Complaint fetched", {
        current_status: complaint.current_status,
        closed_at: complaint.resolution_details?.closed_at,
      });
  
      /* ================= DISTRICT SECURITY ================= */
  
      const district = await BiharDistrict.findOne({
        where: { district_code_alpha: admin.district_code_alpha },
        attributes: ["district_name"],
      });
  
      if (!district || complaint.district !== district.district_name) {
        return next(new ErrorHandler("Access denied for this complaint", 403));
      }
  
      /* ================= FINAL STATE CHECK ================= */
  
      const isHistoricallyClosed =
        complaint.current_status === "RESOLVED" ||
        complaint.current_status === "CLOSED" ||
        Boolean(complaint.resolution_details?.closed_at);
  
      if (isHistoricallyClosed) {
        // Only allowed action is explicit reopen
        if (status === "IN_PROGRESS") {
          console.log("[REOPEN] Complaint reopened by admin");
  
          complaint.current_status = "IN_PROGRESS";
          complaint.complaint_end_at = null;
  
          // 🔥 CRITICAL: clear closure metadata
          if (complaint.resolution_details) {
            delete complaint.resolution_details.closed_at;
            delete complaint.resolution_details.closed_by;
            delete complaint.resolution_details.final_note;
          }
        } else {
          return next(
            new ErrorHandler(
              "This complaint is already resolved or closed. Reopen it before making updates.",
              409
            )
          );
        }
      }
  
      /* ================= STATUS UPDATE ================= */
  
      if (status && complaint.current_status !== status) {
        const allowedStatuses = [
          "PENDING",
          "IN_PROGRESS",
          "RESOLVED",
          "REJECTED",
        ];
  
        if (!allowedStatuses.includes(status)) {
          return next(new ErrorHandler("Invalid complaint status", 400));
        }
  
        complaint.current_status = status;
  
        if (status === "RESOLVED") {
          complaint.complaint_end_at = new Date();
        }
      }
  
      /* ================= RESOLUTION NOTES ================= */
  
      if (resolution_note) {
        const lastNote =
          complaint.resolution_details?.timeline?.slice(-1)[0];
  
        if (lastNote?.note !== resolution_note) {
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
      }
  
      if (final_resolution_note) {
        complaint.resolution_details = {
          ...(complaint.resolution_details || {}),
          final_note: final_resolution_note,
        };
      }
  
      /* ================= ATTACHMENTS ================= */
  
      if (req.files?.length) {
        const uploads = [];
  
        for (const file of req.files) {
          try {
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
              uploadedAt: new Date().toISOString(),
              uploaded_by: admin.public_user_id,
            });
          } catch {}
        }
  
        if (uploads.length) {
          complaint.attachments = [
            ...(complaint.attachments || []),
            ...uploads,
          ];
        }
      }
  
      /* ================= AUDIT ================= */
  
      complaint.status_history = [
        ...(complaint.status_history || []),
        {
          status: complaint.current_status,
          at: new Date().toISOString(),
          source: "ADMIN",
          by: admin.public_user_id,
        },
      ];
  
      await complaint.save();
      console.log("[DB] Complaint updated successfully");
  
      /* ================= BACKGROUND NOTIFICATIONS ================= */
  
      const complainantName = complaint.complainant_name || "Citizen";
  
      if (complaint.complainant_email) {
        sendEmail({
          email: complaint.complainant_email,
          subject: `Complaint ${complaint.complaint_number} Updated`,
          template: "complaintStatusUpdate.ejs",
          data: {
            name: complainantName,
            complaint_number: complaint.complaint_number,
            status: complaint.current_status,
            note: resolution_note || final_resolution_note || null,
          },
        }).catch(() => {});
      }
  
      if (complaint.complainant_phone) {
        fast2sms
          .sendSuperAdminCreatedSMS(
            String(complaint.complainant_phone),
            complainantName
          )
          .catch(() => {});
      }
  
      /* ================= RESPONSE ================= */
  
      res.status(200).json({
        success: true,
        message: "Complaint updated successfully",
        complaint: {
          complaint_number: complaint.complaint_number,
          current_status: complaint.current_status,
          resolution_details: complaint.resolution_details,
        },
      });
    }
  );
  
  
  
  
  
  


  // controllers/admin.complaints.controller.js

  export const adminCloseComplaint = catchAsyncError(
    async (req, res, next) => {
      console.log("[ADMIN_CLOSE_COMPLAINT] Request received", {
        complaint_number: req.params.complaint_number,
        body: req.body,
        admin: req.admin?.public_user_id,
      });
  
      const { complaint_number } = req.params;
      const { final_status, final_resolution_note } = req.body;
      const admin = req.admin;
  
      /* ================= BASIC VALIDATION ================= */
  
      if (!complaint_number) {
        console.error("[VALIDATION] Missing complaint_number");
        return next(new ErrorHandler("Complaint number is required", 400));
      }
  
      if (!final_status) {
        console.error("[VALIDATION] Missing final_status");
        return next(new ErrorHandler("Final status is required", 400));
      }
  
      const allowedFinalStatuses = ["RESOLVED", "CLOSED"];
  
      if (!allowedFinalStatuses.includes(final_status)) {
        console.error("[VALIDATION] Invalid final_status", final_status);
        return next(
          new ErrorHandler("Final status must be RESOLVED or CLOSED", 400)
        );
      }
  
      /* ================= FETCH COMPLAINT ================= */
  
      const complaint = await EducationComplaint.findOne({
        where: { complaint_number },
      });
  
      if (!complaint) {
        console.error("[DB] Complaint not found", complaint_number);
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      console.log("[DB] Complaint fetched", {
        id: complaint.complaint_id,
        current_status: complaint.current_status,
        complainant_email: complaint.complainant_email,
        complainant_phone: complaint.complainant_phone,
      });
  
      /* ================= DISTRICT SECURITY ================= */
  
      const district = await BiharDistrict.findOne({
        where: { district_code_alpha: admin.district_code_alpha },
        attributes: ["district_name"],
      });
  
      if (!district || complaint.district !== district.district_name) {
        console.error("[SECURITY] District mismatch", {
          adminDistrict: district?.district_name,
          complaintDistrict: complaint.district,
        });
        return next(
          new ErrorHandler("Access denied for this complaint", 403)
        );
      }
  
      /* ================= ALREADY CLOSED CHECK ================= */
  
      if (
        complaint.current_status === "RESOLVED" ||
        complaint.current_status === "CLOSED"
      ) {
        console.error("[RULE] Complaint already closed or resolved");
        return next(
          new ErrorHandler(
            "Complaint is already closed or resolved",
            409
          )
        );
      }
  
      /* ================= FINAL UPDATE ================= */
  
      complaint.current_status = final_status;
      complaint.complaint_end_at = new Date();
  
      complaint.resolution_details = {
        ...(complaint.resolution_details || {}),
        final_note: final_resolution_note || null,
        closed_by: admin.public_user_id,
        closed_at: new Date().toISOString(),
      };
  
      complaint.status_history = [
        ...(complaint.status_history || []),
        {
          status: final_status,
          at: new Date().toISOString(),
          source: "ADMIN",
          by: admin.public_user_id,
        },
      ];
  
      await complaint.save();
      console.log("[DB] Complaint closed successfully");
  
      /* =====================================================
         BACKGROUND EMAIL / SMS (NON-BLOCKING)
      ===================================================== */
  
      const complainantName = complaint.complainant_name || "Citizen";
      const smsMessage = `Your complaint ${complaint.complaint_number} has been ${final_status}.`;
  
      console.log("[NOTIFICATION] Triggering background notifications", {
        email: complaint.complainant_email,
        phone: complaint.complainant_phone,
      });
  
      // Email (fire-and-forget)
      if (complaint.complainant_email) {
        sendEmail({
          email: complaint.complainant_email,
          subject: `Complaint ${complaint.complaint_number} ${final_status}`,
          template: "complaintStatusUpdate.ejs",
          data: {
            name: complainantName,
            complaint_number: complaint.complaint_number,
            status: final_status,
            note: final_resolution_note || null,
          },
        })
          .then(() =>
            console.log("[EMAIL] Background email sent")
          )
          .catch((err) =>
            console.error("[EMAIL] Background email failed", err?.message)
          );
      }
  
      // SMS (fire-and-forget)
      if (complaint.complainant_phone) {
        const phone = String(complaint.complainant_phone).trim();
  
        fast2sms
          .sendSuperAdminCreatedSMS(phone, complainantName)
          .then((resp) =>
            console.log("[SMS] Background SMS response", resp)
          )
          .catch((err) =>
            console.error("[SMS] Background SMS failed", err?.message)
          );
      }
  
      /* ================= RESPONSE (IMMEDIATE) ================= */
  
      console.log("[ADMIN_CLOSE_COMPLAINT] Response sent (notifications in background)");
  
      res.status(200).json({
        success: true,
        message: `Complaint ${final_status.toLowerCase()} successfully`,
        complaint: {
          complaint_number: complaint.complaint_number,
          current_status: complaint.current_status,
          complaint_end_at: complaint.complaint_end_at,
          resolution_details: complaint.resolution_details,
        },
      });
    }
  );
  
  
  

