import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import applicationsRouter from "./routes/applications";
import loansRouter from "./routes/loans";
import creditCardsRouter from "./routes/creditCards";
import usersRouter from "./routes/users";
import emailVerificationRouter from "./routes/emailVerification";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Root route - for Render and deployment verification
app.get("/", (_req, res) => {
  res.json({ 
    success: true,
    message: "Six Loan Backend API is running",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      auth: "/auth",
      admin: "/api/admin",
      applications: "/api/applications",
      loans: "/api/loans",
      creditCards: "/api/credit-cards",
      users: "/api/users"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "healthy", timestamp: new Date().toISOString() });
});

// Auth routes
app.use("/auth", authRouter);

// Admin routes
app.use("/api/admin", adminRouter);

// Application routes
app.use("/api/applications", applicationsRouter);

// Loan routes
app.use("/api/loans", loansRouter);

// Credit Card routes
app.use("/api/credit-cards", creditCardsRouter);

// User routes
app.use("/api/users", usersRouter);

app.use("/api/email-verification", emailVerificationRouter);

// Insurance by category slug
app.get("/api/insurance/by-category/:slug", async (req, res) => {
  const { slug } = req.params;
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      insurances: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

  res.json({ category });
});

// 404 handler - must be after all routes
app.use((_req, res) => {
  res.status(404).json({ 
    success: false,
    error: "Route not found",
    message: "The requested endpoint does not exist. Check /api for available routes."
  });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ 
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production' ? "Something went wrong" : err.message
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on port ${PORT}`);
});
