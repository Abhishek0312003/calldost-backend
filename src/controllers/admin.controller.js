import sequelize from "../config/db.js";
import Admin from "../models/admin.model.js";
import BiharDistrict from "../models/biharDistrict.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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
