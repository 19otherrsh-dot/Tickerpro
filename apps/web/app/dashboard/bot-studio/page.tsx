"use client";

import React, { useState, useCallback, useRef, useEffect, DragEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  Handle,
  Position,
  useReactFlow,
} from "@xyflow/react";
import styles from "./page.module.css";
import { useAuth, apiFetch } from "../../lib/auth-context";
import { useToast } from "../../lib/components/Toast";

// ── Custom Nodes ─────────────────────────────────────────────────────────────

const TriggerNode = ({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div className={`${styles.customNode} ${styles.triggerNode}`}>
      <div className={styles.customNodeHeader}>⚡ Trigger</div>
      <select 
        className={styles.nodeInput} 
        value={data.triggerType || "KEYWORD"}
        onChange={(e) => updateNodeData(id, { triggerType: e.target.value })}
      >
        <option value="KEYWORD">Keyword</option>
        <option value="FIRST_MESSAGE">First Message</option>
      </select>
      <input 
        className={styles.nodeInput} 
        placeholder="e.g. 'help'" 
        value={data.triggerValue || ""}
        onChange={(e) => updateNodeData(id, { triggerValue: e.target.value })}
      />
      <Handle type="source" position={Position.Right} id="a" />
    </div>
  );
};

const MessageNode = ({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div className={`${styles.customNode} ${styles.messageNode}`}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.customNodeHeader}>💬 Send Message</div>
      <textarea 
        className={styles.nodeInput} 
        placeholder="Message text..." 
        value={data.config?.text || ""} 
        onChange={(e) => updateNodeData(id, { config: { text: e.target.value } })}
        rows={3} 
      />
      <Handle type="source" position={Position.Right} id="a" />
    </div>
  );
};

const ConditionNode = ({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div className={`${styles.customNode} ${styles.conditionNode}`}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.customNodeHeader}>🔀 Condition</div>
      <input 
        className={styles.nodeInput} 
        placeholder="If message contains..." 
        value={data.config?.condition || ""} 
        onChange={(e) => updateNodeData(id, { config: { condition: e.target.value } })}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "0.7rem", color: "#666" }}>
        <span>True</span>
        <span>False</span>
      </div>
      <Handle type="source" position={Position.Right} id="true" style={{ top: "70%" }} />
      <Handle type="source" position={Position.Bottom} id="false" />
    </div>
  );
};

const AiNode = ({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div className={`${styles.customNode} ${styles.aiNode}`}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.customNodeHeader}>🤖 AI Reply</div>
      <input 
        className={styles.nodeInput} 
        placeholder="Prompt context..." 
        value={data.config?.prompt || ""} 
        onChange={(e) => updateNodeData(id, { config: { prompt: e.target.value } })}
      />
      <Handle type="source" position={Position.Right} id="a" />
    </div>
  );
};

const HumanHandoffNode = ({ id, data }: any) => {
  return (
    <div className={`${styles.customNode}`} style={{ borderLeft: "4px solid var(--tp-warning)" }}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.customNodeHeader}>🙋‍♂️ Human Handoff</div>
      <div style={{ padding: "8px", fontSize: "0.8rem", color: "#666" }}>Assigns to an agent.</div>
      <Handle type="source" position={Position.Right} id="a" />
    </div>
  );
};

const ApiRequestNode = ({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div className={`${styles.customNode}`} style={{ borderLeft: "4px solid #8b5cf6" }}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.customNodeHeader}>🌐 API Request</div>
      <input 
        className={styles.nodeInput} 
        placeholder="https://api.example.com/data" 
        value={data.config?.url || ""} 
        onChange={(e) => updateNodeData(id, { config: { url: e.target.value } })}
      />
      <Handle type="source" position={Position.Right} id="a" />
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
  ai_agent: AiNode,
  humanHandoff: HumanHandoffNode,
  apiRequest: ApiRequestNode,
};

const initialNodes: any[] = [
  { id: "1", type: "trigger", position: { x: 100, y: 150 }, data: { triggerType: "KEYWORD", triggerValue: "hello" } },
];
const initialEdges: Edge[] = [];

// ── Bot Studio Canvas ────────────────────────────────────────────────────────

let id = 0;
const getId = () => `dndnode_${id++}`;

interface FlowSummary {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
}

