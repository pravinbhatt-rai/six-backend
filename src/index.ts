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

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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

// Loan routes
app.use("/api/loans", loansRouter);

// Credit Card routes
app.use("/api/credit-cards", creditCardsRouter);

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

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on port ${PORT}`);
});
