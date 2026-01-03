import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { isAdminOrModerator, isAdmin } from "../middleware/role";
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();
const router = Router();

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    role: "USER" | "ADMIN" | "MODERATOR";
  };
}

// --- USER MANAGEMENT (ADMIN ONLY) ---

router.put("/users/:id/role", isAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["USER", "ADMIN", "MODERATOR"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { role: role as "USER" | "ADMIN" | "MODERATOR" },
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

// Protect all other admin routes (ADMIN or MODERATOR)
router.use(isAdminOrModerator);

// --- STATS & DASHBOARD ---

router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalUsers = await prisma.user.count();
    const totalLoans = await prisma.loanProduct.count();
    const totalCreditCards = await prisma.creditCardProduct.count();
    const totalInsurance = await prisma.insuranceProduct.count();
    const totalApplications = await prisma.application.count();

    // Trends
    const currentMonthUsers = await prisma.user.count({ where: { createdAt: { gte: firstDayCurrentMonth } } });
    const lastMonthUsers = await prisma.user.count({ 
      where: { 
        createdAt: { 
          gte: firstDayLastMonth,
          lte: lastDayLastMonth
        } 
      } 
    });
    
    const userTrend = lastMonthUsers > 0 
      ? ((currentMonthUsers - lastMonthUsers) / lastMonthUsers) * 100 
      : currentMonthUsers > 0 ? 100 : 0;

    const currentMonthApps = await prisma.application.count({ where: { createdAt: { gte: firstDayCurrentMonth } } });
    const lastMonthApps = await prisma.application.count({ 
      where: { 
        createdAt: { 
          gte: firstDayLastMonth,
          lte: lastDayLastMonth
        } 
      } 
    });

    const appTrend = lastMonthApps > 0
      ? ((currentMonthApps - lastMonthApps) / lastMonthApps) * 100
      : currentMonthApps > 0 ? 100 : 0;

    // Mock data for charts
    const trafficData = [
      { name: 'Jan', loans: 4000, cards: 2400 },
      { name: 'Feb', loans: 3000, cards: 1398 },
      { name: 'Mar', loans: 2000, cards: 9800 },
      { name: 'Apr', loans: 2780, cards: 3908 },
      { name: 'May', loans: 1890, cards: 4800 },
      { name: 'Jun', loans: 2390, cards: 3800 },
      { name: 'Jul', loans: 3490, cards: 4300 },
    ];

    const loanActivity = [
      { name: 'M', value: 200 },
      { name: 'T', value: 300 },
      { name: 'W', value: 150 },
      { name: 'Th', value: 230 },
      { name: 'F', value: 260 },
      { name: 'S', value: 70 },
    ];

    const recentApplications = await prisma.application.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        loan: { select: { title: true } },
        card: { select: { name: true } },
        insurance: { select: { name: true } }
      }
    });

    res.json({
      totalUsers,
      totalLoans,
      totalCreditCards,
      totalInsurance,
      totalProducts: totalLoans + totalCreditCards + totalInsurance,
      totalApplications,
      recentApplications,
      userTrend: `${userTrend >= 0 ? '+' : ''}${userTrend.toFixed(1)}%`,
      appTrend: `${appTrend >= 0 ? '+' : ''}${appTrend.toFixed(1)}%`,
      trafficData,
      loanActivity,
      stats: {
        trafficGained: 300000,
        loansApplied: totalApplications
      }
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- USERS ---

router.get("/users", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { applications: true }
        }
      }
    });
    res.json(users);
  } catch (err) {
    console.error("Users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// --- CATEGORIES ---

router.get("/categories", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(categories);
  } catch (err) {
    console.error("Categories error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Check if category can be deleted
router.get("/categories/:id/can-delete", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const categoryId = Number(id);

    const loanCount = await prisma.loanProduct.count({ where: { categoryId } });
    const insuranceCount = await prisma.insuranceProduct.count({ where: { categoryId } });
    const creditCardCount = await prisma.creditCardProduct.count({
      where: {
        categories: {
          some: { id: categoryId }
        }
      }
    });

    const canDelete = loanCount === 0 && insuranceCount === 0 && creditCardCount === 0;

    res.json({
      canDelete,
      reasons: canDelete ? [] : [
        ...(loanCount > 0 ? [`${loanCount} loan product(s)`] : []),
        ...(insuranceCount > 0 ? [`${insuranceCount} insurance product(s)`] : []),
        ...(creditCardCount > 0 ? [`${creditCardCount} credit card product(s)`] : [])
      ],
      counts: {
        loans: loanCount,
        insurance: insuranceCount,
        creditCards: creditCardCount
      }
    });
  } catch (err: any) {
    console.error("Check delete error:", err);
    res.status(500).json({ error: "Failed to check category" });
  }
});

router.post("/categories", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, slug, type, description } = req.body;
    const category = await prisma.category.create({
      data: { name, slug, type, description }
    });
    res.json(category);
  } catch (err: any) {
    console.error("Create category error:", err);
    res.status(500).json({ error: "Failed to create category", details: err.message });
  }
});

