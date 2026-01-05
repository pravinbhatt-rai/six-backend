import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
import { sendApplicationConfirmationEmail } from "../utils/emailService";

const prisma = new PrismaClient();
const router = Router();

/**
 * Generate a unique reference number with format: SIX-[TYPE]-[CATEGORY]-[ID]-[CHECKSUM]
 * Example: SIX-L-PL-00123-A7
 * 
 * TYPE Codes:
 * L = Loan
 * C = Credit Card
 * I = Insurance
 * A = App
 * 
 * CATEGORY: First 2-3 letters of category slug (uppercase)
 * ID: Padded application ID
 * CHECKSUM: 2-character hash for validation
 */
function generateReferenceNumber(
  applicationId: number,
  productType: string,
  categorySlug?: string
): string {
  // Get type code
  const typeMap: Record<string, string> = {
    'LOAN': 'L',
    'CREDIT_CARD': 'C',
    'INSURANCE': 'I',
    'APP': 'A'
  };
  const typeCode = typeMap[productType] || 'X';
  
  // Get category code (first 2-3 letters, max 3 chars)
  let categoryCode = 'GEN'; // Default: General
  if (categorySlug) {
    // Remove common words and get meaningful code
    const cleanSlug = categorySlug
      .replace(/-loan|-card|-insurance/gi, '')
      .replace(/-/g, '')
      .toUpperCase();
    
    if (cleanSlug.length >= 2) {
      categoryCode = cleanSlug.substring(0, 3);
    }
  }
  
  // Pad application ID to 5 digits
  const idStr = applicationId.toString().padStart(5, '0');
  
  // Generate 2-character checksum
  const checksumInput = `${typeCode}${categoryCode}${idStr}`;
  let checksum = 0;
  for (let i = 0; i < checksumInput.length; i++) {
    checksum += checksumInput.charCodeAt(i);
  }
  const checksumStr = (checksum % 36).toString(36).toUpperCase().padStart(2, '0');
  
  return `SIX-${typeCode}-${categoryCode}-${idStr}-${checksumStr}`;
}

