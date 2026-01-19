import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import SuperAdminRouter from "./routes/superAdmin.routes.js";
import ApiKeyRouter from "./routes/apiKey.routes.js";
import sendEmail from "./utils/sendEmail.js";
import BiharDistrictRouter from "./routes/biharDistrict.routes.js";
import AdminRouter from "./routes/admin.routes.js";
import EducationComplaintRouter from "./routes/educationComplaint.routes.js";
import { complaintAccessGuard } from "./middlewares/complaintAccess.middleware.js";

import "./models/index.js";
import EducationComplaint from "./models/educationComplaint.model.js";


export const app = express();

/* ============================================================
   SECURITY MIDDLEWARES
============================================================ */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://res.cloudinary.com"
        ],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })
);


/* ============================================================
   RATE LIMITING
============================================================ */
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use(limiter);

/* ============================================================
   CORS CONFIGURATION
============================================================ */
const allowedOrigins = [
  // Main sites
  "https://vedvivah.com",
  "https://www.vedvivah.com",
  "https://admin.vedvivah.com",
  "https://recommend.vedvivah.com",

  // ✅ BACKEND DOMAIN (VERY IMPORTANT)
  "https://api.caldost.in",   // <-- replace with your actual backend domain

  // Local development
  "http://localhost:5173",
  "http://localhost:4000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow same-origin, server-side, curl, etc.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("CORS policy: Origin not allowed"));
    },
    credentials: true,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: Origin not allowed"));
      }
    },
    credentials: true,
  })
);

/* ============================================================
   PARSERS
============================================================ */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());


app.use(
  "/complaint",
  express.static(path.join(process.cwd(), "src/public/complaint"))
);

/* ============================================================
   REQUEST LOGGER
============================================================ */
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms")
);

/* ============================================================
   HEALTH CHECK
============================================================ */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "CALDOST BACKEND",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ============================================================
   TEST EMAIL
============================================================ */
app.get("/test-email", async (req, res) => {
  try {
    await sendEmail({
      email: "abhishek@vereda.co.in",
      subject: "Test: Super Admin Account Email",
      template: "superAdminCreated.ejs",
      data: {
        name: "Abhishek",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Test email has been sent successfully.",
    });
  } catch (error) {
    console.error("Test email failed:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Unable to send test email at this time. Please try again later.",
    });
  }
});

/* ============================================================
   ROUTES
============================================================ */

app.get(
  "/complaint/:complaint_number",
  complaintAccessGuard,
  (req, res) => {
    res.sendFile(
      path.join(
        process.cwd(),
        "src/public/complaint/index.html"
      )
    );
  }
);
app.use("/api/v1/super-admin", SuperAdminRouter);
app.use("/api/v1/admin/api-keys", ApiKeyRouter);
app.use("/api/v1/admin/bihar-districts", BiharDistrictRouter);
app.use('/api/v1/admin',AdminRouter)
app.use('/api/v1/complaint',EducationComplaintRouter)
/* ============================================================
   GLOBAL ERROR HANDLING
============================================================ */
app.use(errorMiddleware);
