import ErrorHandler from "../utils/errorhandler.js";

export const superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return next(new ErrorHandler("Authentication required", 401));
  }

  if (req.user.is_super_admin !== true) {
    return next(
      new ErrorHandler(
        "Access denied. Super Admin privileges required.",
        403
      )
    );
  }

  if (!req.user.public_user_id) {
    return next(
      new ErrorHandler("Invalid admin session detected", 401)
    );
  }

  next();
};
