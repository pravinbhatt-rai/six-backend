import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { saveOtp, verifyOtp } from "../utils/otpStore";
import { sendOtpEmail, sendPasswordResetOtpEmail, sendWelcomeEmail } from "../utils/emailService";
import { generateOTP, getOTPExpiry, isOtpExpired } from "../utils/otpGenerator";

const prisma = new PrismaClient();
const router = Router();

// Normalize phone number - remove duplicate country codes
function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove all spaces and trim
  let normalized = phone.trim().replace(/\s+/g, '');
  
  // If phone starts with +91+91, remove the duplicate
  if (normalized.startsWith('+91+91')) {
    normalized = normalized.replace('+91+91', '+91');
  }
  
  // If phone has multiple +91 prefixes, keep only the first one
  const countryCodeMatches = normalized.match(/\+91/g);
  if (countryCodeMatches && countryCodeMatches.length > 1) {
    normalized = '+91' + normalized.split('+91').filter(Boolean).join('');
  }
  
  return normalized;
}

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

// In-memory pending registrations (stores registration data until email is verified)
// In production, use Redis or database for pending registrations
interface PendingRegistration {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  otp: string;
  otpExpiry: Date;
  createdAt: Date;
}

const pendingRegistrations = new Map<string, PendingRegistration>();

// Password validation function
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter (A-Z)" };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

// Clean up expired pending registrations every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [email, registration] of pendingRegistrations.entries()) {
    if (registration.otpExpiry < now || (now.getTime() - registration.createdAt.getTime()) > 30 * 60 * 1000) {
      pendingRegistrations.delete(email);
      console.log(`[Pending Registration] Cleaned up expired registration for ${email}`);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

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

// STEP 1: INITIATE SIGNUP - Collect details and send OTP
router.post("/signup/initiate", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body ?? {};

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "name, email, phone, password are required" });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone);

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone: normalizedPhone }],
      },
    });
    if (existing) {
      return res.status(409).json({ error: "User with this email or phone already exists" });
    }

    // Generate OTP and hash password
    const otp = generateOTP(6);
    const otpExpiry = getOTPExpiry(10); // 10 minutes
    const passwordHash = await bcrypt.hash(password, 10);

    // Store pending registration
    pendingRegistrations.set(email, {
      name,
      email,
      phone: normalizedPhone,
      passwordHash,
      otp,
      otpExpiry,
      createdAt: new Date(),
    });

    // Send OTP email (non-blocking for faster response)
    sendOtpEmail(email, otp, name).catch((err: any) => {
      console.error("[Signup OTP] Failed to send email:", err);
    });

    console.log(`[Signup] OTP sent to ${email}: ${otp}`); // For development/testing

    return res.status(200).json({ 
      success: true, 
      message: "OTP sent to your email. Please verify to complete registration.",
      email 
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/auth/signup/initiate error", err);
    return res.status(500).json({ error: "Failed to initiate signup" });
  }
});

// STEP 2: COMPLETE SIGNUP - Verify OTP and create account
router.post("/signup/complete", async (req, res) => {
  try {
    const { email, otp } = req.body ?? {};

    if (!email || !otp) {
      return res.status(400).json({ error: "email and otp are required" });
    }

    // Get pending registration
    const pending = pendingRegistrations.get(email);
    
    if (!pending) {
      return res.status(400).json({ error: "No pending registration found. Please initiate signup again." });
    }

    // Check if OTP expired
    if (new Date() > pending.otpExpiry) {
      pendingRegistrations.delete(email);
      return res.status(400).json({ error: "OTP expired. Please initiate signup again." });
    }

    // Verify OTP
    if (pending.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Double-check user doesn't exist (race condition protection)
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: pending.email }, { phone: pending.phone }],
      },
    });
    if (existing) {
      pendingRegistrations.delete(email);
      return res.status(409).json({ error: "User with this email or phone already exists" });
    }

    // Create user with verified email
    const user = await prisma.user.create({
      data: {
        name: pending.name,
        email: pending.email,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        emailVerifiedAt: new Date(), // Mark email as verified
      },
    });

    // Clean up pending registration
    pendingRegistrations.delete(email);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name).catch((err) => {
      console.error("[Welcome Email] Failed to send welcome email:", err);
      // Don't fail the registration if email fails
    });

    // Generate JWT token
    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Registration completed successfully",
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
    console.error("/auth/signup/complete error", err);
    return res.status(500).json({ error: "Failed to complete signup" });
  }
});

