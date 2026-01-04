import express from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

router.use((req: any, res: any, next: any) => {
  console.log("=".repeat(50));
  console.log("📨 REQUEST RECEIVED in users router");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Path:", req.path);
  console.log("Full URL:", req.protocol + "://" + req.get('host') + req.originalUrl);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("=".repeat(50));
  next();
});

// Public test endpoint - NO authentication
router.get("/public-test", (req, res) => {
  console.log("🎯 PUBLIC TEST ENDPOINT HIT!");
  console.log("Request headers:", req.headers);
  res.json({
    success: true,
    message: "Public test endpoint is working",
    router: "users",
    timestamp: new Date().toISOString(),
    requestInfo: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers
    }
  });
});

// Middleware to verify JWT token
const authenticateUser = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error: any) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Test endpoint to verify router is working
router.get("/test", (req, res) => {
  console.log("✅ /api/users/test endpoint hit!");
  res.json({ 
    success: true, 
    message: "Users router is working",
    timestamp: new Date().toISOString()
  });
});

// Also add a public health check
router.get("/health", async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    
    res.json({
      status: "healthy",
      database: "connected",
      totalUsers: userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});

// GET /api/users/profile - Get user profile (Supports both token auth and query params)
router.get("/profile", async (req: any, res) => {
  try {
    console.log("=== GET Profile Request ===");
    
    let userId: number | null = null;
    
    // Try to get userId from token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
        console.log("User ID from token:", userId);
      } catch (tokenError: any) {
        console.log("Token verification failed, falling back to query params");
      }
    }
    
    // If no valid token, try query params
    if (!userId) {
      const { userId: queryUserId, email, phone } = req.query;
      
      console.log("Query params:", { queryUserId, email, phone });
      
      if (!queryUserId && !email && !phone) {
        return res.status(400).json({ 
          error: "Please provide Authorization token or userId/email/phone as query parameter",
          example: "/api/users/profile?email=user@example.com"
        });
      }
      
      // Build query condition for non-token requests
      let whereCondition: any = {};
      if (queryUserId) {
        whereCondition.id = Number(queryUserId);
      } else if (email) {
        whereCondition.email = email;
      } else if (phone) {
        whereCondition.phone = phone;
      }
      
      const user = await prisma.user.findFirst({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          panCard: true,
          dob: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          employmentType: true,
          monthlyIncome: true,
          savedEmployerName: true,
          savedWorkExperience: true,
          savedResidenceType: true,
          createdAt: true,
        },
      });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const formattedUser = {
        ...user,
        dob: user.dob ? user.dob.toISOString().split('T')[0] : null,
        createdAt: user.createdAt.toISOString(),
      };
      
      return res.json({ success: true, user: formattedUser });
    }

    // Token-based request
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        panCard: true,
        dob: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        employmentType: true,
        monthlyIncome: true,
        savedEmployerName: true,
        savedWorkExperience: true,
        savedResidenceType: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const formattedUser = {
      ...user,
      dob: user.dob ? user.dob.toISOString().split('T')[0] : null,
      createdAt: user.createdAt.toISOString(),
    };

    res.json({ success: true, user: formattedUser });
    
  } catch (error: any) {
    console.error("=== GET Profile ERROR ===");
    console.error("Error details:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/users/profile - Update user profile (Supports both token auth and body identifiers)
router.put("/profile", async (req: any, res) => {
  try {
    let targetUserId: number | null = null;
    
    // Try to get userId from token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        targetUserId = decoded.userId;
        console.log("User ID from token:", targetUserId);
      } catch (tokenError: any) {
        console.log("Token verification failed, checking body identifiers");
      }
    }
    
    const {
      userId,
      email,
      phone: phoneIdentifier,
      name,
      phone,
      panCard,
      dob,
      address,
      city,
      state,
      pincode,
      employmentType,
      monthlyIncome,
      savedEmployerName,
      savedWorkExperience,
      savedResidenceType,
    } = req.body;
    
    // If no token, need at least one identifier in body
    if (!targetUserId && !userId && !email && !phoneIdentifier) {
      return res.status(400).json({ 
        error: "Please provide Authorization token or userId/email/phone in request body" 
      });
    }
    
    // Build where condition
    let whereCondition: any = {};
    if (targetUserId) {
      whereCondition.id = targetUserId;
    } else if (userId) {
      whereCondition.id = Number(userId);
    } else if (email) {
      whereCondition.email = email;
    } else if (phoneIdentifier) {
      whereCondition.phone = phoneIdentifier;
    }

    // Validate phone if provided
    if (phone && phone.trim()) {
      if (!/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: "Invalid phone number format. Must be 10 digits starting with 6-9." });
      }
      
      // Check if phone is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          phone: phone,
          NOT: whereCondition
        }
      });
      
      if (existingUser) {
        return res.status(400).json({ error: "Phone number already in use" });
      }
    }

    // Validate PAN if provided
    if (panCard && panCard.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panCard)) {
      return res.status(400).json({ error: "Invalid PAN number format. Must be like ABCDE1234F." });
    }

    // Validate pincode if provided
    if (pincode && pincode.trim() && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: "Invalid pincode format. Must be 6 digits." });
    }

    const updateData: any = {};
    
    if (name && name.trim()) updateData.name = name;
    if (phone && phone.trim()) updateData.phone = phone;
    if (panCard && panCard.trim()) updateData.panCard = panCard;
    if (dob && dob.trim()) {
      const dobDate = new Date(dob);
      if (isNaN(dobDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      updateData.dob = dobDate;
    }
    if (address && address.trim()) updateData.address = address;
    if (city && city.trim()) updateData.city = city;
    if (state && state.trim()) updateData.state = state;
    if (pincode && pincode.trim()) updateData.pincode = pincode;
    if (employmentType && employmentType.trim()) updateData.employmentType = employmentType;
    if (monthlyIncome !== undefined && monthlyIncome !== null && monthlyIncome !== '') {
      const income = typeof monthlyIncome === 'string' ? parseFloat(monthlyIncome) : monthlyIncome;
      if (isNaN(income) || income < 0) {
        return res.status(400).json({ error: "Invalid monthly income. Must be a positive number." });
      }
      updateData.monthlyIncome = income;
    }
    if (savedEmployerName && savedEmployerName.trim()) updateData.savedEmployerName = savedEmployerName;
    if (savedWorkExperience && savedWorkExperience.trim()) updateData.savedWorkExperience = savedWorkExperience;
    if (savedResidenceType && savedResidenceType.trim()) updateData.savedResidenceType = savedResidenceType;

    const user = await prisma.user.update({
      where: whereCondition,
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        panCard: true,
        dob: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        employmentType: true,
        monthlyIncome: true,
        savedEmployerName: true,
        savedWorkExperience: true,
        savedResidenceType: true,
      },
    });

    // Format the response
    const formattedUser = {
      ...user,
      dob: user.dob ? user.dob.toISOString().split('T')[0] : null,
    };

    res.json({ 
      success: true, 
      message: "Profile updated successfully",
      user: formattedUser 
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    
    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return res.status(400).json({ 
        error: `${field} is already in use by another account` 
      });
    }
    
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/users/applications - Get user's applications (include WITHDRAWN)
router.get("/applications", authenticateUser, async (req: any, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { 
        userId: req.userId,
      },
      include: {
        loan: { 
          select: { 
            id: true, 
            title: true, 
            bankName: true, 
            slug: true,
            bankLogoUrl: true 
          } 
        },
        card: { 
          select: { 
            id: true, 
            name: true, 
            bankName: true,
            bankLogoUrl: true 
          } 
        },
        insurance: { 
          select: { 
            id: true, 
            name: true, 
            provider: true,
            logoUrl: true 
          } 
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format applications for frontend with all details
    const formattedApplications = applications.map((app: any) => ({
      id: app.id,
      referenceNo: app.referenceNo,
      type: app.type,
      status: app.status,
      amount: app.amount,
      tenure: app.tenure,
      categoryName: app.categoryName,
      categorySlug: app.categorySlug,
      employmentType: app.employmentType,
      monthlyIncome: app.monthlyIncome,
      employerName: app.employerName,
      workExperience: app.workExperience,
      residenceType: app.residenceType,
      city: app.city,
      pincode: app.pincode,
      address: app.address,
      phone: app.phone,
      email: app.email,
      panNumber: app.panNumber,
      applicantName: app.applicantName,
      feedback: app.feedback,
      additionalInfo: app.notes,
      documents: app.documents,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      
      // Product info
      loan: app.loan,
      card: app.card,
      insurance: app.insurance,
    }));

    res.json({ 
      success: true, 
      applications: formattedApplications 
    });
  } catch (error: any) {
    console.error("Get applications error:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// GET /api/users/applications/:id - Get single application
router.get("/applications/:id", authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const applicationId = Number(id);

    const application = await prisma.application.findFirst({
      where: { 
        id: applicationId,
        userId: req.userId
      },
      include: {
        loan: { 
          select: { 
            id: true, 
            title: true, 
            bankName: true, 
            slug: true,
            bankLogoUrl: true,
            interestRateText: true,
            processTimeLabel: true
          } 
        },
        card: { 
          select: { 
            id: true, 
            name: true, 
            bankName: true,
            bankLogoUrl: true,
            annualFee: true,
            cardNetwork: true
          } 
        },
        insurance: { 
          select: { 
            id: true, 
            name: true, 
            provider: true,
            logoUrl: true,
            minPremium: true,
            coverage: true
          } 
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Format application
    const formattedApplication = {
      id: application.id,
      type: application.type,
      status: application.status,
      amount: application.amount,
      categoryName: application.categoryName,
      employmentType: application.employmentType,
      monthlyIncome: application.monthlyIncome,
      employerName: application.employerName,
      workExperience: application.workExperience,
      residenceType: application.residenceType,
      city: application.city,
      pincode: application.pincode,
      phone: application.phone,
      email: application.email,
      panNumber: application.panNumber,
      applicantName: application.applicantName,
      notes: application.notes,
      feedback: application.feedback,
      documents: application.documents || [],
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      referenceNo: `REF${application.id.toString().padStart(8, '0')}`,
      
      product: application.type === 'LOAN' ? application.loan :
               application.type === 'CREDIT_CARD' ? application.card :
               application.type === 'INSURANCE' ? application.insurance : null,
    };

    res.json({ 
      success: true, 
      application: formattedApplication 
    });
  } catch (error: any) {
    console.error("Get application error:", error);
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

// PUT /api/users/applications/:id/withdraw - Withdraw an application
router.put("/applications/:id/withdraw", authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const applicationId = Number(id);

    // Validate application ID
    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: "Invalid application ID" });
    }

    // Fetch application to verify ownership
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Verify the application belongs to the requesting user
    if (application.userId !== req.userId) {
      return res.status(403).json({ error: "You can only withdraw your own applications" });
    }

    // Check if application can be withdrawn (allow PENDING, PROCESSING, UNDER_REVIEW, IN_PROGRESS)
    const withdrawableStatuses = ['PENDING', 'PROCESSING', 'UNDER_REVIEW', 'IN_PROGRESS'];
    if (!withdrawableStatuses.includes(application.status)) {
      return res.status(400).json({ 
        error: `Cannot withdraw application with status: ${application.status}`,
        currentStatus: application.status,
        message: 'Only pending or in-progress applications can be withdrawn'
      });
    }

    // Update status to WITHDRAWN
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: { 
        status: 'WITHDRAWN',
        feedback: 'Application withdrawn by applicant',
        updatedAt: new Date()
      },
    });

    res.json({ 
      success: true, 
      message: "Application withdrawn successfully",
      application: {
        id: updatedApplication.id,
        status: updatedApplication.status,
        updatedAt: updatedApplication.updatedAt.toISOString()
      }
    });
  } catch (error: any) {
    console.error("Withdraw application error:", error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Application not found" });
    }
    
    res.status(500).json({ error: "Failed to withdraw application" });
  }
});

export default router;