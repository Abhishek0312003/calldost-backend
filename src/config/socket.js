import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { redis } from '../config/redis.js';

dotenv.config();

/* ======================================================
   TOKEN EXPIRY CONFIG
====================================================== */

const ACCESS_TOKEN_EXPIRE = parseInt(process.env.ACCESS_TOKEN_EXPIRE || '300000');       // 5 min
const REFRESH_TOKEN_EXPIRE = parseInt(process.env.REFRESH_TOKEN_EXPIRE || '604800000');  // 7 days

/* ======================================================
   COOKIE OPTIONS
====================================================== */

export const accessTokenOptions = {
  maxAge: ACCESS_TOKEN_EXPIRE,
  httpOnly: true,
  sameSite: 'Lax',
  secure: process.env.NODE_ENV === 'production',
};

export const refreshTokenOptions = {
  maxAge: REFRESH_TOKEN_EXPIRE,
  httpOnly: true,
  sameSite: 'Lax',
  secure: process.env.NODE_ENV === 'production',
};

/* ======================================================
   SIGN TOKENS
====================================================== */

export const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: Math.floor(ACCESS_TOKEN_EXPIRE / 1000),
  });
};

export const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: Math.floor(REFRESH_TOKEN_EXPIRE / 1000),
  });
};

/* ======================================================
   SAVE SESSION IN REDIS
====================================================== */

export const saveSession = async ({ user_id, role }) => {
  if (!user_id) throw new Error('User ID required for session');

  const ttlSeconds = Math.floor(REFRESH_TOKEN_EXPIRE / 1000);

  await redis.set(
    `session:${user_id}`,
    JSON.stringify({
      user_id,
      role,
      logged_in_at: new Date().toISOString(),
    }),
    { EX: ttlSeconds }
  );
};

/* ======================================================
   DESTROY SESSION
====================================================== */

export const destroySession = async (user_id) => {
  if (!user_id) return;
  await redis.del(`session:${user_id}`);
};

/* ======================================================
   VERIFY TOKEN
====================================================== */

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/* ======================================================
   ISSUE TOKENS (HELPER)
====================================================== */

export const issueTokens = async ({ res, user_id, role }) => {
  const accessToken = signAccessToken({ user_id, role });
  const refreshToken = signRefreshToken({ user_id, role });

  await saveSession({ user_id, role });

  res.cookie('access_token', accessToken, accessTokenOptions);
  res.cookie('refresh_token', refreshToken, refreshTokenOptions);

  return {
    accessToken,
    refreshToken,
  };
};
