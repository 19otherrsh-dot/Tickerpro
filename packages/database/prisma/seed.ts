import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding TickerPro database...\n");

  // ── 1. Create super admin user ───────────────────────────────────
  const passwordHash = await bcrypt.hash("admin123456", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@tickerpro.com" },
    update: {},
    create: {
      email: "admin@tickerpro.com",
      passwordHash,
      firstName: "John",
      lastName: "Doe",
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // ── 2. Create workspace ──────────────────────────────────────────
  const workspace = await prisma.workspace.upsert({
    where: { slug: "tickerpro-demo" },
    update: {},
    create: {
      name: "TickerPro Demo",
      slug: "tickerpro-demo",
      plan: "GROWTH",
    },
  });
  console.log("✅ Workspace created:", workspace.name);

  // ── 3. Add admin as super admin of workspace ─────────────────────
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: { userId: admin.id, workspaceId: workspace.id },
    },
    update: {},
    create: {
      userId: admin.id,
      workspaceId: workspace.id,
      role: "SUPER_ADMIN",
    },
  });
  console.log("✅ Admin linked to workspace as SUPER_ADMIN");

  // ── 4. Create agent users ────────────────────────────────────────
  const agents = [
    { email: "priya@tickerpro.com", firstName: "Priya", lastName: "Sharma", role: "ADMIN" as const },
    { email: "rahul@tickerpro.com", firstName: "Rahul", lastName: "Kumar", role: "AGENT" as const },
    { email: "sneha@tickerpro.com", firstName: "Sneha", lastName: "Patel", role: "AGENT" as const },
    { email: "arjun@tickerpro.com", firstName: "Arjun", lastName: "Desai", role: "VIEWER" as const },
  ];

  for (const agent of agents) {
    const user = await prisma.user.upsert({
      where: { email: agent.email },
      update: {},
      create: {
        email: agent.email,
        passwordHash,
        firstName: agent.firstName,
        lastName: agent.lastName,
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: { userId: user.id, workspaceId: workspace.id },
      },
      update: {},
      create: {
        userId: user.id,
        workspaceId: workspace.id,
        role: agent.role,
      },
    });
    console.log(`  ➜ Agent ${agent.firstName} (${agent.role})`);
  }
  console.log("✅ Team members created");

  // ── 5. Create WhatsApp numbers ───────────────────────────────────
  const numbers = [
    { phoneNumber: "+919876543210", displayName: "TickerPro Sales", quality: "GREEN" as const, phoneNumberId: "pn_sales_001" },
    { phoneNumber: "+918765432109", displayName: "Support Line", quality: "YELLOW" as const, phoneNumberId: "pn_support_002" },
    { phoneNumber: "+917654321098", displayName: "Marketing", quality: "GREEN" as const, phoneNumberId: "pn_marketing_003" },
  ];

  const createdNumbers: Array<{ id: string; phoneNumber: string }> = [];

  for (const num of numbers) {
    const created = await prisma.whatsAppNumber.upsert({
      where: { phoneNumberId: num.phoneNumberId },
      update: {},
      create: {
        workspaceId: workspace.id,
        wabaId: `waba_${num.phoneNumber.slice(-4)}`,
        phoneNumber: num.phoneNumber,
        phoneNumberId: num.phoneNumberId,
        displayName: num.displayName,
        qualityRating: num.quality,
        isVerified: true,
      },
    });
    createdNumbers.push({ id: created.id, phoneNumber: created.phoneNumber });
  }
  console.log("✅ WhatsApp numbers registered");

  // ── 6. Create contacts ───────────────────────────────────────────
  const contacts = [
    { phoneNumber: "+919876500001", name: "Priya Customer", email: "priya.c@example.com", stage: "QUALIFIED" as const },
    { phoneNumber: "+919876500002", name: "Rajesh Kumar", email: "rajesh@startup.io", stage: "NEW" as const },
    { phoneNumber: "+919876500003", name: "Anita Desai", email: "anita@corp.com", stage: "WON" as const },
    { phoneNumber: "+919876500004", name: "Mohammed Ali", email: "mali@biz.in", stage: "WON" as const },
    { phoneNumber: "+919876500005", name: "Sneha Customer", email: "sneha.c@retail.com", stage: "PROPOSAL" as const },
    { phoneNumber: "+919876500006", name: "Vikram Singh", email: "vikram@agency.co", stage: "NEGOTIATION" as const },
    { phoneNumber: "+919876500007", name: "Deepika Nair", email: "deepika@health.org", stage: "QUALIFIED" as const },
    { phoneNumber: "+919876500008", name: "Arjun Reddy", email: "arjun@edu.in", stage: "CONTACTED" as const },
  ];

  for (const c of contacts) {
    await prisma.contact.upsert({
      where: {
        phoneNumber_workspaceId: { workspaceId: workspace.id, phoneNumber: c.phoneNumber },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        phoneNumber: c.phoneNumber,
        name: c.name,
        email: c.email,
        leadStage: c.stage,
      },
    });
  }
  console.log("✅ 8 contacts created");

  // ── 7. Create chatbot flows ──────────────────────────────────────
  const flows = [
    { name: "Lead Qualification Flow", triggerKeywords: ["hi", "hello", "hey"], isActive: true },
    { name: "FAQ Auto-Responder", triggerKeywords: ["help", "faq", "question"], isActive: true },
    { name: "Appointment Scheduler", triggerKeywords: ["book", "appointment"], isActive: false },
    { name: "Order Status Tracker", triggerKeywords: ["order", "track", "status"], isActive: true },
  ];

  for (const flow of flows) {
    await prisma.chatbotFlow.create({
      data: {
        workspaceId: workspace.id,
        name: flow.name,
        triggerType: "KEYWORD",
        triggerValue: flow.triggerKeywords.join(","),
        flowData: { nodes: [], connections: [] },
        isActive: flow.isActive,
      },
    });
  }
  console.log("✅ 4 chatbot flows created");

  // ── 8. Create message templates ──────────────────────────────────
  const templates = [
    { name: "welcome_message", category: "MARKETING" as const, language: "en", bodyText: "Hi {{1}}! Welcome to {{2}}. We're thrilled to have you on board. 🎉", status: "APPROVED" as const },
    { name: "order_confirmation", category: "UTILITY" as const, language: "en", bodyText: "Your order #{{1}} has been confirmed! 📦\nEstimated delivery: {{2}}\nTotal: ₹{{3}}", status: "APPROVED" as const },
    { name: "abandoned_cart", category: "MARKETING" as const, language: "en", bodyText: "Hey {{1}}, you left some items in your cart! 🛒\nComplete your purchase now.", status: "APPROVED" as const },
    { name: "feedback_request", category: "UTILITY" as const, language: "hi", bodyText: "नमस्ते {{1}}! 🙏\nआपके अनुभव के बारे में हम जानना चाहेंगे।", status: "APPROVED" as const },
  ];

  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: {
        name_language_workspaceId: { name: t.name, language: t.language, workspaceId: workspace.id },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        name: t.name,
        category: t.category,
        language: t.language,
        bodyText: t.bodyText,
        status: t.status,
      },
    });
  }
  console.log("✅ 4 message templates created");

  // ── 9. Create sample conversations & messages ────────────────────
  const salesNumber = createdNumbers[0];
  if (salesNumber) {
    // Get first 3 contacts for sample conversations
    const sampleContacts = await prisma.contact.findMany({
      where: { workspaceId: workspace.id },
      take: 3,
    });

    for (const contact of sampleContacts) {
      const conversation = await prisma.conversation.create({
        data: {
          workspaceId: workspace.id,
          contactId: contact.id,
          whatsappNumberId: salesNumber.id,
          status: "OPEN",
          isUnread: true,
          lastMessageAt: new Date(),
        },
      });

      // Create a few sample messages per conversation
      await prisma.message.createMany({
        data: [
          {
            conversationId: conversation.id,
            direction: "INBOUND",
            type: "TEXT",
            content: { text: `Hi, I'm ${contact.name}. I need some help!` },
            status: "READ",
          },
          {
            conversationId: conversation.id,
            direction: "OUTBOUND",
            type: "TEXT",
            content: { text: `Hello ${contact.name}! How can we assist you today?` },
            status: "DELIVERED",
            senderId: admin.id,
          },
        ],
      });
    }
    console.log("✅ 3 sample conversations with messages created");
  }

  // ── 10. Create tags ──────────────────────────────────────────────
  const tags = [
    { name: "VIP", color: "#F59E0B" },
    { name: "Enterprise", color: "#6366F1" },
    { name: "Hot Lead", color: "#EF4444" },
    { name: "Nurture", color: "#10B981" },
    { name: "Follow Up", color: "#3B82F6" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: {
        name_workspaceId: { name: tag.name, workspaceId: workspace.id },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        name: tag.name,
        color: tag.color,
      },
    });
  }
  console.log("✅ 5 tags created");

  console.log("\n🎉 Seed complete! Login with: admin@tickerpro.com / admin123456");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
