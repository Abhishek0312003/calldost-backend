import ErrorHandler from "../utils/errorhandler.js";

export const superAdminOnly = (req, res, next) => {
  if (!req.user?.is_super_admin) {
    return next(
      new ErrorHandler(
        "Access denied. Super Admin privileges required.",
        403
      )
    );
  }
  next();
};
