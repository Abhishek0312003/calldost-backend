import jwt from "jsonwebtoken";
import { redis } from "../utils/redis.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import { signAccessToken } from "../utils/token.js";

export const refreshAccessToken = catchAsyncError(async (req, res, next) => {
  const refreshToken =
    req.cookies?.refresh_token ||
    req.headers["x-refresh-token"];

  if (!refreshToken) {
    return next(new ErrorHandler("Refresh token missing", 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch (err) {
    return next(new ErrorHandler("Invalid or expired refresh token", 401));
  }

  const session = await redis.get(`session:${decoded.user_id}`);

  if (!session) {
    return next(new ErrorHandler("Session expired. Please login again.", 401));
  }

  const user = JSON.parse(session);

  const newAccessToken = signAccessToken({
    user_id: user.user_id,
    role: user.role,
  });

  res.cookie("access_token", newAccessToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
  });

  res.status(200).json({
    success: true,
    accessToken: newAccessToken,
  });
});