router.put("/categories/:id", async (req: AuthenticatedRequest, res: Response) => {
  console.log("======= PUT /categories/:id =======");
  console.log("Params:", req.params);
  console.log("Headers:", req.headers);
  console.log("Full body:", JSON.stringify(req.body, null, 2));
  console.log("Body keys:", Object.keys(req.body));
  
  try {
    const { id } = req.params;
    const { name, slug, type, description } = req.body;
    
    // Log each field individually
    console.log("Extracted fields:", { 
      name, 
      slug, 
      type, 
      description,
      nameExists: !!name,
      slugExists: !!slug,
      typeExists: !!type
    });
    
    // Validate ID
    const categoryId = Number(id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }
    
    // Validate required fields - check for empty strings too
    const missingFields = [];
    if (!name || name.trim() === '') missingFields.push('name');
    if (!slug || slug.trim() === '') missingFields.push('slug');
    if (!type || type.trim() === '') missingFields.push('type');
    
    if (missingFields.length > 0) {
      console.log("Missing fields detected:", missingFields);
      return res.status(400).json({ 
        error: "Missing or empty required fields", 
        missingFields: missingFields,
        received: { name, slug, type, description }
      });
    }
    
    console.log("All validations passed, proceeding with update...");
    
    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });
    
    if (!existingCategory) {
      return res.status(404).json({ 
        error: "Category not found", 
        message: `Category with ID ${id} does not exist` 
      });
    }
    
    // Check if slug already exists (excluding current category)
    if (slug !== existingCategory.slug) {
      const existingSlug = await prisma.category.findFirst({
        where: {
          slug: slug,
          id: { not: categoryId }
        }
      });
      
      if (existingSlug) {
        return res.status(400).json({ 
          error: "Slug already exists", 
          message: `Another category with slug '${slug}' already exists` 
        });
      }
    }
    
    // Validate ProductType enum
    const validTypes = ['LOAN', 'CREDIT_CARD', 'INSURANCE']; // Update with your actual enum values
    if (!validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({ 
        error: "Invalid type", 
        message: `Type must be one of: ${validTypes.join(', ')}`,
        received: type,
        suggestion: type.toUpperCase()
      });
    }
    
    // Use uppercase for enum
    const normalizedType = type.toUpperCase();
    
    // Perform the update
    console.log("Executing Prisma update with:", {
      id: categoryId,
      name,
      slug,
      type: normalizedType,
      description
    });
    
    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: { 
        name: name.trim(),
        slug: slug.trim(),
        type: normalizedType,
        description: description ? description.trim() : null,
        updatedAt: new Date()
      }
    });
    
    console.log("Update successful:", updatedCategory);
    
    return res.json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory
    });
    
  } catch (err: any) {
    console.error("Update error details:", {
      code: err.code,
      message: err.message,
      meta: err.meta,
      stack: err.stack?.split('\n').slice(0, 5)
    });
    
    // Handle specific Prisma errors
    if (err.code === 'P2025') {
      return res.status(404).json({ 
        error: "Category not found", 
        message: "The category you're trying to update does not exist" 
      });
    }
    
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'field';
      return res.status(400).json({ 
        error: "Duplicate value", 
        message: `A category with this ${field} already exists`,
        field: field
      });
    }
    
    return res.status(500).json({ 
      error: "Failed to update category", 
      details: err.message,
      code: err.code 
    });
  }
});

