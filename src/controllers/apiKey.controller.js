import crypto from "crypto";
import ApiKey from "../models/apiKey.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import { encryptApiKey, decryptApiKey } from "../utils/apiKeyCrypto.js";

/**
 * CREATE API KEY
 * Super Admin only
 */
export const createApiKey = catchAsyncError(async (req, res, next) => {
  const { key_name, permissions } = req.body;

  if (!key_name) {
    return next(new ErrorHandler("Key name is required", 400));
  }

  const rawApiKey = crypto.randomBytes(32).toString("hex");
  const encryptedKey = encryptApiKey(rawApiKey);

  const apiKey = await ApiKey.create({
    key_name,
    api_key_encrypted: encryptedKey,
    created_by_public_user_id: req.user.public_user_id,
    permissions: permissions || {},
  });

  res.status(201).json({
    success: true,
    message: "API key created successfully",
    api_key_id: apiKey.api_key_id,
    api_key: rawApiKey, // returned intentionally (admin use)
  });
});

/**
 * GET ALL API KEYS
 * Super Admin only
 */
export const getAllApiKeys = catchAsyncError(async (req, res) => {
  const keys = await ApiKey.findAll({
    order: [["createdAt", "DESC"]],
    attributes: { exclude: ["api_key_encrypted"] },
  });

  res.status(200).json({
    success: true,
    count: keys.length,
    keys,
  });
});

/**
 * GET SINGLE API KEY (WITH DECRYPTION)
 * Super Admin only
 */
export const getApiKeyById = catchAsyncError(async (req, res, next) => {
  const { api_key_id } = req.params;

  const apiKey = await ApiKey.findByPk(api_key_id);
  if (!apiKey) {
    return next(new ErrorHandler("API key not found", 404));
  }

  const decryptedKey = decryptApiKey(apiKey.api_key_encrypted);

  res.status(200).json({
    success: true,
    api_key_id: apiKey.api_key_id,
    key_name: apiKey.key_name,
    api_key: decryptedKey,
    permissions: apiKey.permissions,
    usage_count: apiKey.usage_count,
    usage_logs: apiKey.usage_logs,
    is_active: apiKey.is_active,
    created_by_public_user_id: apiKey.created_by_public_user_id,
    createdAt: apiKey.createdAt,
  });
});

/**
 * UPDATE API KEY (name / permissions / status)
 * Super Admin only
 */
export const updateApiKey = catchAsyncError(async (req, res, next) => {
  const { api_key_id } = req.params;
  const { key_name, permissions, is_active } = req.body;

  const apiKey = await ApiKey.findByPk(api_key_id);
  if (!apiKey) {
    return next(new ErrorHandler("API key not found", 404));
  }

  if (key_name !== undefined) apiKey.key_name = key_name;
  if (permissions !== undefined) apiKey.permissions = permissions;
  if (is_active !== undefined) apiKey.is_active = is_active;

  await apiKey.save();

  res.status(200).json({
    success: true,
    message: "API key updated successfully",
  });
});

/**
 * DELETE API KEY
 * Super Admin only
 */
export const deleteApiKey = catchAsyncError(async (req, res, next) => {
  const { api_key_id } = req.params;

  const apiKey = await ApiKey.findByPk(api_key_id);
  if (!apiKey) {
    return next(new ErrorHandler("API key not found", 404));
  }

  await apiKey.destroy();

  res.status(200).json({
    success: true,
    message: "API key deleted successfully",
  });
});
