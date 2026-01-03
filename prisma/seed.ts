import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: "Personal Loan", slug: "personalloan" },
  { name: "Credit Card", slug: "credit-card" },
  { name: "Business Loan", slug: "business-loan" },
  { name: "Professional Loan", slug: "professional-loan" },
  { name: "Transfer Personal Loan", slug: "transfer-personal-loan" },
  { name: "Home Loan", slug: "home-loan" },
  { name: "Loan Against Property", slug: "loan-against-property" },
  { name: "Transfer Home Loan", slug: "transfer-home-loan" },
  { name: "Loan Against Security", slug: "loan-against-security" },
  { name: "Education Loan", slug: "education-loan" },
  { name: "Used Car", slug: "used-car" },
  { name: "Used Bike", slug: "used-bike" },
  { name: "New Car", slug: "new-car" },
  { name: "New Bike", slug: "new-bike" },
  { name: "Car Insurance", slug: "car-insurance" },
  { name: "Health Insurance", slug: "health-insurance" },
];

async function main() {
  console.log('Start seeding ...');
  
  // Seed Categories
  for (const cat of categories) {
    const existing = await prisma.category.findUnique({ where: { slug: cat.slug } });
    if (!existing) {
      await prisma.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          description: `All about ${cat.name}`,
          type: "LOAN",
        },
      });
      console.log(`✓ Created category: ${cat.name}`);
    } else {
      console.log(`  Category already exists: ${cat.name}`);
    }
  }

  // Get Personal Loan Category
  const personalLoanCategory = await prisma.category.findUnique({
    where: { slug: "personalloan" },
  });

  if (!personalLoanCategory) {
    console.error("❌ Personal Loan category not found");
    return;
  }

  console.log(`📦 Personal Loan Category ID: ${personalLoanCategory.id}`);

  // Delete existing loans to reseed
  const existingLoans = await prisma.loanProduct.findMany({
    where: { categoryId: personalLoanCategory.id }
  });
  
  for (const loan of existingLoans) {
    await prisma.loanBullet.deleteMany({ where: { productId: loan.id } });
    await prisma.loanProduct.delete({ where: { id: loan.id } });
  }
  
  console.log(`🗑️  Deleted ${existingLoans.length} existing personal loans`);

  // Seed Sample Loans with bullets
  const loansWithBullets = [
    {
      loan: {
        title: "HDFC Bank Personal Loan",
        slug: "hdfc-personal-loan",
        bankName: "HDFC Bank",
        bankLogoUrl: "/bank-logos/hdfc.png",
        processTimeLabel: "Disbursal Time",
        processTimeValue: "Within 24 hours",
        chanceOfApproval: "High",
        approvalScore: 85,
        interestRateText: "10.5% - 21% p.a.",
        aprText: "10.5% - 21%",
        emiAmount: "₹2,048/month",
        emiValue: 2048,
        processTypeLabel: "Processing Fee",
        processTypeValue: "Up to 2.5%",
        disbursalTimeHours: 24,
        keyStatement: "Get instant approval with minimal documentation",
        categoryId: personalLoanCategory.id,
      },
      bullets: [
        { text: "Loan amount up to ₹40 Lakhs", displayOrder: 1 },
        { text: "Flexible tenure from 12 to 60 months", displayOrder: 2 },
        { text: "Minimal documentation required", displayOrder: 3 },
        { text: "No collateral needed", displayOrder: 4 },
      ]
    },
    {
      loan: {
        title: "ICICI Bank Instant Personal Loan",
        slug: "icici-instant-personal-loan",
        bankName: "ICICI Bank",
        bankLogoUrl: "/bank-logos/icici.png",
        processTimeLabel: "Disbursal Time",
        processTimeValue: "Instant",
        chanceOfApproval: "Very High",
        approvalScore: 90,
        interestRateText: "10.75% - 19% p.a.",
        aprText: "10.75% - 19%",
        emiAmount: "₹2,124/month",
        emiValue: 2124,
        processTypeLabel: "Processing Fee",
        processTypeValue: "2%",
        disbursalTimeHours: 1,
        keyStatement: "Pre-approved loan offers with instant disbursal",
        categoryId: personalLoanCategory.id,
      },
      bullets: [
        { text: "Pre-approved loan for existing customers", displayOrder: 1 },
        { text: "Instant disbursal to your account", displayOrder: 2 },
        { text: "Loan amount up to ₹25 Lakhs", displayOrder: 3 },
        { text: "Digital process - No branch visit", displayOrder: 4 },
      ]
    },
    {
      loan: {
        title: "Axis Bank Personal Loan",
        slug: "axis-personal-loan",
        bankName: "Axis Bank",
        bankLogoUrl: "/bank-logos/axis.png",
        processTimeLabel: "Disbursal Time",
        processTimeValue: "48 hours",
        chanceOfApproval: "High",
        approvalScore: 82,
        interestRateText: "10.49% - 22% p.a.",
        aprText: "10.49% - 22%",
        emiAmount: "₹2,039/month",
        emiValue: 2039,
        processTypeLabel: "Processing Fee",
        processTypeValue: "Up to 2%",
        disbursalTimeHours: 48,
        keyStatement: "Competitive interest rates with flexible repayment",
        categoryId: personalLoanCategory.id,
      },
      bullets: [
        { text: "Loan amount up to ₹15 Lakhs", displayOrder: 1 },
        { text: "Tenure up to 5 years", displayOrder: 2 },
        { text: "Attractive interest rates", displayOrder: 3 },
        { text: "Easy online application", displayOrder: 4 },
      ]
    },
    {
      loan: {
        title: "SBI Personal Loan",
        slug: "sbi-personal-loan",
        bankName: "State Bank of India",
        bankLogoUrl: "/bank-logos/sbi.png",
        processTimeLabel: "Disbursal Time",
        processTimeValue: "3-5 days",
        chanceOfApproval: "High",
        approvalScore: 80,
        interestRateText: "11.15% - 15.40% p.a.",
        aprText: "11.15% - 15.40%",
        emiAmount: "₹2,182/month",
        emiValue: 2182,
        processTypeLabel: "Processing Fee",
        processTypeValue: "1.5%",
        disbursalTimeHours: 72,
        keyStatement: "India's most trusted bank for personal loans",
        categoryId: personalLoanCategory.id,
      },
      bullets: [
        { text: "Loan amount up to ₹20 Lakhs", displayOrder: 1 },
        { text: "Lowest processing charges", displayOrder: 2 },
        { text: "Special rates for existing customers", displayOrder: 3 },
        { text: "Doorstep service available", displayOrder: 4 },
      ]
    },
  ];

  for (const { loan, bullets } of loansWithBullets) {
    const createdLoan = await prisma.loanProduct.create({
      data: loan,
    });
    
    for (const bullet of bullets) {
      await prisma.loanBullet.create({
        data: {
          ...bullet,
          productId: createdLoan.id,
        },
      });
    }
    
    console.log(`✓ Created ${loan.title} with ${bullets.length} bullets`);
  }

  console.log('✅ Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