// Safe delete category (disassociates products before deletion)
router.delete("/categories/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const categoryId = Number(id);

    // Use transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx: any) => {
      // Set categoryId to null for all loan products in this category
      await tx.loanProduct.updateMany({
        where: { categoryId },
        data: { categoryId: null }
      });

      // Disconnect category from all credit card products
      const creditCards = await tx.creditCardProduct.findMany({
        where: {
          categories: {
            some: { id: categoryId }
          }
        },
        select: { id: true }
      });

      for (const card of creditCards) {
        await tx.creditCardProduct.update({
          where: { id: card.id },
          data: {
            categories: {
              disconnect: { id: categoryId }
            }
          }
        });
      }

      // Set categoryId to null for all insurance products in this category
      await tx.insuranceProduct.updateMany({
        where: { categoryId },
        data: { categoryId: null }
      });

      // Now delete the category
      await tx.category.delete({ where: { id: categoryId } });
    });

    res.json({ 
      success: true, 
      message: "Category deleted successfully. All products have been disassociated from this category." 
    });
  } catch (err: any) {
    console.error("Delete category error:", err);
    
    if (err.code === 'P2025') {
      res.status(404).json({ error: "Category not found" });
    } else if (err.code === 'P2003') {
      res.status(400).json({ 
        error: "Cannot delete category", 
        details: "There are still products associated with this category. Try the force delete endpoint instead."
      });
    } else {
      res.status(500).json({ 
        error: "Failed to delete category", 
        details: err.message,
        code: err.code 
      });
    }
  }
});

// Force delete category (deletes category and all associated products)
router.delete("/categories/:id/force", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const categoryId = Number(id);

    await prisma.$transaction(async (tx: any) => {
      // First get all loan products in this category
      const loanProducts = await tx.loanProduct.findMany({
        where: { categoryId },
        select: { id: true }
      });

      // Delete all related data for each loan product
      for (const loan of loanProducts) {
        // Remove loan references from applications
        await tx.application.updateMany({ 
          where: { loanId: loan.id }, 
          data: { loanId: null } 
        });
        // Delete loan details
        await tx.loanBullet.deleteMany({ where: { productId: loan.id } });
        await tx.loanSummaryCharge.deleteMany({ where: { productId: loan.id } });
        await tx.loanRequiredDocument.deleteMany({ where: { productId: loan.id } });
        await tx.loanProcessStep.deleteMany({ where: { productId: loan.id } });
      }

      // Delete all loan products in this category
      await tx.loanProduct.deleteMany({ where: { categoryId } });

      // Get all credit cards with this category
      const creditCards = await tx.creditCardProduct.findMany({
        where: {
          categories: {
            some: { id: categoryId }
          }
        },
        select: { id: true }
      });

      // Delete all related data for each credit card
      for (const card of creditCards) {
        // Remove card references from applications
        await tx.application.updateMany({ 
          where: { cardId: card.id }, 
          data: { cardId: null } 
        });
        // Delete card details
        await tx.creditCardBullet.deleteMany({ where: { productId: card.id } });
        await tx.creditCardSummaryCharge.deleteMany({ where: { productId: card.id } });
        await tx.creditCardRequiredDocument.deleteMany({ where: { productId: card.id } });
        await tx.creditCardProcessStep.deleteMany({ where: { productId: card.id } });
      }

      // Disconnect category from credit cards (but don't delete the cards)
      for (const card of creditCards) {
        await tx.creditCardProduct.update({
          where: { id: card.id },
          data: {
            categories: {
              disconnect: { id: categoryId }
            }
          }
        });
      }

      // Get all insurance products in this category
      const insuranceProducts = await tx.insuranceProduct.findMany({
        where: { categoryId },
        select: { id: true }
      });

      // Remove insurance references from applications
      for (const insurance of insuranceProducts) {
        await tx.application.updateMany({ 
          where: { insuranceId: insurance.id }, 
          data: { insuranceId: null } 
        });
      }

      // Delete all insurance products in this category
      await tx.insuranceProduct.deleteMany({ where: { categoryId } });

      // Finally delete the category
      await tx.category.delete({ where: { id: categoryId } });
    });

    res.json({ 
      success: true, 
      message: "Category and all associated products deleted successfully" 
    });
  } catch (err: any) {
    console.error("Force delete category error:", err);
    
    if (err.code === 'P2025') {
      res.status(404).json({ error: "Category not found" });
    } else {
      res.status(500).json({ 
        error: "Failed to force delete category", 
        details: err.message,
        code: err.code 
      });
    }
  }
});