router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      panNumber,
      employmentType,
      monthlyIncome,
      employerName,
      workExperience,
      residenceType,
      city,
      pincode,
      loanAmount,
      productId,
      productType, // 'LOAN', 'CREDIT_CARD', 'INSURANCE', 'LOAN_AGAINST_SECURITY'
      categorySlug,
      categoryName,
      loanSlug,
      documents,   // Array of { title, url }
    } = req.body;

    console.log('Received application:', { 
      email, 
      phone, 
      productType, 
      categorySlug, 
      categoryName,
      employmentType 
    });

    // Normalize phone number to prevent duplicates like +91+91
    const normalizedPhone = normalizePhoneNumber(phone);

    // 1. Find or Create User
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone: normalizedPhone }],
      },
    });
    
    if (!user) {
      // Create new user with dummy password
      const hashedPassword = await bcrypt.hash("Password@123", 10);
      user = await prisma.user.create({
        data: {
          name: name || 'User',
          email,
          phone: normalizedPhone,
          passwordHash: hashedPassword,
          panCard: panNumber,
          city,
          pincode,
          employmentType,
        },
      });
      console.log('Created new user:', user.id);
    } else {
        // Update user details - save employment information to profile
        const updateData: any = {
            name: name || user.name,
            panCard: panNumber || user.panCard,
            city: city || user.city,
            pincode: pincode || user.pincode,
            employmentType: employmentType || user.employmentType,
        };
        
        // Save employment details to user profile for future use
        if (employerName) updateData.savedEmployerName = employerName;
        if (workExperience) updateData.savedWorkExperience = workExperience;
        if (residenceType) updateData.savedResidenceType = residenceType;
        if (monthlyIncome) updateData.monthlyIncome = parseFloat(String(monthlyIncome).replace(/[^0-9.]/g, ''));
        
        await prisma.user.update({
            where: { id: user.id },
            data: updateData
        });
        console.log('Updated existing user with employment details:', user.id);
    }

    // 2. Get Category ID if slug provided
    let categoryId = null;
    if (categorySlug) {
      const category = await prisma.category.findUnique({
        where: { slug: categorySlug }
      });
      if (category) {
        categoryId = category.id;
      }
    }

    // 3. Create Application
    // Map LOAN_AGAINST_SECURITY to LOAN for the database enum
    let dbProductType = productType;
    if (productType === 'LOAN_AGAINST_SECURITY') {
        dbProductType = 'LOAN';
    }

    const applicationData: any = {
      userId: user.id,
      type: dbProductType,
      status: "PENDING",
      amount: loanAmount ? parseFloat(String(loanAmount).replace(/[^0-9.]/g, '')) : 0,
      
      // Category information
      categoryId,
      categorySlug,
      categoryName,
      
      // Employment details
      employmentType,
      monthlyIncome: monthlyIncome ? String(monthlyIncome) : null,
      employerName,
      workExperience: workExperience ? String(workExperience) : null,
      
      // Residence details
      residenceType,
      city,
      pincode,
      
      // Contact details
      phone: normalizedPhone,
      email,
      panNumber,
      applicantName: name || user.name,
      
      // Notes for backward compatibility
      notes: `Type: ${categoryName || productType}, Employer: ${employerName}, Experience: ${workExperience}, Residence: ${residenceType}, Income: ${monthlyIncome}`,
      documents: documents || [],
    };

    // Link to specific product if provided
    if (dbProductType === 'LOAN' && productId) {
      applicationData.loanId = Number(productId);
    }
    if (dbProductType === 'CREDIT_CARD' && productId) {
      applicationData.cardId = Number(productId);
    }
    if (dbProductType === 'INSURANCE' && productId) {
      applicationData.insuranceId = Number(productId);
    }

    const application = await prisma.application.create({
      data: applicationData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        loan: {
          select: {
            id: true,
            bankName: true,
            slug: true
          }
        }
        // Removed category from include as it's causing the error
      }
    });

    console.log('Application created:', application.id);

    // Generate smart reference number
    const referenceNo = generateReferenceNumber(
      application.id,
      dbProductType,
      categorySlug
    );

    // Update application with reference number
    await prisma.application.update({
      where: { id: application.id },
      data: { referenceNo }
    });

    // Send application confirmation email (non-blocking)
    const productDisplayName = categoryName || 
      (application.loan?.bankName ? `${application.loan.bankName} Loan` : productType.replace('_', ' '));
    
    const productTypeFormatted = dbProductType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 
                                 dbProductType === 'INSURANCE' ? 'INSURANCE' : 'LOAN';
    
    sendApplicationConfirmationEmail(
      application.user.email,
      application.user.name,
      productDisplayName,
      productTypeFormatted,
      referenceNo
    ).catch((err: any) => {
      console.error("[Application Email] Failed to send application confirmation:", err);
      // Don't fail the application if email fails
    });

    console.log(`[Application Email] Confirmation email queued for ${application.user.email} (Ref: ${referenceNo})`);

    res.json({ 
      success: true, 
      application: {
        id: application.id,
        type: application.type,
        categoryName: categoryName || null,
        status: application.status,
        amount: application.amount,
        referenceNo
      },
      referenceNo
    });
  } catch (err: any) {
    console.error("Application Error:", err);
    res.status(500).json({ error: "Failed to submit application", details: err.message });
  }
});

// Optional: Add other routes for your applications
router.get("/", async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        loan: {
          select: {
            id: true,
            bankName: true,
            slug: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(applications);
  } catch (err: any) {
    console.error("Error fetching applications:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const application = await prisma.application.findUnique({
      where: { id: Number(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        loan: {
          select: {
            id: true,
            bankName: true,
            slug: true
          }
           
        }
      }
    });
    
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }
    
    res.json(application);
  } catch (err: any) {
    console.error("Error fetching application:", err);
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const application = await prisma.application.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
    
    res.json({ 
      success: true, 
      message: "Status updated successfully",
      application 
    });
  } catch (err: any) {
    console.error("Error updating application status:", err);
    res.status(500).json({ error: "Failed to update application status" });
  }
});

export default router;