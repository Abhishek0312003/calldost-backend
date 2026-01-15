import jwt from "jsonwebtoken";
import { redis } from "../utils/redis.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";

export const isAuthenticated = catchAsyncError(async (req, res, next) => {
  const token =
    req.cookies?.access_token ||
    req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new ErrorHandler("Access token missing", 401));
  }

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

  // session = { public_user_id, is_super_admin }
  req.user = JSON.parse(session);

  next();
});