// --- LOANS ---

router.get("/loans", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category } = req.query;
    const where = category ? { category: { slug: String(category) } } : {};
    
    const loans = await prisma.loanProduct.findMany({
      where,
      include: { 
        category: true,
        bullets: {
          select: { text: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        },
        summaryCharges: {
          select: { label: true, mainText: true, subText: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        },
        requiredDocuments: {
          select: { title: true, description: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        },
        processSteps: {
          select: { title: true, description: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(loans);
  } catch (err) {
    console.error("Loans error:", err);
    res.status(500).json({ error: "Failed to fetch loans" });
  }
});

router.post("/products/loan", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      title, slug, bankName, bankLogoUrl, 
      tag, feature, specialization,
      processTimeLabel, processTimeValue, chanceOfApproval, approvalScore,
      interestRateText, aprText, emiAmount, emiValue,
      processTypeLabel, processTypeValue, disbursalTimeHours,
      categoryId, bullets, 
      summaryCharges, requiredDocuments, processSteps, keyStatement,
      footerItems
    } = req.body;

    // Validate required fields
    if (!title || !slug || !bankName) {
      return res.status(400).json({ error: "Title, slug, and bank name are required" });
    }

    const product = await prisma.loanProduct.create({
      data: {
        title, slug, bankName, bankLogoUrl, 
        tag, feature, specialization,
        processTimeLabel, processTimeValue, chanceOfApproval, approvalScore: Number(approvalScore) || 0,
        interestRateText, aprText, emiAmount, emiValue: Number(emiValue) || 0,
        processTypeLabel, processTypeValue, disbursalTimeHours: Number(disbursalTimeHours) || 0,
        categoryId: categoryId ? Number(categoryId) : null,
        keyStatement,
        bullets: { create: bullets || [] },
        summaryCharges: { create: summaryCharges || [] },
        requiredDocuments: { create: requiredDocuments || [] },
        processSteps: { create: processSteps || [] },
        footerItems: { create: footerItems || [] },
        createdById: req.user?.id
      }
    });
    res.json(product);
  } catch (err: any) {
    console.error("Create loan error:", err);
    res.status(500).json({ error: "Failed to create loan", details: err.message });
  }
});

// Get single loan product
router.get("/products/loan/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.loanProduct.findUnique({
      where: { id: Number(id) },
      include: {
        category: true,
        bullets: true,
        summaryCharges: true,
        requiredDocuments: true,
        processSteps: true,
        footerItems: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Loan product not found" });
    }

    res.json(product);
  } catch (err: any) {
    console.error("Get loan error:", err);
    res.status(500).json({ error: "Failed to fetch loan", details: err.message });
  }
});

