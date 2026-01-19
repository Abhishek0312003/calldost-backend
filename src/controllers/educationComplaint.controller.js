import EducationComplaint from "../models/educationComplaint.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import crypto from "crypto";
import fast2sms from "../utils/fast2sms.js";
import { redis } from "../config/redis.js";
import { uploadBuffer } from "../utils/cloudinary.js";

/* ============================================================
   CREATE EDUCATION COMPLAINT (API KEY BASED)
============================================================ */
export const createEducationComplaint = catchAsyncError(
  async (req, res, next) => {
    const {
      district,
      block,
      panchayat,
      village,
      institution_name,
      institution_code,
      institution_type,
      complainant_name,
      complainant_phone,
      complainant_email,
      is_anonymous,
      complaint_title,
      complaint_description,
      complain_end_at,
      priority_level,
    } = req.body;

    /* ================= BASIC VALIDATION ================= */
    if (!district || !complaint_title || !complaint_description) {
      return next(
        new ErrorHandler(
          "District, complaint title and description are required",
          400
        )
      );
    }

    const anonymous = is_anonymous === true;

    /* ================= NORMALIZE COMPLAINANT DATA ================= */
    const finalComplainantName = anonymous ? null : complainant_name || null;
    const finalComplainantPhone = anonymous ? null : complainant_phone || null;
    const finalComplainantEmail = anonymous ? null : complainant_email || null;

    if (!anonymous && !finalComplainantName && !finalComplainantPhone) {
      return next(
        new ErrorHandler(
          "Name or phone number is required for non-anonymous complaints",
          400
        )
      );
    }

    /* ================= GENERATE COMPLAINT NUMBER ================= */
    const complaint_number =
      "EDU-" +
      new Date().getFullYear() +
      "-" +
      crypto.randomBytes(4).toString("hex").toUpperCase();

    /* ================= CREATE COMPLAINT ================= */
    const complaint = await EducationComplaint.create({
      complaint_number,
      district,
      block,
      panchayat,
      village,
      institution_name,
      institution_code,
      institution_type,
      complainant_name: finalComplainantName,
      complainant_phone: finalComplainantPhone,
      complainant_email: finalComplainantEmail,
      is_anonymous: anonymous,
      complaint_title,
      complaint_description,
      complain_end_at,
      attachments: [],
      current_status: "PENDING",
      priority_level: priority_level || "MEDIUM",
      status_history: [
        {
          status: "PENDING",
          at: new Date().toISOString(),
          source: "API",
        },
      ],
    });

    /* ================= REDIS ACCESS TOKEN (24 HOURS) ================= */
    if (!anonymous && finalComplainantPhone) {
      const accessToken = crypto.randomBytes(24).toString("hex");

      await redis.set(
        `complaint:access:${complaint_number}`,
        accessToken,
        { EX: 60 * 60 * 24 }
      );

      const accessLink = `${process.env.BASE_URL}/complaint/${complaint_number}?token=${accessToken}`;

      const smsText =
        `Your complaint ${complaint_number} has been registered. ` +
        `You can update it within 24 hours using this link: ${accessLink}`;

      console.log(smsText);
      // fast2sms.sendSuperAdminCreatedSMS(finalComplainantPhone, smsText).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: "Education complaint submitted successfully",
      complaint: {
        complaint_id: complaint.complaint_id,
        complaint_number,
        current_status: complaint.current_status,
        createdAt: complaint.createdAt,
      },
    });
  }
);

