import BiharDistrict from "../models/biharDistrict.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import { Op, UniqueConstraintError } from "sequelize";
import sequelize from "../config/db.js";

/* ============================================================
   CONSTANTS
============================================================ */

const DISTRICT_NUMERIC_START = 1001;
const BULK_LIMIT = 100;

/* ============================================================
   INTERNAL UTILITIES
============================================================ */

/**
 * Generate next numeric code (locked, transaction-safe)
 */
const getNextNumericCode = async (transaction) => {
  const last = await BiharDistrict.findOne({
    order: [["district_code_numeric", "DESC"]],
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  return last ? last.district_code_numeric + 1 : DISTRICT_NUMERIC_START;
};

/**
 * Normalize alpha code
 */
const normalizeAlphaCode = (code) =>
  String(code).trim().toUpperCase();

/* ============================================================
   CREATE SINGLE DISTRICT
============================================================ */

export const createDistrict = catchAsyncError(async (req, res, next) => {
  let { district_code_alpha, district_name, assigned_admin_public_user_ids } =
    req.body;

  if (!district_code_alpha || !district_name) {
    return next(
      new ErrorHandler(
        "district_code_alpha and district_name are required",
        400
      )
    );
  }

  district_code_alpha = normalizeAlphaCode(district_code_alpha);
  district_name = String(district_name).trim();

  if (district_code_alpha.length > 5) {
    return next(
      new ErrorHandler("district_code_alpha max length is 5", 400)
    );
  }

  if (
    assigned_admin_public_user_ids !== undefined &&
    !Array.isArray(assigned_admin_public_user_ids)
  ) {
    return next(
      new ErrorHandler(
        "assigned_admin_public_user_ids must be an array",
        400
      )
    );
  }

  const transaction = await sequelize.transaction();

  try {
    const exists = await BiharDistrict.findOne({
      where: {
        [Op.or]: [{ district_code_alpha }, { district_name }],
      },
      transaction,
    });

    if (exists) {
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "District with same code or name already exists",
          409
        )
      );
    }

    let district;
    let attempts = 0;

    while (!district && attempts < 3) {
      attempts++;

      try {
        const numericCode = await getNextNumericCode(transaction);

        district = await BiharDistrict.create(
          {
            district_code_alpha,
            district_code_numeric: numericCode,
            district_name,
            assigned_admin_public_user_ids:
              assigned_admin_public_user_ids || [],
          },
          { transaction }
        );
      } catch (err) {
        if (err instanceof UniqueConstraintError) {
          continue; // retry numeric code
        }
        throw err;
      }
    }

    if (!district) {
      throw new Error("Failed to generate unique district code");
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "District created successfully",
      district,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
});

/* ============================================================
   BULK CREATE DISTRICTS
============================================================ */

export const createDistrictsBulk = catchAsyncError(async (req, res, next) => {
  const { districts } = req.body;

  if (!Array.isArray(districts) || districts.length === 0) {
    return next(
      new ErrorHandler("districts must be a non-empty array", 400)
    );
  }

  if (districts.length > BULK_LIMIT) {
    return next(
      new ErrorHandler(
        `Bulk insert limit exceeded (max ${BULK_LIMIT})`,
        400
      )
    );
  }

  const transaction = await sequelize.transaction();

  try {
    const existing = await BiharDistrict.findAll({
      attributes: ["district_code_alpha"],
      transaction,
    });

    const existingSet = new Set(
      existing.map((d) => d.district_code_alpha)
    );

    const payloadSet = new Set();
    let nextCode = await getNextNumericCode(transaction);
    const prepared = [];

    for (const item of districts) {
      let {
        district_code_alpha,
        district_name,
        assigned_admin_public_user_ids,
      } = item;

      if (!district_code_alpha || !district_name) {
        await transaction.rollback();
        return next(
          new ErrorHandler(
            "Each district must have district_code_alpha and district_name",
            400
          )
        );
      }

      district_code_alpha = normalizeAlphaCode(district_code_alpha);
      district_name = String(district_name).trim();

      if (payloadSet.has(district_code_alpha)) {
        continue; // duplicate in same payload
      }

      if (existingSet.has(district_code_alpha)) {
        continue; // already exists in DB
      }

      if (
        assigned_admin_public_user_ids !== undefined &&
        !Array.isArray(assigned_admin_public_user_ids)
      ) {
        await transaction.rollback();
        return next(
          new ErrorHandler(
            "assigned_admin_public_user_ids must be an array",
            400
          )
        );
      }

      payloadSet.add(district_code_alpha);

      prepared.push({
        district_code_alpha,
        district_code_numeric: nextCode++,
        district_name,
        assigned_admin_public_user_ids:
          assigned_admin_public_user_ids || [],
      });
    }

    if (prepared.length === 0) {
      await transaction.rollback();
      return res.status(200).json({
        success: true,
        message: "No new districts to insert",
        inserted_count: 0,
      });
    }

    const created = await BiharDistrict.bulkCreate(prepared, {
      transaction,
      validate: true,
    });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Districts bulk created successfully",
      inserted_count: created.length,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
});

/* ============================================================
   GET ALL DISTRICTS
============================================================ */

export const getAllDistricts = catchAsyncError(async (req, res) => {
    const districts = await BiharDistrict.findAll({
      attributes: {
        exclude: ["district_id"],
      },
      order: [["district_name", "ASC"]],
    });
  
    res.status(200).json({
      success: true,
      count: districts.length,
      districts,
    });
  });
  

/* ============================================================
   GET SINGLE DISTRICT
============================================================ */

export const getDistrictById = catchAsyncError(async (req, res, next) => {
  const { district_id } = req.params;

  const district = await BiharDistrict.findByPk(district_id);

  if (!district) {
    return next(new ErrorHandler("District not found", 404));
  }

  res.status(200).json({
    success: true,
    district,
  });
});

/* ============================================================
   UPDATE DISTRICT
============================================================ */

export const updateDistrict = catchAsyncError(async (req, res, next) => {
  const { district_id } = req.params;
  const { district_name, assigned_admin_public_user_ids } = req.body;

  const district = await BiharDistrict.findByPk(district_id);

  if (!district) {
    return next(new ErrorHandler("District not found", 404));
  }

  if (district_name !== undefined) {
    district.district_name = String(district_name).trim();
  }

  if (assigned_admin_public_user_ids !== undefined) {
    if (!Array.isArray(assigned_admin_public_user_ids)) {
      return next(
        new ErrorHandler(
          "assigned_admin_public_user_ids must be an array",
          400
        )
      );
    }
    district.assigned_admin_public_user_ids =
      assigned_admin_public_user_ids;
  }

  await district.save();

  res.status(200).json({
    success: true,
    message: "District updated successfully",
  });
});

/* ============================================================
   DELETE DISTRICT
============================================================ */

export const deleteDistrict = catchAsyncError(async (req, res, next) => {
  const { district_id } = req.params;

  const district = await BiharDistrict.findByPk(district_id);

  if (!district) {
    return next(new ErrorHandler("District not found", 404));
  }

  await district.destroy();

  res.status(200).json({
    success: true,
    message: "District deleted successfully",
  });
});