// Update loan product
router.put("/products/loan/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title, slug, bankName, bankLogoUrl,
      tag, feature, specialization,
      processTimeLabel, processTimeValue, chanceOfApproval, approvalScore,
      interestRateText, aprText, emiAmount, emiValue,
      processTypeLabel, processTypeValue, disbursalTimeHours,
      keyStatement,
    } = req.body;

    const product = await prisma.loanProduct.update({
      where: { id: Number(id) },
      data: {
        title,
        slug,
        bankName,
        bankLogoUrl,
        feature,
        specialization,
        processTimeLabel,
        processTimeValue,
        chanceOfApproval,
        approvalScore: Number(approvalScore) || 0,
        interestRateText,
        aprText,
        emiAmount,
        emiValue: Number(emiValue) || 0,
        processTypeLabel,
        processTypeValue,
        disbursalTimeHours: Number(disbursalTimeHours) || 0,
        keyStatement,
      },
    });

    res.json(product);
  } catch (err: any) {
    console.error("Update loan error:", err);
    res.status(500).json({ error: "Failed to update loan", details: err.message });
  }
});

// Delete loan product (and dependent records)
router.delete("/products/loan/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const loanId = Number(id);

    await prisma.$transaction(async (tx: any) => {
      await tx.application.updateMany({ where: { loanId }, data: { loanId: null } });
      await tx.loanBullet.deleteMany({ where: { productId: loanId } });
      await tx.loanSummaryCharge.deleteMany({ where: { productId: loanId } });
      await tx.loanRequiredDocument.deleteMany({ where: { productId: loanId } });
      await tx.loanProcessStep.deleteMany({ where: { productId: loanId } });
      await tx.loanFooterItem.deleteMany({ where: { productId: loanId } });
      await tx.loanProduct.delete({ where: { id: loanId } });
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete loan error:", err);
    res.status(500).json({ error: "Failed to delete loan", details: err.message });
  }
});

// --- CREDIT CARDS ---

router.get("/credit-cards", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cards = await prisma.creditCardProduct.findMany({
      include: { 
        categories: true,
        bulletPoints: {
          select: { text: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        },
        summaryCharges: {
          select: { label: true, mainText: true, subText: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        },
        requiredDocuments: {
          select: { title: true, description: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        },
        processSteps: {
          select: { title: true, description: true, displayOrder: true },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });
    res.json(cards);
  } catch (err) {
    console.error("Credit cards error:", err);
    res.status(500).json({ error: "Failed to fetch credit cards" });
  }
});

router.post("/products/credit-card", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      name, slug, bankName, bankLogoUrl, imageUrl, categoryIds, 
      annualFee, cardNetwork, effectiveFree, recommended, rating, bulletPoints,
      summaryCharges, requiredDocuments, processSteps, keyStatement
    } = req.body;

    // Validate required fields
    if (!name || !slug || !bankName) {
      return res.status(400).json({ error: "Name, slug, and bank name are required" });
    }

    // Check if credit card with this slug already exists
    const existingCard = await prisma.creditCardProduct.findUnique({
      where: { slug }
    });

    if (existingCard) {
      return res.status(409).json({ 
        error: "Credit card with this slug already exists", 
        details: `A credit card with slug "${slug}" already exists. Please use a different slug or edit the existing card.`,
        existingId: existingCard.id
      });
    }

    const product = await prisma.creditCardProduct.create({
      data: {
        name, slug, bankName, bankLogoUrl, imageUrl, 
        categories: {
          connect: categoryIds?.map((id: number) => ({ id })) || []
        },
        annualFee: String(annualFee || ''), 
        cardNetwork: cardNetwork || '', 
        effectiveFree: Boolean(effectiveFree), 
        recommended: Boolean(recommended),
        rating: Number(rating || 0),
        bulletPoints: { create: bulletPoints || [] },
        summaryCharges: { create: summaryCharges || [] },
        requiredDocuments: { create: requiredDocuments || [] },
        processSteps: { create: processSteps || [] },
        keyStatement,
        createdById: req.user?.id
      }
    });
    res.json(product);
  } catch (err: any) {
    console.error("Create credit card error:", err);
    res.status(500).json({ error: "Failed to create credit card", details: err.message });
  }
});

