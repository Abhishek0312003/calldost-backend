import jwt from "jsonwebtoken";
import { redis } from "../config/redis.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 🔒 HEADER REQUIRED
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ErrorHandler("Authorization header required", 401));
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new ErrorHandler("Invalid or expired access token", 401));
  }

  const { public_user_id } = decoded;

  if (!public_user_id) {
    return next(new ErrorHandler("Invalid token payload", 401));
  }

  const session = await redis.get(`session:${public_user_id}`);

  if (!session) {
    return next(
      new ErrorHandler("Session expired. Please login again.", 401)
    );
  }

  req.user = JSON.parse(session);
  next();
});
