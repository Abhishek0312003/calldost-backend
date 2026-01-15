import ErrorHandler from "../utils/errorhandler.js";
import Admin from "../models/admin.model.js";

/**
 * ADMIN ONLY MIDDLEWARE
 * - Must be authenticated
 * - Must exist in admins table
 * - Must be active
 */
export const adminOnly = async (req, res, next) => {
  try {
    // 1️⃣ Authentication already required
    if (!req.user || !req.user.public_user_id) {
      return next(new ErrorHandler("Authentication required", 401));
    }

    const { public_user_id } = req.user;

    // 2️⃣ Check admin exists
    const admin = await Admin.findOne({
      where: { public_user_id },
    });

    if (!admin) {
      return next(
        new ErrorHandler("Access denied. Admin privileges required.", 403)
      );
    }

    // 3️⃣ Check admin active
    if (admin.is_active !== true) {
      return next(
        new ErrorHandler("Admin account is deactivated", 403)
      );
    }

    // 4️⃣ Attach admin context (optional but useful)
    req.admin = {
      user_id: admin.user_id,
      public_user_id: admin.public_user_id,
      district_code_alpha: admin.district_code_alpha,
      name: admin.name,
      email: admin.email,
    };

    next();
  } catch (error) {
    next(error);
  }
};
