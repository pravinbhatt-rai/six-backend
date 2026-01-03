import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// Get all credit cards
router.get("/", async (_req, res) => {
  try {
    const cards = await prisma.creditCardProduct.findMany({
      include: {
        bulletPoints: { orderBy: { displayOrder: "asc" } },
        categories: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ cards });
  } catch (err: any) {
    console.error("Credit Cards Error:", err);
    res.status(500).json({ error: "Failed to fetch credit cards", details: err.message });
  }
});

// Get credit cards by category slug
router.get("/by-category/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        creditCards: {
          include: {
            bulletPoints: { orderBy: { displayOrder: "asc" } },
            categories: true
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ category });
  } catch (err: any) {
    console.error("Credit Cards by Category Error:", err);
    res.status(500).json({ error: "Failed to fetch credit cards by category", details: err.message });
  }
});

// Get single credit card by slug with full details
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const card = await prisma.creditCardProduct.findUnique({
      where: { slug },
      include: {
        bulletPoints: { orderBy: { displayOrder: "asc" } },
        summaryCharges: { orderBy: { displayOrder: "asc" } },
        requiredDocuments: { orderBy: { displayOrder: "asc" } },
        processSteps: { orderBy: { displayOrder: "asc" } },
        categories: true,
      },
    });

    if (!card) {
      return res.status(404).json({ error: "Credit card not found" });
    }

    res.json({ card });
  } catch (err: any) {
    console.error("Credit Card Details Error:", err);
    res.status(500).json({ error: "Failed to fetch credit card details", details: err.message });
  }
});

export default router;
