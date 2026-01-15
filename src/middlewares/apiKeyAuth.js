import ApiKey from "../models/apiKey.model.js";
import ErrorHandler from "../utils/errorhandler.js";
import { catchAsyncError } from "../utils/catchAsyncError.js";
import { decryptApiKey } from "../utils/apiKeyCrypto.js";

export const apiKeyAuth = catchAsyncError(async (req, res, next) => {
  const apiKeyHeader = req.headers["x-api-key"];

  if (!apiKeyHeader) {
    return next(new ErrorHandler("API key missing", 401));
  }

  const keys = await ApiKey.findAll({ where: { is_active: true } });

  let matchedKey = null;

  for (const key of keys) {
    const decrypted = decryptApiKey(key.api_key_encrypted);
    if (decrypted === apiKeyHeader) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) {
    return next(new ErrorHandler("Invalid API key", 401));
  }

  matchedKey.usage_count += 1;
  matchedKey.usage_logs = [
    ...matchedKey.usage_logs,
    {
      used_at: new Date().toISOString(),
      ip: req.ip,
      user_agent: req.headers["user-agent"],
    },
  ];

  await matchedKey.save();

  req.apiKey = matchedKey;
  next();
});
