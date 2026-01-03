import { PrismaClient, ProductType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const loanCategories = [
    "Personal Loan",
    "Business Loan",
    "Professional Loan",
    "Transfer Personal Loan",
    "Home Loan",
    "Loan Against Property",
    "Transfer Home Loan",
    "Loan Against Security",
    "Used Car",
    "Used Bike",
    "New Car",
    "New Bike"
  ];

  const insuranceCategories = [
    "Health Insurance",
    "Car Insurance"
  ];

  console.log('Seeding Loan Categories...');
  for (const name of loanCategories) {
    const slug = name.toLowerCase().replace(/ /g, '-');
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug,
        type: ProductType.LOAN,
        description: `${name} products`
      }
    });
  }

  console.log('Seeding Insurance Categories...');
  for (const name of insuranceCategories) {
    const slug = name.toLowerCase().replace(/ /g, '-');
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug,
        type: ProductType.INSURANCE,
        description: `${name} products`
      }
    });
  }

  // Ensure a generic Credit Card category exists if needed for the relation, 
  // though the requirement says "Flat list", the schema might require a category relation.
  // We'll create one generic category just in case, or we can skip if the relation is optional.
  // Looking at schema: CreditCardProduct has `categories Category[]`. It's a many-to-many.
  // So we don't strictly need a category if we don't want to assign one, but for consistency:
  
  const ccSlug = 'credit-cards';
  await prisma.category.upsert({
    where: { slug: ccSlug },
    update: {},
    create: {
      name: 'Credit Cards',
      slug: ccSlug,
      type: ProductType.CREDIT_CARD,
      description: 'All Credit Cards'
    }
  });

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
