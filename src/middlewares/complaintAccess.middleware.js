import { redis } from "../config/redis.js";
import EducationComplaint from "../models/educationComplaint.model.js";
import HealthComplaint from "../models/healthComplaint.model.js";
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

    /* =====================================================
       FIND COMPLAINT (EDU OR HEALTH)
    ===================================================== */
    let complaint = await EducationComplaint.findOne({
      where: { complaint_number },
    });

    let redisKeyPrefix = "complaint"; // education default

    if (!complaint) {
      complaint = await HealthComplaint.findOne({
        where: { complaint_number },
      });
      redisKeyPrefix = "health:complaint";
    }

    if (!complaint) {
      return next(
        new ErrorHandler("Invalid complaint reference", 404)
      );
    }

    /* =====================================================
       VERIFY REDIS TOKEN
    ===================================================== */
    const redisToken = await redis.get(
      `${redisKeyPrefix}:access:${complaint_number}`
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