// Get single credit card product
router.get("/products/credit-card/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.creditCardProduct.findUnique({
      where: { id: Number(id) },
      include: {
        categories: true,
        bulletPoints: true,
        summaryCharges: true,
        requiredDocuments: true,
        processSteps: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Credit card not found" });
    }

    res.json(product);
  } catch (err: any) {
    console.error("Get credit card error:", err);
    res.status(500).json({ error: "Failed to fetch credit card", details: err.message });
  }
});

// Update credit card product
router.put("/products/credit-card/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name, slug, bankName, bankLogoUrl, imageUrl,
      annualFee, cardNetwork, effectiveFree, recommended, rating,
      keyStatement,
    } = req.body;

    const product = await prisma.creditCardProduct.update({
      where: { id: Number(id) },
      data: {
        name,
        slug,
        bankName,
        bankLogoUrl,
        imageUrl,
        annualFee: String(annualFee || ''),
        cardNetwork,
        effectiveFree: Boolean(effectiveFree),
        recommended: Boolean(recommended),
        rating: Number(rating || 0),
        keyStatement,
      },
    });

    res.json(product);
  } catch (err: any) {
    console.error("Update credit card error:", err);
    res.status(500).json({ error: "Failed to update credit card", details: err.message });
  }
});

// Delete credit card product (and dependent records)
router.delete("/products/credit-card/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cardId = Number(id);

    await prisma.$transaction(async (tx: any) => {
      await tx.application.updateMany({ where: { cardId }, data: { cardId: null } });
      await tx.creditCardBullet.deleteMany({ where: { productId: cardId } });
      await tx.creditCardSummaryCharge.deleteMany({ where: { productId: cardId } });
      await tx.creditCardRequiredDocument.deleteMany({ where: { productId: cardId } });
      await tx.creditCardProcessStep.deleteMany({ where: { productId: cardId } });
      await tx.creditCardProduct.delete({ where: { id: cardId } });
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete credit card error:", err);
    res.status(500).json({ error: "Failed to delete credit card", details: err.message });
  }
});

// --- INSURANCE ---

router.get("/insurance", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const insurance = await prisma.insuranceProduct.findMany({
      include: { category: true }
    });
    res.json(insurance);
  } catch (err) {
    console.error("Insurance error:", err);
    res.status(500).json({ error: "Failed to fetch insurance" });
  }
});

router.post("/products/insurance", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, slug, provider, logoUrl, link, description, imageUrl, type, categoryId } = req.body;
    
    // Validate required fields
    if (!name || !slug || !provider) {
      return res.status(400).json({ error: "Name, slug, and provider are required" });
    }

    const product = await prisma.insuranceProduct.create({
      data: { 
        name, 
        slug, 
        provider, 
        logoUrl: logoUrl || '', 
        type: type || 'General', 
        description: description || '', 
        minPremium: 0, 
        coverage: '0',
        categoryId: categoryId ? Number(categoryId) : null,
        createdById: req.user?.id
      }
    });
    res.json(product);
  } catch (err: any) {
    console.error("Create insurance error:", err);
    res.status(500).json({ error: "Failed to create insurance", details: err.message });
  }
});

// Get single insurance product by ID
router.get("/products/insurance/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const insuranceId = Number(id);

    const insurance = await prisma.insuranceProduct.findUnique({
      where: { id: insuranceId },
      include: {
        category: true,
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });

    if (!insurance) {
      return res.status(404).json({ error: "Insurance product not found" });
    }

    res.json(insurance);
  } catch (err: any) {
    console.error("Get insurance error:", err);
    res.status(500).json({ error: "Failed to fetch insurance", details: err.message });
  }
});

// Update insurance product
router.put("/products/insurance/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const insuranceId = Number(id);
    const { name, slug, provider, logoUrl, link, description, imageUrl, type, categoryId, minPremium, coverage } = req.body;

    const updatedInsurance = await prisma.insuranceProduct.update({
      where: { id: insuranceId },
      data: {
        name,
        slug,
        provider,
        logoUrl,
        type,
        description,
        minPremium: minPremium ? Number(minPremium) : undefined,
        coverage,
        categoryId: categoryId ? Number(categoryId) : null
      }
    });

    res.json(updatedInsurance);
  } catch (err: any) {
    console.error("Update insurance error:", err);
    res.status(500).json({ error: "Failed to update insurance", details: err.message });
  }
});

