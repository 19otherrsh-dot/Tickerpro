import { prisma } from "@tickerpro/database/client";
import { sendMessage } from "./whatsapp.js";
import { broadcastToWorkspace } from "../routes/ws.js";

interface DripStep {
  delayHours: number;
  templateName: string;
}

let dripEngineTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

export function startDripEngine(pollIntervalMs = 60000) {
  if (dripEngineTimer) {
    clearInterval(dripEngineTimer);
  }

  console.log(`[Drip Engine] Started polling every ${pollIntervalMs}ms`);
  dripEngineTimer = setInterval(processDripCampaigns, pollIntervalMs);
}

export function stopDripEngine() {
  if (dripEngineTimer) {
    clearInterval(dripEngineTimer);
    dripEngineTimer = null;
  }
}

export async function processDripCampaigns() {
  if (isProcessing) return;
  isProcessing = true;

  const now = new Date();

  try {
    const dueEnrollments = await prisma.dripEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextRunAt: { lte: now }
      },
      include: {
        campaign: true,
        contact: {
          include: {
            workspace: { include: { whatsappNumbers: true } }
          }
        }
      },
      take: 50 // process in batches
    });

    for (const enrollment of dueEnrollments) {
      await processEnrollment(enrollment, now);
    }
  } catch (error) {
    console.error("[Drip Engine] Error processing drips:", error);
  } finally {
    isProcessing = false;
  }
}

async function processEnrollment(enrollment: any, now: Date) {
  try {
    const steps = enrollment.campaign.steps as unknown as DripStep[];
    const currentStepIndex = enrollment.currentStep;
    
    if (currentStepIndex >= steps.length) {
      // Campaign completed
      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED" }
      });
      return;
    }

    const step = steps[currentStepIndex];
    if (!step) return;
    
    const waNumber = enrollment.contact.workspace.whatsappNumbers.find((n: any) => n.isActive);
    
    if (waNumber) {
      const accessToken = process.env.META_ACCESS_TOKEN || "mock_token";
      
      // Send the template
      const payload = {
        type: "template",
        template: {
          name: step.templateName,
          language: { code: "en_US" } // or from campaign config
        }
      };

      const res = await sendMessage(
        {
          accessToken,
          phoneNumberId: waNumber.phoneNumberId,
          wabaId: waNumber.wabaId,
          webhookVerifyToken: ""
        },
        enrollment.contact.phoneNumber,
        payload
      );

      // Create conversation if none
      let conversation = await prisma.conversation.findFirst({
        where: { contactId: enrollment.contact.id, status: { not: "CLOSED" } }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            workspaceId: enrollment.contact.workspaceId,
            contactId: enrollment.contact.id,
            whatsappNumberId: waNumber.id,
            status: "OPEN"
          }
        });
      }

      // Record message
      const msg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          type: "TEMPLATE",
          content: payload,
          status: "SENT",
          waMessageId: res?.messages?.[0]?.id
        }
      });

      // WebSocket broadcast
      broadcastToWorkspace(enrollment.contact.workspaceId, {
        type: "message:new",
        payload: {
          message: msg,
          conversationId: conversation.id,
          contact: { id: enrollment.contact.id, phone: enrollment.contact.phoneNumber }
        },
        timestamp: new Date().toISOString()
      });
    }

    // Schedule next step
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];
      const delayHours = nextStep?.delayHours ?? 24;
      const nextRunAt = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
      
      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: { currentStep: nextStepIndex, nextRunAt }
      });
    } else {
      await prisma.dripEnrollment.update({
        where: { id: enrollment.id },
        data: { currentStep: nextStepIndex, status: "COMPLETED" }
      });
    }
    
  } catch (error) {
    console.error(`[Drip Engine] Failed to process drip enrollment ${enrollment.id}:`, error);
  }
}

/**
 * Birthday & Anniversary drip trigger processor (DoubleTick parity).
 *
 * Runs once per day (wired in worker.ts). Finds contacts whose `birthday` or
 * `anniversary` field matches today's "MM-DD" string, then auto-enrolls them
 * into any ACTIVE drip campaign with `triggerType = "BIRTHDAY"` or `"ANNIVERSARY"`.
 *
 * Uses upsert so re-running the job on the same day is idempotent — a contact
 * won't be enrolled twice in the same campaign within a single year.
 */
export async function processBirthdayTriggers() {
  const today = new Date();
  // Format as MM-DD matching the field format stored in DB
  const todayMD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  console.log(`[Drip Engine] Processing birthday/anniversary triggers for ${todayMD}`);

  let enrolled = 0;

  // --- BIRTHDAY triggers ---
  const birthdayCampaigns = await prisma.dripCampaign.findMany({
    where: { triggerType: "BIRTHDAY", status: "ACTIVE" },
    select: { id: true, workspaceId: true, steps: true },
  });

  for (const campaign of birthdayCampaigns) {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: campaign.workspaceId, birthday: todayMD },
      select: { id: true },
    });

    for (const contact of contacts) {
      const steps = campaign.steps as unknown as DripStep[];
      const firstDelay = steps[0]?.delayHours ?? 0;

      await prisma.dripEnrollment.upsert({
        where: { campaignId_contactId: { campaignId: campaign.id, contactId: contact.id } },
        create: {
          campaignId: campaign.id,
          contactId: contact.id,
          currentStep: 0,
          nextRunAt: new Date(Date.now() + firstDelay * 60 * 60 * 1000),
          status: "ACTIVE",
        },
        // If already enrolled (e.g. from a previous year's run that completed),
        // restart the campaign for this year's birthday.
        update: {
          currentStep: 0,
          nextRunAt: new Date(Date.now() + firstDelay * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });
      enrolled++;
    }
  }

  // --- ANNIVERSARY triggers ---
  const anniversaryCampaigns = await prisma.dripCampaign.findMany({
    where: { triggerType: "ANNIVERSARY", status: "ACTIVE" },
    select: { id: true, workspaceId: true, steps: true },
  });

  for (const campaign of anniversaryCampaigns) {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: campaign.workspaceId, anniversary: todayMD },
      select: { id: true },
    });

    for (const contact of contacts) {
      const steps = campaign.steps as unknown as DripStep[];
      const firstDelay = steps[0]?.delayHours ?? 0;

      await prisma.dripEnrollment.upsert({
        where: { campaignId_contactId: { campaignId: campaign.id, contactId: contact.id } },
        create: {
          campaignId: campaign.id,
          contactId: contact.id,
          currentStep: 0,
          nextRunAt: new Date(Date.now() + firstDelay * 60 * 60 * 1000),
          status: "ACTIVE",
        },
        update: {
          currentStep: 0,
          nextRunAt: new Date(Date.now() + firstDelay * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });
      enrolled++;
    }
  }

  console.log(`[Drip Engine] Birthday/anniversary triggers: enrolled ${enrolled} contacts.`);
}

