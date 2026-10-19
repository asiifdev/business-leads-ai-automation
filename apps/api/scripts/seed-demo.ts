/**
 * Seeds a fictional demo workspace for screenshot capture.
 * All names, numbers and data are completely invented.
 * Run: DATABASE_URL=... npx tsx seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@prospex.local";
const DEMO_PASS = "DemoPass123!";
const DEMO_NAME = "Demo Owner";
const DEMO_WORKSPACE = "Northwind Web Studio";
const DEMO_SLUG = "northwind-web-studio-demo";

async function main() {
  console.log("Seeding demo workspace…");

  // Clean up any previous demo run
  await prisma.lead.deleteMany({ where: { workspace: { slug: DEMO_SLUG } } });
  await prisma.campaign.deleteMany({ where: { workspace: { slug: DEMO_SLUG } } });
  await prisma.knowledgeSource.deleteMany({ where: { workspace: { slug: DEMO_SLUG } } });
  await prisma.outboundMessage.deleteMany({ where: { workspace: { slug: DEMO_SLUG } } });
  await prisma.workspace.deleteMany({ where: { slug: DEMO_SLUG } });
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  // Create user + workspace
  const hash = await bcrypt.hash(DEMO_PASS, 10);
  const user = await prisma.user.create({
    data: {
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      emailVerified: true,
      accounts: {
        create: {
          accountId: DEMO_EMAIL,
          providerId: "credential",
          password: hash,
        },
      },
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: DEMO_WORKSPACE,
      slug: DEMO_SLUG,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });

  const wsId = workspace.id;

  // Campaign 1
  const camp1 = await prisma.campaign.create({
    data: {
      workspaceId: wsId,
      name: "Cafes in Yogyakarta",
      industry: "Food & Beverage",
      location: "Yogyakarta",
      searchQueries: ["cafe yogyakarta", "coffee shop yogyakarta"],
      yourService: "We build booking and online-ordering pages for cafes.",
      language: "english",
      status: "completed",
      progress: 100,
      completedAt: new Date("2026-10-10"),
      totalLeads: 6,
      priorityLeads: 4,
      highQualityLeads: 4,
      averageScore: 75.5,
    },
  });

  // Campaign 2
  const camp2 = await prisma.campaign.create({
    data: {
      workspaceId: wsId,
      name: "Dental Clinics in Surabaya",
      industry: "Healthcare",
      location: "Surabaya",
      searchQueries: ["dental clinic surabaya", "klinik gigi surabaya"],
      yourService: "We build patient booking pages for dental clinics.",
      language: "english",
      status: "completed",
      progress: 100,
      completedAt: new Date("2026-10-10"),
      totalLeads: 4,
      priorityLeads: 2,
      highQualityLeads: 2,
      averageScore: 69.0,
    },
  });

  // Leads — all fictional
  const leads = [
    {
      campaignId: camp1.id,
      name: "Kopi Tanah Liat",
      address: "Jl. Prawirotaman 21, Yogyakarta",
      phone: "+628125550101",
      phoneE164: "628125550101",
      rating: "4.7",
      reviewCount: 312,
      category: "Cafe",
      hasWebsite: false,
      score: 88,
      priority: "HIGH",
      crmStatus: "replied",
      repliedAt: new Date("2026-10-14"),
      contactedAt: new Date("2026-10-12"),
      province: "Daerah Istimewa Yogyakarta",
      regency: "Kota Yogyakarta",
      aiAnalysis: {
        factors: [
          "4.7 stars with 312 reviews — high trust signal",
          "No website or online booking detected",
          "Active on Google Maps with recent photos",
        ],
        recommendation: "Strong candidate — high foot traffic, clear digital gap.",
        fit: { fit: "high", reason: "High rating, strong review volume, no website." },
      },
      marketingContent: {
        email: {
          subject: "Quick idea for Kopi Tanah Liat",
          body: "Hi,\n\nI noticed Kopi Tanah Liat has 312 reviews at 4.7 stars — but no way for customers to book a table online. That gap costs you reservations every day.\n\nI'm from Northwind Web Studio. We build simple booking pages for cafes like yours in about a week.\n\nWould it be okay if I sent you an example?\n\nBest regards,",
        },
        linkedin: { connectionNote: "Hi — saw Kopi Tanah Liat is doing great on Google Maps. We help cafes add online booking. Would love to connect." },
        coldCall: { opening: "Hi, is this Kopi Tanah Liat? I'm calling from Northwind Web Studio — you have 312 reviews on Google, so clearly people love you. Have you ever tried online table reservations?" },
      },
    },
    {
      campaignId: camp1.id,
      name: "Sudut Baca Coffee",
      address: "Jl. Gejayan 14, Yogyakarta",
      phone: "+628225550104",
      phoneE164: "628225550104",
      rating: "4.8",
      reviewCount: 95,
      category: "Cafe",
      hasWebsite: false,
      score: 84,
      priority: "HIGH",
      crmStatus: "meeting",
      contactedAt: new Date("2026-10-11"),
      province: "Daerah Istimewa Yogyakarta",
      regency: "Kota Yogyakarta",
      aiAnalysis: {
        factors: [
          "4.8 rating is exceptional for a smaller cafe",
          "No online ordering found",
          "Study-cafe niche with loyal regulars",
        ],
        recommendation: "Good fit — niche appeal, strong loyalty base.",
        fit: { fit: "high", reason: "Exceptional rating; no digital ordering." },
      },
      marketingContent: {
        email: {
          subject: "Online ordering for Sudut Baca Coffee",
          body: "Hi,\n\nSudut Baca Coffee has a 4.8 rating — impressive for a study cafe. Yet there's no way for regulars to pre-order their drinks.\n\nI'm from Northwind Web Studio. We build ordering pages that fit right into a cafe's existing vibe.\n\nMay I send you a quick mockup?\n\nBest regards,",
        },
      },
    },
    {
      campaignId: camp1.id,
      name: "Warung Senja",
      address: "Jl. Kaliurang Km 5, Yogyakarta",
      phone: "+628135550102",
      phoneE164: "628135550102",
      website: "warungs.co.id",
      rating: "4.5",
      reviewCount: 208,
      category: "Cafe",
      hasWebsite: true,
      score: 81,
      priority: "HIGH",
      crmStatus: "contacted",
      contactedAt: new Date("2026-10-13"),
      province: "Daerah Istimewa Yogyakarta",
      regency: "Sleman",
      aiAnalysis: {
        factors: [
          "4.5 stars, 208 reviews — well-established",
          "Has a website but no booking functionality",
          "Outdoor seating popular for events",
        ],
        recommendation: "Worth pursuing — has web presence but no booking.",
        fit: { fit: "high", reason: "Has a website; booking upgrade is low friction." },
      },
    },
    {
      campaignId: camp1.id,
      name: "Nyala Kopi",
      address: "Jl. Cik Di Tiro 7, Yogyakarta",
      phone: "+628585550106",
      phoneE164: "628585550106",
      rating: "4.6",
      reviewCount: 176,
      category: "Cafe",
      hasWebsite: false,
      score: 79,
      priority: "HIGH",
      crmStatus: "won",
      dealValue: 2500000,
      contactedAt: new Date("2026-10-08"),
      province: "Daerah Istimewa Yogyakarta",
      regency: "Kota Yogyakarta",
      aiAnalysis: {
        factors: [
          "176 reviews with 4.6 average",
          "No booking page found",
          "Instagram-friendly interior noted in reviews",
        ],
        recommendation: "Likely fit — visual brand benefits from a booking page.",
        fit: { fit: "medium", reason: "Good rating; may be exploring options." },
      },
    },
    {
      campaignId: camp1.id,
      name: "Teras Ramen",
      address: "Jl. Kusumanegara 40, Yogyakarta",
      phone: "+628775550107",
      phoneE164: "628775550107",
      rating: "4.0",
      reviewCount: 44,
      category: "Restaurant",
      hasWebsite: false,
      score: 47,
      priority: "LOW",
      crmStatus: "new",
      province: "Daerah Istimewa Yogyakarta",
      regency: "Kota Yogyakarta",
      aiAnalysis: {
        factors: [
          "Newer business, fewer reviews",
          "No web presence detected",
          "Ramen niche is growing but competitive",
        ],
        recommendation: "Low priority — too early stage.",
        fit: { fit: "low", reason: "Low review count; business still finding its feet." },
      },
    },
    {
      campaignId: camp1.id,
      name: "Dapur Lereng",
      address: "Jl. Palagan 3, Yogyakarta",
      phone: "+628575550105",
      phoneE164: "628575550105",
      rating: "4.1",
      reviewCount: 60,
      category: "Restaurant",
      hasWebsite: false,
      score: 52,
      priority: "MEDIUM",
      crmStatus: "new",
      province: "Daerah Istimewa Yogyakarta",
      regency: "Sleman",
      aiAnalysis: {
        factors: [
          "4.1 stars, moderate review count",
          "Homestyle cooking concept",
        ],
        recommendation: "Monitor — may benefit later.",
        fit: { fit: "medium", reason: "Decent rating but limited digital signals." },
      },
    },
    // Dental leads
    {
      campaignId: camp2.id,
      name: "Klinik Gigi Senyum Sehat",
      address: "Jl. Darmo 88, Surabaya",
      phone: "+628115550201",
      phoneE164: "628115550201",
      website: "senyumsehat.com",
      rating: "4.8",
      reviewCount: 420,
      category: "Dental Clinic",
      hasWebsite: true,
      score: 86,
      priority: "HIGH",
      crmStatus: "contacted",
      contactedAt: new Date("2026-10-12"),
      province: "Jawa Timur",
      regency: "Kota Surabaya",
      aiAnalysis: {
        factors: [
          "420 reviews at 4.8 — top-rated clinic in area",
          "Website exists but no online appointment booking",
          "Patients comment on long wait times in reviews",
        ],
        recommendation: "Strong candidate — high volume, clear booking need.",
        fit: { fit: "high", reason: "4.8 stars, 420 reviews, no booking system." },
      },
      marketingContent: {
        email: {
          subject: "Online appointments for Senyum Sehat",
          body: "Hi,\n\nKlinik Gigi Senyum Sehat has 420 Google reviews at 4.8 stars — one of the highest-rated clinics in Surabaya. Yet patients still need to call to book.\n\nI'm from Northwind Web Studio. We add booking pages to clinic websites in under a week. Patients book while you sleep.\n\nWould you like to see an example?\n\nBest regards,",
        },
      },
    },
    {
      campaignId: camp2.id,
      name: "Drg. Maya Practice",
      address: "Jl. Mayjen Sungkono 5, Surabaya",
      phone: "+628135550203",
      phoneE164: "628135550203",
      rating: "4.9",
      reviewCount: 77,
      category: "Dental Clinic",
      hasWebsite: false,
      score: 82,
      priority: "HIGH",
      crmStatus: "new",
      province: "Jawa Timur",
      regency: "Kota Surabaya",
      aiAnalysis: {
        factors: [
          "4.9 stars — exceptional rating",
          "No website found",
          "77 reviews is good for a solo practice",
        ],
        recommendation: "High priority — top rating, zero digital presence.",
        fit: { fit: "high", reason: "4.9 rating with no website is a clear opportunity." },
      },
      marketingContent: {
        email: {
          subject: "Booking page for Drg. Maya Practice",
          body: "Hi,\n\nDrg. Maya Practice has 77 reviews at 4.9 stars — but no website, so patients cannot book online.\n\nI'm from Northwind Web Studio. We build patient booking pages for solo dental practices in about a week.\n\nMay I show you what it could look like?\n\nBest regards,",
        },
        coldCall: { opening: "Hi, is this Drg. Maya's clinic? I'm from Northwind Web Studio — you have 77 reviews at 4.9 stars, which is excellent. Have patients ever asked you about booking appointments online?" },
      },
    },
    {
      campaignId: camp2.id,
      name: "Roti Bakar Mataram",
      address: "Jl. Mataram 9, Yogyakarta",
      phone: "+628215550103",
      phoneE164: "628215550103",
      rating: "4.3",
      reviewCount: 140,
      category: "Bakery",
      hasWebsite: false,
      score: 66,
      priority: "MEDIUM",
      crmStatus: "new",
      province: "Daerah Istimewa Yogyakarta",
      regency: "Kota Yogyakarta",
      aiAnalysis: {
        factors: ["4.3 stars, decent review count", "Bakery category is slightly outside core focus"],
        recommendation: "Consider only if dental slots are filled.",
        fit: { fit: "medium", reason: "Good rating but peripheral to campaign focus." },
      },
    },
    {
      campaignId: camp2.id,
      name: "Dentist Care Surabaya",
      address: "Jl. Raya Gubeng 12, Surabaya",
      phone: "+628125550202",
      phoneE164: "628125550202",
      rating: "4.4",
      reviewCount: 233,
      category: "Dental Clinic",
      hasWebsite: false,
      score: 63,
      priority: "MEDIUM",
      crmStatus: "new",
      province: "Jawa Timur",
      regency: "Kota Surabaya",
      aiAnalysis: {
        factors: ["4.4 stars, 233 reviews", "No website"],
        recommendation: "Worth contacting after high-priority leads.",
        fit: { fit: "medium", reason: "Solid clinic but lower priority than Drg. Maya." },
      },
    },
  ];

  const createdLeads: Array<{ id: string; name: string }> = [];
  for (const l of leads) {
    const lead = await prisma.lead.create({ data: { workspaceId: wsId, ...l } });
    createdLeads.push({ id: lead.id, name: lead.name });
    console.log(`  + lead: ${lead.name}`);
  }

  // Outbox drafts (outbound_messages)
  const kopiLead = createdLeads.find((l) => l.name === "Kopi Tanah Liat")!;
  const mayaLead = createdLeads.find((l) => l.name === "Drg. Maya Practice")!;
  const senjLead = createdLeads.find((l) => l.name === "Warung Senja")!;

  await prisma.outboundMessage.createMany({
    data: [
      {
        workspaceId: wsId,
        leadId: mayaLead.id,
        channel: "whatsapp",
        toPhone: "+628135550203",
        status: "draft",
        source: "ai_outreach",
        body: "Hi, this is Demo Owner from Northwind Web Studio. Drg. Maya Practice has 77 reviews at 4.9 and no website yet, so patients cannot book online. Want me to show you how a booking page would look?\n\nIf you would rather not hear from me, reply STOP.",
      },
      {
        workspaceId: wsId,
        leadId: kopiLead.id,
        channel: "whatsapp",
        toPhone: "+628125550101",
        status: "draft",
        source: "ai_followup",
        body: "Hi again, following up on my note about Kopi Tanah Liat. No pressure at all. If an online menu with ordering is on your list this quarter, I can mock one up from your Google photos first.\n\nIf you would rather not hear from me, reply STOP.",
      },
      {
        workspaceId: wsId,
        leadId: senjLead.id,
        channel: "whatsapp",
        toPhone: "+628135550102",
        status: "draft",
        source: "ai_reply",
        body: "Hi Warung Senja, thanks for getting back to me. A site with online ordering usually takes about two weeks. I can send a short scope and price tomorrow. Does Thursday work for a 15 minute call?\n\nIf you would rather not hear from me, reply STOP.",
      },
    ],
  });
  console.log("  + 3 outbox drafts");

  // Knowledge base
  await prisma.knowledgeSource.createMany({
    data: [
      {
        workspaceId: wsId,
        title: "About Northwind Web Studio",
        text: "Northwind Web Studio builds booking and ordering pages for local businesses. We specialise in cafes, dental clinics and beauty salons. A typical project takes 5–7 days. We offer a free mockup before any commitment.",
        kind: "text",
        status: "ready",
        chunkCount: 2,
      },
      {
        workspaceId: wsId,
        title: "Pricing",
        text: "Starter page: Rp 2.5 jt (one page, booking form, Google Maps embed). Growth package: Rp 5 jt (up to 5 pages, WhatsApp chat widget, gallery). All packages include 3 months of free edits.",
        kind: "text",
        status: "ready",
        chunkCount: 1,
      },
      {
        workspaceId: wsId,
        title: "Case study: Ramen Nusantara",
        text: "Ramen Nusantara (Malang) had no online presence. After launching their booking page in March 2026, they reported 35 additional table reservations per week within 30 days.",
        kind: "text",
        status: "ready",
        chunkCount: 1,
      },
    ],
  });
  console.log("  + 3 knowledge sources");

  console.log(`\n✅ Demo workspace created`);
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASS}`);
  console.log(`   Workspace: ${DEMO_WORKSPACE}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
