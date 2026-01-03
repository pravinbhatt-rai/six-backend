import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "change-me-to-a-strong-secret";

export const isAdminOrModerator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    
    if (!decoded.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await prisma.user.findUnique({ where: { id: Number(decoded.userId) } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "ADMIN" || user.role === "MODERATOR") {
      (req as any).user = user; // Attach user to request
      next();
    } else {
      return res.status(403).json({ error: "Access denied. Admins or Moderators only." });
    }
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    
    if (!decoded.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await prisma.user.findUnique({ where: { id: Number(decoded.userId) } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "ADMIN") {
      (req as any).user = user; // Attach user to request
      next();
    } else {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
