import { prisma } from "@tickerpro/database/client";

export async function autoAssignConversation(workspaceId: string, conversationId: string): Promise<string | null> {
  // 1. Get all agents in the workspace
  const agents = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      role: { in: ["AGENT", "ADMIN"] },
    },
    select: { userId: true },
  });

  if (agents.length === 0) {
    return null; // No agents to assign
  }

  // 2. Count active assigned conversations for each agent
  const agentIds = agents.map(a => a.userId);
  const assignmentCounts = await prisma.conversation.groupBy({
    by: ['assignedAgentId'],
    where: {
      workspaceId,
      assignedAgentId: { in: agentIds },
      status: { not: "CLOSED" }
    },
    _count: {
      _all: true
    }
  });

  const countMap = new Map<string, number>();
  agentIds.forEach(id => countMap.set(id, 0)); // Initialize all with 0

  assignmentCounts.forEach(ac => {
    if (ac.assignedAgentId) {
      countMap.set(ac.assignedAgentId, ac._count._all);
    }
  });

  // 3. Find the agent with the least assigned conversations
  let selectedAgentId = agentIds[0] as string;
  let minCount = countMap.get(selectedAgentId) || 0;

  for (const agentId of agentIds) {
    const count = countMap.get(agentId) || 0;
    if (count < minCount) {
      minCount = count;
      selectedAgentId = agentId;
    }
  }

  // 4. Update the conversation
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedAgentId: selectedAgentId }
  });

  return selectedAgentId || null;
}