const BotStudioCanvas = () => {
  const { activeWorkspace, workspaces } = useAuth();
  const currentWorkspace = activeWorkspace || workspaces[0];
  const { addToast } = useToast();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [flowName, setFlowName] = useState("New Flow");

  // Which saved flow we're editing (null = a new, unsaved flow).
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flows, setFlows] = useState<FlowSummary[]>([]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Load the list of saved flows for this workspace.
  const fetchFlows = useCallback(async () => {
    if (!currentWorkspace) return;
    const res = await apiFetch(`/api/chatbots?workspaceId=${currentWorkspace.id}`);
    if (res.ok && res.data) setFlows(res.data.flows || []);
  }, [currentWorkspace]);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Reset the canvas to a fresh, unsaved flow.
  const newFlow = useCallback(() => {
    setFlowId(null);
    setFlowName("New Flow");
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [setNodes, setEdges]);

  // Load an existing flow's graph into the canvas for editing.
  const loadFlow = useCallback(
    async (id: string) => {
      if (!currentWorkspace) return;
      const res = await apiFetch(`/api/chatbots/${id}?workspaceId=${currentWorkspace.id}`);
      if (res.ok && res.data?.flow) {
        const flow = res.data.flow;
        const data = flow.flowData || {};
        setFlowId(flow.id);
        setFlowName(flow.name);
        setNodes(Array.isArray(data.nodes) && data.nodes.length ? data.nodes : initialNodes);
        setEdges(Array.isArray(data.edges) ? data.edges : []);
      } else {
        addToast("Failed to load flow", "error");
      }
    },
    [currentWorkspace, setNodes, setEdges, addToast]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type) {
        return;
      }

      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { text: "" },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const handleSave = async () => {
    if (!currentWorkspace) return;
    setIsSaving(true);

    const flowData = { nodes, edges };

    // Find the trigger node to extract the trigger value
    const triggerNode = nodes.find((n) => n.type === "trigger");

    const payload = {
      name: flowName,
      isActive: true,
      triggerType: (triggerNode?.data?.triggerType as string) || "KEYWORD",
      triggerValue: (triggerNode?.data?.triggerValue as string) || "",
      flowData,
    };

    try {
      // Update the existing flow when editing; otherwise create a new one.
      const res = flowId
        ? await apiFetch(`/api/chatbots/${flowId}?workspaceId=${currentWorkspace.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiFetch(`/api/chatbots?workspaceId=${currentWorkspace.id}`, {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        // Adopt the server id so subsequent saves update rather than duplicate.
        if (!flowId && res.data?.flow?.id) setFlowId(res.data.flow.id);
        addToast(flowId ? "Flow updated" : "Flow saved", "success");
        fetchFlows();
      } else {
        addToast(res.data?.error || "Failed to save flow", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Error saving flow", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.botStudioContainer}>
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            className={styles.title}
            value={flowName}
            onChange={e => setFlowName(e.target.value)}
            style={{ border: "none", background: "transparent", outline: "none" }}
          />
          {flowId && (
            <span style={{ fontSize: "0.7rem", color: "var(--tp-success, #16a34a)", fontWeight: 600 }}>
              ● editing
            </span>
          )}
        </div>
        <div className={styles.headerActions} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Open an existing saved flow for editing. */}
          <select
            aria-label="Open flow"
            value={flowId || ""}
            onChange={(e) => (e.target.value ? loadFlow(e.target.value) : newFlow())}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--tp-border, #e5e7eb)",
              background: "transparent",
              color: "inherit",
              fontSize: "0.8rem",
            }}
          >
            <option value="">— Open flow —</option>
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
          <button
            className={styles.nodeItem}
            onClick={newFlow}
            style={{ cursor: "pointer", padding: "6px 12px" }}
          >
            + New
          </button>
          <button className={styles.primaryBtn} onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : flowId ? "Update Flow" : "Save Flow"}
          </button>
        </div>
      </div>

      <div className={styles.workspaceArea}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Nodes</div>
          <div
            className={styles.nodeItem}
            onDragStart={(event) => event.dataTransfer.setData("application/reactflow", "trigger")}
            draggable
          >
            ⚡ Trigger
          </div>
          <div
            className={styles.nodeItem}
            onDragStart={(event) => event.dataTransfer.setData("application/reactflow", "message")}
            draggable
          >
            💬 Send Message
          </div>
          <div
            className={styles.nodeItem}
            onDragStart={(event) => event.dataTransfer.setData("application/reactflow", "condition")}
            draggable
          >
            🔀 Condition
          </div>
          <div
            className={styles.nodeItem}
            onDragStart={(event) => event.dataTransfer.setData("application/reactflow", "ai_agent")}
            draggable
          >
            🤖 AI Reply
          </div>
          <div
            className={styles.nodeItem}
            onDragStart={(event) => event.dataTransfer.setData("application/reactflow", "humanHandoff")}
            draggable
            style={{ borderLeft: "4px solid var(--tp-warning)" }}
          >
            🙋‍♂️ Human Handoff
          </div>
          <div
            className={styles.nodeItem}
            onDragStart={(event) => event.dataTransfer.setData("application/reactflow", "apiRequest")}
            draggable
            style={{ borderLeft: "4px solid #8b5cf6" }}
          >
            🌐 API Request
          </div>
          
          <div style={{ marginTop: 24, fontSize: "0.8rem", color: "#6B7280" }}>
            Drag and drop these nodes onto the canvas to build your automation flow.
          </div>
        </aside>

        <div className={styles.canvas} ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

export default function BotStudio() {
  return (
    <ReactFlowProvider>
      <BotStudioCanvas />
    </ReactFlowProvider>
  );
}
