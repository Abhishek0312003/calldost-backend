import { redis } from "../config/redis.js";
import EducationComplaint from "../models/educationComplaint.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";

export const complaintAccessGuard = catchAsyncError(
  async (req, res, next) => {
    const { complaint_number } = req.params;
    const token = req.query.token;

    if (!token) {
      return next(
        new ErrorHandler("Access token missing or invalid", 401)
      );
    }

    // 🔍 Verify complaint exists
    const complaint = await EducationComplaint.findOne({
      where: { complaint_number },
    });

    if (!complaint) {
      return next(
        new ErrorHandler("Invalid complaint reference", 404)
      );
    }

    // 🔐 Verify Redis token
    const redisToken = await redis.get(
      `complaint:access:${complaint_number}`
    );

    if (!redisToken || redisToken !== token) {
      return next(
        new ErrorHandler(
          "This link is expired or invalid",
          401
        )
      );
    }

    req.complaint = complaint;
    next();
  }
);

