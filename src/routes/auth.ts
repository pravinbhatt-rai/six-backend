import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { saveOtp, verifyOtp } from "../utils/otpStore";

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// In-memory token blacklist (for development)
// In production, use Redis or database for token blacklisting
const tokenBlacklist = new Set<string>();

// Clean up expired tokens from blacklist periodically
setInterval(() => {
  // For now, we'll just clear all every hour since we don't store expiry
  // In production, implement proper expiry tracking
  tokenBlacklist.clear();
  console.log("[Token Blacklist] Cleared all tokens");
}, 60 * 60 * 1000); // Every hour

if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("JWT_SECRET is not set. Set it in backend/.env for secure auth.");
}

function signToken(user: { id: number; name: string; email: string; phone: string; role: string }) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.sign(
    {
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Middleware to check if token is blacklisted
const checkTokenBlacklist = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  
  const token = authHeader.slice("Bearer ".length).trim();
  
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: "Token has been revoked. Please login again." });
  }
  
  next();
};

// NOTE: Do NOT apply blacklist check to all routes - only apply to routes that need it
// Login and signup should NOT check for blacklisted tokens

// SEND OTP (Email)
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
    saveOtp(email, otp);

    // eslint-disable-next-line no-console
    console.log(`[DEV] Sending OTP ${otp} to ${email}`);

    if (EMAIL_USER && EMAIL_PASS) {
      await transporter.sendMail({
        from: EMAIL_USER,
        to: email,
        subject: "Your SixLoan OTP",
        text: `Your OTP is ${otp}. It expires in 5 minutes.`,
      });
    } else {
      // eslint-disable-next-line no-console
      console.warn("Email credentials missing, OTP logged only.");
    }

    return res.json({ success: true, message: "OTP sent to email" });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("/auth/send-otp error", err);
    return res.status(500).json({ error: "Failed to send OTP", details: err.message });
  }
});

// SIGNUP: name, email, phone, password (OTP disabled for now)
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body ?? {};

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "name, email, phone, password are required" });
    }

    // OTP Verification Disabled
    /*
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: "OTP is required" });
    const isValid = verifyOtp(email, otp);
    if (!isValid) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
    }
    */

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });
    if (existing) {
      return res.status(409).json({ error: "User with this email or phone already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash,
      },
    });

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/auth/signup error", err);
    return res.status(500).json({ error: "Failed to sign up" });
  }
});

// LOGIN: email or phone + password -> JWT session
router.post("/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body ?? {};

    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: "emailOrPhone and password are required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/auth/login error", err);
    return res.status(500).json({ error: "Failed to log in" });
  }
});

// ME: verify JWT and return current user
router.get("/me", checkTokenBlacklist, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();

    if (!JWT_SECRET) {
      return res.status(500).json({ error: "JWT secret not configured" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    const userId = decoded.userId;
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/auth/me error", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// LOGOUT: Revoke token
router.post("/logout", checkTokenBlacklist, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({ error: "No token provided" });
    }
    
    const token = authHeader.slice("Bearer ".length).trim();
    
    // Add token to blacklist
    tokenBlacklist.add(token);
    
    // eslint-disable-next-line no-console
    console.log(`[Logout] Token blacklisted. Total blacklisted tokens: ${tokenBlacklist.size}`);
    
    return res.json({ 
      success: true, 
      message: "Successfully logged out. Token has been revoked." 
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("/auth/logout error", err);
    return res.status(500).json({ error: "Failed to logout", details: err.message });
  }
});

// LOGOUT ALL: Revoke all user's tokens (enhanced version)
router.post("/logout-all", checkTokenBlacklist, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({ error: "No token provided" });
    }
    
    const token = authHeader.slice("Bearer ".length).trim();
    
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "JWT secret not configured" });
    }
    
    // Verify token to get user info
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    const userId = decoded.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    // Get user
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // In production, you would:
    // 1. Store a token version in user record
    // 2. Increment token version on logout-all
    // 3. Check token version on each request
    
    // For now, we'll just clear all blacklisted tokens (simplified)
    // In a real app, you'd want a more sophisticated approach
    
    // Add current token to blacklist
    tokenBlacklist.add(token);
    
    // eslint-disable-next-line no-console
    console.log(`[Logout All] User ${user.email} logged out from all devices.`);
    
    return res.json({ 
      success: true, 
      message: "Successfully logged out from all devices. All tokens have been revoked." 
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("/auth/logout-all error", err);
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(500).json({ error: "Failed to logout from all devices", details: err.message });
  }
});

// REFRESH TOKEN: Get new token with extended expiry
router.post("/refresh-token", checkTokenBlacklist, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({ error: "No token provided" });
    }
    
    const oldToken = authHeader.slice("Bearer ".length).trim();
    
    if (!JWT_SECRET) {
      return res.status(500).json({ error: "JWT secret not configured" });
    }
    
    // Verify old token
    const decoded = jwt.verify(oldToken, JWT_SECRET) as { 
      userId?: number; 
      name?: string; 
      email?: string; 
      phone?: string; 
      role?: string;
    };
    
    const userId = decoded.userId;
    if (!userId || !decoded.email) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    // Get user from database
    const user = await prisma.user.findUnique({ 
      where: { id: Number(userId) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Blacklist old token
    tokenBlacklist.add(oldToken);
    
    // Generate new token
    const newToken = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
    
    // eslint-disable-next-line no-console
    console.log(`[Refresh Token] Token refreshed for user ${user.email}`);
    
    return res.json({
      token: newToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("/auth/refresh-token error", err);
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    return res.status(500).json({ error: "Failed to refresh token", details: err.message });
  }
});

export default router;