/* ============================================================
   VERIFY COMPLAINT ACCESS (STATIC PAGE)
============================================================ */
export const verifyComplaintAccess = catchAsyncError(
    async (req, res, next) => {
      const { complaint_number } = req.params;
      const { token } = req.query;
  
      if (!token) {
        return next(new ErrorHandler("Access token missing", 401));
      }
  
      const redisKey = `complaint:access:${complaint_number}`;
      const storedToken = await redis.get(redisKey);
  
      if (!storedToken || storedToken !== token) {
        return next(
          new ErrorHandler("Access link expired or invalid", 403)
        );
      }
  
      const complaint = await EducationComplaint.findOne({
        where: { complaint_number },
        attributes: [
          "complaint_number",
          "complaint_title",
          "complaint_description",
          "complainant_email",
          "attachments",          // ✅ IMAGES + NOTES
          "current_status",
          "createdAt",
        ],
      });
  
      if (!complaint) {
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      res.status(200).json({
        success: true,
        complaint,
      });
    }
  );
  
/* ============================================================
   UPDATE COMPLAINT VIA 24H LINK
============================================================ */
export const updateComplaintViaLink = catchAsyncError(
    async (req, res, next) => {
      const { complaint_number } = req.params;
      const { complaint_description, complainant_email } = req.body;
  
      const redisKey = `complaint:access:${complaint_number}`;
      const storedToken = await redis.get(redisKey);
  
      if (!storedToken || storedToken !== req.query.token) {
        return next(new ErrorHandler("Access link expired or invalid", 403));
      }
  
      const complaint = await EducationComplaint.findOne({
        where: { complaint_number },
      });
  
      if (!complaint) {
        return next(new ErrorHandler("Complaint not found", 404));
      }
  
      if (complaint_description) {
        complaint.complaint_description = complaint_description;
      }
  
      if (complainant_email && !complaint.is_anonymous) {
        complaint.complainant_email = complainant_email;
      }
  
      /* ================= CLOUDINARY UPLOAD (WITH NOTES + SAFE FORMAT) ================= */
  
      if (req.files?.length) {
        const uploadedAttachments = [];
  
        const notes = Array.isArray(req.body.attachment_notes)
          ? req.body.attachment_notes
          : req.body.attachment_notes
          ? [req.body.attachment_notes]
          : [];
  
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
  
          try {
            const upload = await uploadBuffer(
              file.buffer,
              "education_complaints"
            );
  
            // 🔥 IMPORTANT FIX
            const safeUrl = upload.secure_url.replace(
              "/upload/",
              "/upload/f_auto,q_auto/"
            );
  
            uploadedAttachments.push({
              url: safeUrl,                // ✅ browser-safe
              public_id: upload.public_id,
              original_name: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              uploadedAt: new Date().toISOString(),
              note: notes[i] || null,
            });
          } catch {
            // optional upload failure ignored
          }
        }
  
        if (uploadedAttachments.length) {
          complaint.attachments = [
            ...(complaint.attachments || []),
            ...uploadedAttachments,
          ];
        }
      }
  
      /* ================= STATUS HISTORY ================= */
  
      complaint.status_history = [
        ...(complaint.status_history || []),
        {
          status: complaint.current_status,
          at: new Date().toISOString(),
          source: "USER_LINK",
        },
      ];
  
      await complaint.save();
  
      res.status(200).json({
        success: true,
        message: "Complaint updated successfully",
      });
    }
  );
  



  // controllers/admin.complaints.controller.js

export const adminCloseComplaint = catchAsyncError(
  async (req, res, next) => {
    const { complaint_number } = req.params;
    const { final_status, final_resolution_note } = req.body;
    const admin = req.admin;

    /* ================= BASIC VALIDATION ================= */

    if (!complaint_number) {
      return next(new ErrorHandler("Complaint number is required", 400));
    }

    if (!final_status) {
      return next(
        new ErrorHandler("Final status is required", 400)
      );
    }

    const allowedFinalStatuses = ["RESOLVED", "CLOSED"];

    if (!allowedFinalStatuses.includes(final_status)) {
      return next(
        new ErrorHandler(
          "Final status must be RESOLVED or CLOSED",
          400
        )
      );
    }

    /* ================= FETCH COMPLAINT ================= */

    const complaint = await EducationComplaint.findOne({
      where: { complaint_number },
    });

    if (!complaint) {
      return next(new ErrorHandler("Complaint not found", 404));
    }

    /* ================= DISTRICT SECURITY ================= */

    const district = await BiharDistrict.findOne({
      where: { district_code_alpha: admin.district_code_alpha },
      attributes: ["district_name"],
    });

    if (!district || complaint.district !== district.district_name) {
      return next(
        new ErrorHandler("Access denied for this complaint", 403)
      );
    }

    /* ================= ALREADY CLOSED CHECK ================= */

    if (
      complaint.current_status === "RESOLVED" ||
      complaint.current_status === "CLOSED"
    ) {
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

    /* ================= STATUS HISTORY ================= */

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
