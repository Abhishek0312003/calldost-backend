import HealthComplaint from "../models/healthComplaint.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import crypto from "crypto";
import fast2sms from "../utils/fast2sms.js";
import { redis } from "../config/redis.js";
import { uploadBuffer } from "../utils/cloudinary.js";

/* ============================================================
   CREATE HEALTH COMPLAINT (API KEY BASED)
============================================================ */
export const createHealthComplaint = catchAsyncError(
  async (req, res, next) => {
    const {
      district,
      block,
      panchayat,
      village,
      facility_name,
      facility_type,
      mentioned_persons,
      complainant_name,
      complainant_phone,
      complainant_email,
      is_anonymous,
      complaint_title,
      complaint_description,
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
      "HLT-" +
      new Date().getFullYear() +
      "-" +
      crypto.randomBytes(4).toString("hex").toUpperCase();

    /* ================= CREATE COMPLAINT ================= */
    const complaint = await HealthComplaint.create({
      complaint_number,
      district,
      block,
      panchayat,
      village,
      facility_name,
      facility_type,
      mentioned_persons: mentioned_persons || [],
      complainant_name: finalComplainantName,
      complainant_phone: finalComplainantPhone,
      complainant_email: finalComplainantEmail,
      is_anonymous: anonymous,
      complaint_title,
      complaint_description,
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
        `health:complaint:access:${complaint_number}`,
        accessToken,
        { EX: 60 * 60 * 24 }
      );

      const accessLink = `${process.env.BASE_URL}/health/complaint/${complaint_number}?token=${accessToken}`;

      const smsText =
        `Your health complaint ${complaint_number} has been registered. ` +
        `You can update it within 24 hours using this link: ${accessLink}`;

      console.log(smsText);
      // fast2sms.sendSuperAdminCreatedSMS(finalComplainantPhone, smsText).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: "Health complaint submitted successfully",
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
   VERIFY HEALTH COMPLAINT ACCESS
============================================================ */
export const verifyHealthComplaintAccess = catchAsyncError(
  async (req, res, next) => {
    const { complaint_number } = req.params;
    const { token } = req.query;

    if (!token) {
      return next(new ErrorHandler("Access token missing", 401));
    }

    const redisKey = `health:complaint:access:${complaint_number}`;
    const storedToken = await redis.get(redisKey);

    if (!storedToken || storedToken !== token) {
      return next(
        new ErrorHandler("Access link expired or invalid", 403)
      );
    }

    const complaint = await HealthComplaint.findOne({
      where: { complaint_number },
      attributes: [
        "complaint_number",
        "complaint_title",
        "complaint_description",
        "complainant_email",
        "attachments",
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
   UPDATE HEALTH COMPLAINT VIA 24H LINK
============================================================ */
export const updateHealthComplaintViaLink = catchAsyncError(
  async (req, res, next) => {
    const { complaint_number } = req.params;
    const { complaint_description, complainant_email } = req.body;

    const redisKey = `health:complaint:access:${complaint_number}`;
    const storedToken = await redis.get(redisKey);

    if (!storedToken || storedToken !== req.query.token) {
      return next(new ErrorHandler("Access link expired or invalid", 403));
    }

    const complaint = await HealthComplaint.findOne({
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

    /* ================= ATTACHMENTS ================= */
    if (req.files?.length) {
      const uploadedAttachments = [];

      for (const file of req.files) {
        try {
          const upload = await uploadBuffer(
            file.buffer,
            "health_complaints"
          );

          uploadedAttachments.push({
            url: upload.secure_url.replace(
              "/upload/",
              "/upload/f_auto,q_auto/"
            ),
            public_id: upload.public_id,
            original_name: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedAt: new Date().toISOString(),
          });
        } catch {}
      }

      if (uploadedAttachments.length) {
        complaint.attachments = [
          ...(complaint.attachments || []),
          ...uploadedAttachments,
        ];
      }
    }

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