// Delete insurance product (and detach from applications)
router.delete("/products/insurance/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const insuranceId = Number(id);

    await prisma.$transaction(async (tx: any) => {
      await tx.application.updateMany({ where: { insuranceId }, data: { insuranceId: null } });
      await tx.insuranceProduct.delete({ where: { id: insuranceId } });
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete insurance error:", err);
    res.status(500).json({ error: "Failed to delete insurance", details: err.message });
  }
});

// --- APPS ---

router.get("/apps", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const apps = await prisma.appProduct.findMany();
    res.json(apps);
  } catch (err) {
    console.error("Apps error:", err);
    res.status(500).json({ error: "Failed to fetch apps" });
  }
});

router.post("/products/app", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, downloadUrl, logoUrl } = req.body;
    
    // Validate required fields
    if (!name || !downloadUrl) {
      return res.status(400).json({ error: "Name and download URL are required" });
    }

    const product = await prisma.appProduct.create({
      data: { 
        name, 
        description: description || '', 
        downloadUrl, 
        logoUrl: logoUrl || '',
        createdById: req.user?.id
      }
    });
    res.json(product);
  } catch (err: any) {
    console.error("Create app error:", err);
    res.status(500).json({ error: "Failed to create app", details: err.message });
  }
});

// Get single app product by ID
router.get("/products/app/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const appId = Number(id);

    const app = await prisma.appProduct.findUnique({
      where: { id: appId },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      }
    });

    if (!app) {
      return res.status(404).json({ error: "App not found" });
    }

    res.json(app);
  } catch (err: any) {
    console.error("Get app error:", err);
    res.status(500).json({ error: "Failed to fetch app", details: err.message });
  }
});

// Update app product
router.put("/products/app/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const appId = Number(id);
    const { name, description, downloadUrl, logoUrl } = req.body;

    const updatedApp = await prisma.appProduct.update({
      where: { id: appId },
      data: { 
        name, 
        description: description || '', 
        downloadUrl, 
        logoUrl: logoUrl || '' 
      }
    });

    res.json(updatedApp);
  } catch (err: any) {
    console.error("Update app error:", err);
    res.status(500).json({ error: "Failed to update app", details: err.message });
  }
});

// Delete app product
router.delete("/products/app/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const appId = Number(id);

    await prisma.appProduct.delete({ where: { id: appId } });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Delete app error:", err);
    res.status(500).json({ error: "Failed to delete app", details: err.message });
  }
});

// --- APPLICATIONS ---

