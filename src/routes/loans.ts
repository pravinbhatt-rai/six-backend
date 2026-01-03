import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// ============================================
// LOAN CATEGORIES ENDPOINT
// ============================================

/**
 * GET /api/loans/category/:categorySlug
 * Get loans by category slug (for UniversalBankCard component)
 */
router.get("/category/:categorySlug", async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    
    // Get category with its loans
    const category = await prisma.category.findUnique({
      where: { 
        slug: categorySlug,
        type: 'LOAN'
      },
      include: {
        loans: {
          include: {
            bullets: {
              select: { 
                text: true, 
                displayOrder: true 
              },
              orderBy: { displayOrder: "asc" },
            },
            footerItems: {
              select: {
                text: true,
                displayOrder: true
              },
              orderBy: { displayOrder: "asc" },
            }
          },
          orderBy: { createdAt: "desc" },
        }
      }
    });

    if (!category) {
      return res.status(404).json({ 
        success: false,
        error: "Category not found" 
      });
    }

    // Transform loans to match frontend interface
    const products = category.loans.map((loan: any) => ({
      id: loan.id,
      title: loan.title,
      slug: loan.slug,
      bankName: loan.bankName,
      bankLogoUrl: loan.bankLogoUrl || '',
      processTimeLabel: loan.processTimeLabel || '',
      processTimeValue: loan.processTimeValue || '',
      chanceOfApproval: loan.chanceOfApproval || '',
      approvalScore: loan.approvalScore || 0,
      interestRateText: loan.interestRateText || '',
      aprText: loan.aprText || '',
      emiAmount: loan.emiAmount || '',
      emiValue: loan.emiValue || 0,
      processTypeLabel: loan.processTypeLabel || '',
      processTypeValue: loan.processTypeValue || '',
      disbursalTimeHours: loan.disbursalTimeHours || 0,
      keyStatement: loan.keyStatement || '',
      bullets: loan.bullets || [],
      footerItems: loan.footerItems || []
    }));

    res.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        type: category.type
      },
      products, // This matches what your frontend expects
      count: products.length
    });

  } catch (err: any) {
    console.error("Loans by Category Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch loans by category", 
      details: err.message 
    });
  }
});

// ============================================
// LOAN DETAILS ENDPOINT (for /api/loans/details/${loan.slug})
// ============================================

/**
 * GET /api/loans/details/:slug
 * Get full loan details for the drawer component
 */
router.get("/details/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const loan = await prisma.loanProduct.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            name: true,
            slug: true
          }
        },
        bullets: {
          select: { 
            text: true, 
            displayOrder: true 
          },
          orderBy: { displayOrder: "asc" }
        },
        summaryCharges: {
          select: { 
            label: true, 
            mainText: true, 
            subText: true, 
            displayOrder: true 
          },
          orderBy: { displayOrder: "asc" }
        },
        requiredDocuments: {
          select: { 
            title: true, 
            description: true, 
            displayOrder: true 
          },
          orderBy: { displayOrder: "asc" }
        },
        processSteps: {
          select: { 
            title: true, 
            description: true, 
            displayOrder: true 
          },
          orderBy: { displayOrder: "asc" }
        }
      }
    });

    if (!loan) {
      return res.status(404).json({ 
        success: false,
        error: "Loan not found" 
      });
    }

    // Format the response to match LoanDetailsData interface
    const loanDetails = {
      id: loan.id,
      title: loan.title,
      slug: loan.slug,
      bankName: loan.bankName,
      bankLogoUrl: loan.bankLogoUrl || '',
      emiAmount: loan.emiAmount || '₹ 2,000',
      emiExample: loan.emiAmount || '₹ 2,000',
      interestRateText: loan.interestRateText || '',
      aprText: loan.aprText || '',
      processTimeLabel: loan.processTimeLabel || '',
      chanceOfApproval: loan.chanceOfApproval || '',
      keyStatement: loan.keyStatement || '',
      summaryCharges: loan.summaryCharges.map((charge: any) => ({
        label: charge.label,
        mainText: charge.mainText,
        subText: charge.subText
      })),
      requiredDocuments: loan.requiredDocuments.map((doc: any) => ({
        title: doc.title,
        description: doc.description
      })),
      processSteps: loan.processSteps.map((step: any) => ({
        title: step.title,
        description: step.description
      })),
      bullets: loan.bullets || []
    };

    res.json({ 
      success: true,
      loan: loanDetails
    });

  } catch (err: any) {
    console.error("Loan Details Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch loan details", 
      details: err.message 
    });
  }
});

export default router;