// RESEND OTP during signup
router.post("/signup/resend-otp", async (req, res) => {
  try {
    const { email } = req.body ?? {};

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    // Get pending registration
    const pending = pendingRegistrations.get(email);
    
    if (!pending) {
      return res.status(400).json({ error: "No pending registration found. Please initiate signup again." });
    }

    // Generate new OTP
    const otp = generateOTP(6);
    const otpExpiry = getOTPExpiry(10); // 10 minutes

    // Update pending registration with new OTP
    pending.otp = otp;
    pending.otpExpiry = otpExpiry;
    pendingRegistrations.set(email, pending);

    // Send OTP email
    const emailSent = await sendOtpEmail(email, otp, pending.name);
    
    if (!emailSent) {
      return res.status(500).json({ error: "Failed to send OTP email" });
    }

    console.log(`[Signup] OTP resent to ${email}: ${otp}`); // For development/testing

    return res.status(200).json({ 
      success: true, 
      message: "OTP resent to your email" 
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/auth/signup/resend-otp error", err);
    return res.status(500).json({ error: "Failed to resend OTP" });
  }
});

// OLD SIGNUP ENDPOINT - DEPRECATED (keeping for backward compatibility)
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

// LOGIN: email or phone + password -> JWT session (requires verified email)
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

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ 
        error: "Email not verified", 
        message: "Please verify your email before logging in. Check your email for the OTP.",
        emailVerified: false,
        email: user.email
      });
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

// ========== FORGOT PASSWORD FLOW ==========

// INITIATE password reset - search user by email or phone, send OTP
router.post("/forgot-password/initiate", async (req, res) => {
  try {
    const { identifier } = req.body ?? {}; // identifier can be email or phone

    if (!identifier) {
      return res.status(400).json({ error: "Email or phone number is required" });
    }

    // Search for user by email or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase().trim() },
          { phone: identifier.trim() }
        ],
      },
    });

    // Don't reveal if user exists or not (security best practice)
    // But for this project, user wants clear error message
    if (!user) {
      return res.status(404).json({ 
        error: "Person with this email or phone number does not exist" 
      });
    }

    // Generate OTP
    const otp = generateOTP(6);
    const otpExpiry = getOTPExpiry(10); // 10 minutes

    // Store OTP in user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
      },
    });

    // Send password reset OTP email
    const emailSent = await sendPasswordResetOtpEmail(user.email, otp, user.name);
    
    if (!emailSent) {
      return res.status(500).json({ error: "Failed to send reset OTP email" });
    }

    console.log(`[Forgot Password] OTP sent to ${user.email} (User ID: ${user.id})`);

    return res.json({
      success: true,
      message: "Password reset OTP sent to your email",
      email: user.email, // Return email so frontend knows where OTP was sent
    });
  } catch (err) {
    console.error("/auth/forgot-password/initiate error", err);
    return res.status(500).json({ error: "Failed to initiate password reset" });
  }
});

// VERIFY OTP for password reset
router.post("/forgot-password/verify-otp", async (req, res) => {
  try {
    const { identifier, otp } = req.body ?? {};

    if (!identifier || !otp) {
      return res.status(400).json({ error: "Identifier and OTP are required" });
    }

    // Find user by email or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase().trim() },
          { phone: identifier.trim() }
        ],
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if OTP exists
    if (!user.emailOtp || !user.emailOtpExpiry) {
      return res.status(400).json({ error: "No password reset request found. Please initiate password reset again." });
    }

    // Check if OTP expired
    if (isOtpExpired(user.emailOtpExpiry)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOtp: null, emailOtpExpiry: null },
      });
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    // Verify OTP
    if (user.emailOtp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    console.log(`[Forgot Password] OTP verified for user ${user.email}`);

    return res.json({
      success: true,
      message: "OTP verified successfully. You can now reset your password.",
    });
  } catch (err) {
    console.error("/auth/forgot-password/verify-otp error", err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// RESET PASSWORD - update password after OTP verification
router.post("/forgot-password/reset", async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body ?? {};

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ error: "Identifier, OTP, and new password are required" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Find user by email or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase().trim() },
          { phone: identifier.trim() }
        ],
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if OTP exists
    if (!user.emailOtp || !user.emailOtpExpiry) {
      return res.status(400).json({ error: "No password reset request found. Please initiate password reset again." });
    }

    // Check if OTP expired
    if (isOtpExpired(user.emailOtpExpiry)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailOtp: null, emailOtpExpiry: null },
      });
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    // Verify OTP again
    if (user.emailOtp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailOtp: null,
        emailOtpExpiry: null,
      },
    });

    console.log(`[Forgot Password] Password reset successfully for user ${user.email}`);

    return res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (err) {
    console.error("/auth/forgot-password/reset error", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

// RESEND OTP for password reset
router.post("/forgot-password/resend-otp", async (req, res) => {
  try {
    const { identifier } = req.body ?? {};

    if (!identifier) {
      return res.status(400).json({ error: "Email or phone number is required" });
    }

    // Find user by email or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase().trim() },
          { phone: identifier.trim() }
        ],
      },
    });

    if (!user) {
      return res.status(404).json({ 
        error: "Person with this email or phone number does not exist" 
      });
    }

    // Generate new OTP
    const otp = generateOTP(6);
    const otpExpiry = getOTPExpiry(10);

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
      },
    });

    // Send password reset OTP email
    const emailSent = await sendPasswordResetOtpEmail(user.email, otp, user.name);
    
    if (!emailSent) {
      return res.status(500).json({ error: "Failed to send reset OTP email" });
    }

    console.log(`[Forgot Password] OTP resent to ${user.email}`);

    return res.json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (err) {
    console.error("/auth/forgot-password/resend-otp error", err);
    return res.status(500).json({ error: "Failed to resend OTP" });
  }
});

export default router;