router.get("/applications/export", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period } = req.query;
    let dateFilter = {};
    const now = new Date();

    if (period === 'daily') {
      dateFilter = { createdAt: { gte: new Date(now.setHours(0,0,0,0)) } };
    } else if (period === 'weekly') {
      const lastWeek = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { createdAt: { gte: lastWeek } };
    } else if (period === 'monthly') {
      const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
      dateFilter = { createdAt: { gte: lastMonth } };
    } else if (period === 'yearly') {
      const lastYear = new Date(now.setFullYear(now.getFullYear() - 1));
      dateFilter = { createdAt: { gte: lastYear } };
    }

    const applications = await prisma.application.findMany({
      where: dateFilter,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        loan: { select: { title: true } },
        card: { select: { name: true } },
        insurance: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Applications');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'User Name', key: 'userName', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Product', key: 'product', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Date', key: 'date', width: 20 },
    ];

    applications.forEach((app: any) => {
      let productName = 'N/A';
      if (app.loan) productName = app.loan.title;
      else if (app.card) productName = app.card.name;
      else if (app.insurance) productName = app.insurance.name;

      worksheet.addRow({
        id: app.id,
        userName: app.user?.name || 'Unknown',
        email: app.user?.email || 'N/A',
        phone: app.user?.phone || 'N/A',
        type: app.type,
        product: productName,
        status: app.status,
        date: app.createdAt.toISOString().split('T')[0]
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=applications.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Failed to export applications" });
  }
});

router.get("/applications", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period, status, categorySlug, type } = req.query;
    let whereFilter: any = {};

    // Date filter
    const now = new Date();
    if (period === 'daily') {
      whereFilter.createdAt = { gte: new Date(now.setHours(0,0,0,0)) };
    } else if (period === 'weekly') {
      const lastWeek = new Date(now.setDate(now.getDate() - 7));
      whereFilter.createdAt = { gte: lastWeek };
    } else if (period === 'monthly') {
      const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
      whereFilter.createdAt = { gte: lastMonth };
    } else if (period === 'yearly') {
      const lastYear = new Date(now.setFullYear(now.getFullYear() - 1));
      whereFilter.createdAt = { gte: lastYear };
    }

    // Status filter
    if (status) {
      whereFilter.status = status as string;
    }

    // Category filter
    if (categorySlug) {
      whereFilter.categorySlug = categorySlug as string;
    }

    // Type filter (loan/card/insurance)
    if (type) {
      whereFilter.productType = type as string;
    }

    const applications = await prisma.application.findMany({
      where: whereFilter,
      include: {
        user: { select: { name: true, email: true, phone: true } },
        loan: { select: { title: true, slug: true } },
        card: { select: { name: true } },
        insurance: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const count = await prisma.application.count({ where: whereFilter });

    res.json({ 
      success: true, 
      applications, 
      count 
    });
  } catch (err) {
    console.error("Applications error:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

router.put("/applications/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;

    // Validate status enum
    const validStatuses = ['PENDING', 'PROCESSING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'WITHDRAWN'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: "Invalid status value", 
        validStatuses,
        receivedStatus: status 
      });
    }

    console.log(`Updating application ${id} with status: ${status}, feedback: ${feedback ? 'provided' : 'none'}`);

    const application = await prisma.application.update({
      where: { id: Number(id) },
      data: { 
        status,
        feedback,
        updatedAt: new Date()
      }
    });

    console.log(`Application ${id} updated successfully to status: ${application.status}`);

    res.json(application);
  } catch (err: any) {
    console.error("Update application error:", err);
    res.status(500).json({ error: "Failed to update application", details: err.message });
  }
});

// --- UNIFIED PRODUCTS LIST ---

router.get("/products", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const loans = await prisma.loanProduct.findMany({ 
      include: { category: true },
      orderBy: { createdAt: 'desc' }
    });
    
    const cards = await prisma.creditCardProduct.findMany({ 
      include: { categories: true },
      orderBy: { createdAt: 'desc' }
    });
    
    const insurance = await prisma.insuranceProduct.findMany({ 
      include: { category: true },
      orderBy: { createdAt: 'desc' }
    });
    
    const apps = await prisma.appProduct.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const formattedLoans = loans.map((l: any) => ({
      id: l.id,
      title: l.title,
      type: 'Loan',
      category: l.category?.name || 'Uncategorized',
      bank: l.bankName,
      status: 'Active'
    }));

    const formattedCards = cards.map((c: any) => ({
      id: c.id,
      title: c.name,
      type: 'Credit Card',
      category: c.categories.map((cat: any) => cat.name).join(", ") || 'Uncategorized',
      bank: c.bankName,
      status: 'Active'
    }));

    const formattedInsurance = insurance.map((i: any) => ({
      id: i.id,
      title: i.name,
      type: 'Insurance',
      category: i.category?.name || i.type || 'Uncategorized',
      bank: i.provider,
      status: 'Active'
    }));

    const formattedApps = apps.map((a: any) => ({
      id: a.id,
      title: a.name,
      type: 'App',
      category: 'App',
      bank: 'N/A',
      status: 'Active'
    }));

    res.json([...formattedLoans, ...formattedCards, ...formattedInsurance, ...formattedApps]);
  } catch (err) {
    console.error("Products error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

export default router;