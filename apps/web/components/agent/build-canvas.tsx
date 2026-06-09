"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  type NodeTypes,
  type OnConnect,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Bot,
  Calendar,
  Database,
  FileText,
  HardDrive,
  Hash,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Sheet,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { AgentNode, type AgentNodeData } from "./agent-node";

const NODE_TYPES: NodeTypes = { agent: AgentNode };

const INITIAL_NODES: Node<AgentNodeData>[] = [
  {
    id: "start",
    type: "agent",
    position: { x: 40, y: 200 },
    data: {
      kind: "start",
      title: "Start Node",
      subtitle: "Main Node",
      description: "This is a starting point of your automation.",
      tags: ["Unassigned"],
    },
  },
  {
    id: "writer",
    type: "agent",
    position: { x: 340, y: 30 },
    data: {
      kind: "writer",
      title: "Creative Writer",
      subtitle: "Essay",
      description: "Craft organized essays and articles on a variety of topics.",
      tags: ["Assigned", "Write Essay"],
    },
  },
  {
    id: "email",
    type: "agent",
    position: { x: 340, y: 360 },
    data: {
      kind: "email",
      title: "Email Agent",
      subtitle: "Gmail",
      description: "Crafts polished and expertly structured emails.",
      tags: ["Unassigned", "Write Essay"],
    },
  },
  {
    id: "end",
    type: "agent",
    position: { x: 700, y: 200 },
    data: {
      kind: "end",
      title: "End",
      subtitle: "End",
      description: "This is an end point of your automation.",
      tags: ["Unassigned"],
    },
  },
  {
    id: "notification",
    type: "agent",
    position: { x: 760, y: 520 },
    data: {
      kind: "notification",
      title: "Notification",
      subtitle: "Slack",
      description: "Stay updated with real-time Slack notifications.",
      tags: ["Unassigned", "Write Essay"],
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  {
    id: "start->writer",
    source: "start",
    target: "writer",
    style: { strokeDasharray: "5 5", stroke: "#a3a3a3", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
  },
  {
    id: "start->email",
    source: "start",
    target: "email",
    style: { strokeDasharray: "5 5", stroke: "#a3a3a3", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
  },
  {
    id: "writer->end",
    source: "writer",
    target: "end",
    style: { strokeDasharray: "5 5", stroke: "#a3a3a3", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
  },
  {
    id: "writer->email",
    source: "writer",
    target: "email",
    style: { strokeDasharray: "5 5", stroke: "#a3a3a3", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
  },
  {
    id: "email->end",
    source: "email",
    target: "end",
    style: { strokeDasharray: "5 5", stroke: "#a3a3a3", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
  },
];

type PaletteEntry = {
  kind: AgentNodeData["kind"];
  label: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PALETTE_GROUPS: { label: string; items: PaletteEntry[] }[] = [
  {
    label: "Agents",
    items: [
      {
        kind: "bot",
        label: "LLM Agent",
        subtitle: "OpenAI",
        description: "Generic LLM-backed reasoning step.",
        icon: Bot,
      },
      {
        kind: "writer",
        label: "Creative Writer",
        subtitle: "Essay",
        description: "Craft organized essays and articles.",
        icon: Pencil,
      },
      {
        kind: "openai",
        label: "OpenAI",
        subtitle: "GPT-4o",
        description: "Call an OpenAI model directly.",
        icon: Sparkles,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        kind: "data",
        label: "Knowledge base",
        subtitle: "RAG",
        description: "Query a workspace knowledge base.",
        icon: Database,
      },
      {
        kind: "tool",
        label: "Tool",
        subtitle: "Custom",
        description: "Run a registered workspace tool.",
        icon: Wrench,
      },
      {
        kind: "search",
        label: "Web search",
        subtitle: "DuckDuckGo",
        description: "Look up information on the web.",
        icon: Search,
      },
    ],
  },
  {
    label: "Connectors",
    items: [
      {
        kind: "email",
        label: "Gmail",
        subtitle: "Google",
        description: "Read or send Gmail messages.",
        icon: Mail,
      },
      {
        kind: "outlook",
        label: "Outlook",
        subtitle: "Microsoft 365",
        description: "Read or send Outlook mail.",
        icon: Mail,
      },
      {
        kind: "slack",
        label: "Slack",
        subtitle: "Workspace",
        description: "Post to channels or DMs.",
        icon: Hash,
      },
      {
        kind: "teams",
        label: "Microsoft Teams",
        subtitle: "Channel",
        description: "Post messages and notifications.",
        icon: MessageSquare,
      },
      {
        kind: "drive",
        label: "Google Drive",
        subtitle: "Files",
        description: "Read, write, list documents.",
        icon: HardDrive,
      },
      {
        kind: "sheets",
        label: "Google Sheets",
        subtitle: "Spreadsheets",
        description: "Read or update rows in a sheet.",
        icon: Sheet,
      },
      {
        kind: "calendar",
        label: "Google Calendar",
        subtitle: "Events",
        description: "Create or list calendar events.",
        icon: Calendar,
      },
      {
        kind: "notion",
        label: "Notion",
        subtitle: "Workspace",
        description: "Read or create Notion pages.",
        icon: FileText,
      },
      {
        kind: "notification",
        label: "Webhook",
        subtitle: "HTTP",
        description: "Trigger a custom webhook.",
        icon: Bell,
      },
    ],
  },
  {
    label: "Flow",
    items: [
      {
        kind: "start",
        label: "Trigger",
        subtitle: "Manual",
        description: "Adds another starting point.",
        icon: MessageCircle,
      },
    ],
  },
];

function Canvas() {
  const [nodes, _setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const { addNodes, getViewport } = useReactFlow();

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            style: { strokeDasharray: "5 5", stroke: "#a3a3a3", strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
          },
          eds
        )
      ),
    [setEdges]
  );

  const handleAddNode = useCallback(
    (kind: AgentNodeData["kind"], label: string, subtitle: string, description: string) => {
      const vp = getViewport();
      const id = `${kind}-${Date.now()}`;
      // Center new nodes in the visible viewport
      const x = -vp.x / vp.zoom + 240;
      const y = -vp.y / vp.zoom + 200;
      addNodes({
        id,
        type: "agent",
        position: { x, y },
        data: { kind, title: label, subtitle, description, tags: ["Unassigned"] },
      });
    },
    [addNodes, getViewport]
  );

  const paletteGroups = useMemo(() => PALETTE_GROUPS, []);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { strokeDasharray: "5 5", stroke: "#a3a3a3", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#a3a3a3" },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d4d4d4" />
        <Controls
          position="top-right"
          showInteractive={false}
          className="!rounded-lg !border !border-neutral-200 !bg-white !shadow-sm [&>button]:!border-0 [&>button]:!bg-white [&>button:hover]:!bg-neutral-100"
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="rgba(245, 245, 245, 0.8)"
          nodeColor="#262626"
          nodeStrokeWidth={2}
          className="!overflow-hidden !rounded-lg !border !border-neutral-200 !bg-white !shadow-sm"
        />
      </ReactFlow>

      {/* Bottom-center FAB — add node */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Add node"
              className="pointer-events-auto grid size-12 place-items-center rounded-full bg-neutral-950 text-white shadow-lg transition-all hover:scale-105 hover:bg-neutral-800"
            >
              <Plus className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="center"
            className="max-h-[440px] w-72 overflow-y-auto"
          >
            {paletteGroups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-neutral-500">
                  {group.label}
                </DropdownMenuLabel>
                {group.items.map((p) => {
                  const Icon = p.icon;
                  return (
                    <DropdownMenuItem
                      key={p.kind + p.label}
                      onSelect={() => handleAddNode(p.kind, p.label, p.subtitle, p.description)}
                      className="gap-2.5"
                    >
                      <Icon className="size-4 text-neutral-500" />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-neutral-950">
                          {p.label}
                        </span>
                        <span className="block text-xs text-neutral-500">{p.subtitle}</span>
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function BuildCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
