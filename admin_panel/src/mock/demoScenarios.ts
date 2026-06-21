import type { ChatMessage } from "@/types/api";

export type DemoStep = {
  role: ChatMessage["role"];
  content: string;
  /** ms to wait before this message appears (from the moment the previous step finished) */
  delay: number;
};

export type DemoScenario = {
  id: string;
  title: string;
  description: string;
  steps: DemoStep[];
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "build-hr-agent",
    title: "Build an HR Agent",
    description: "A user asks Sila to create a new HR-policy Q&A agent from scratch.",
    steps: [
      {
        role: "user",
        content: "I need an agent that answers employee questions about our HR policies.",
        delay: 400,
      },
      {
        role: "assistant",
        content:
          "Great starting point. A few quick questions to scope it correctly:\n\n1. Should it answer questions from any employee, or only HR staff?\n2. Where do your HR policies live — a shared drive, a PDF, a wiki?\n3. What classification level should this agent have (Internal or Restricted)?",
        delay: 900,
      },
      {
        role: "user",
        content:
          "All employees should be able to use it. Policies are in a PDF on SharePoint. Internal classification is fine.",
        delay: 500,
      },
      {
        role: "assistant",
        content:
          "Perfect. I'll draft an Internal-classified chat agent that queries a PDF knowledge base. Here's what I'll configure:\n\n• **Knowledge base**: PDF ingestion pipeline (OCR + chunking)\n• **Tools**: `kb_search` only — no external calls\n• **Model**: qwen2.5:7b-instruct (fits your VRAM budget)\n• **System prompt**: answers only from the KB, politely declines off-topic questions\n\nShall I create this as a Draft so you can review the prompt before vetting?",
        delay: 1200,
      },
      {
        role: "user",
        content: "Yes, create the draft.",
        delay: 400,
      },
      {
        role: "assistant",
        content:
          "Done. ✓ **HR Policy Assistant** has been created as a Draft in your workspace.\n\nNext steps:\n1. Upload your HR policy PDF to the agent's knowledge base\n2. Run a sandbox test\n3. Submit for vetting when ready\n\nYou can find it under **Agents → Drafts**. Want me to open it now?",
        delay: 1000,
      },
    ],
  },
  {
    id: "find-agent",
    title: "Find the Right Agent",
    description: "A user searches the Bazaar for an existing agent instead of building one.",
    steps: [
      {
        role: "user",
        content: "Is there already an agent that can summarise meeting transcripts?",
        delay: 400,
      },
      {
        role: "assistant",
        content:
          "I checked the Bazaar — 3 published agents match. Here's a quick comparison:\n\n| Agent | Rating | Classification | Avg latency |\n|---|---|---|---|\n| Meeting Scribe Pro | ★ 4.8 | Internal | 1.2 s |\n| Transcript Digest | ★ 4.3 | Public | 0.9 s |\n| Notes & Action Items | ★ 4.1 | Internal | 1.5 s |\n\n**Meeting Scribe Pro** looks like the best fit — highest rated, Internal classification, and it also extracts action items. Want me to hire it to your workspace?",
        delay: 1100,
      },
      {
        role: "user",
        content: "Yes, hire Meeting Scribe Pro.",
        delay: 400,
      },
      {
        role: "assistant",
        content:
          "Hired. **Meeting Scribe Pro** is now in your workspace under **My Agents**.\n\nTo use it: paste or upload a transcript, and it will return a structured summary with key decisions and action items. Try it now?",
        delay: 800,
      },
    ],
  },
  {
    id: "audit-review",
    title: "Review Recent Audit Activity",
    description: "An admin asks Sila to surface anomalies from the workspace audit log.",
    steps: [
      {
        role: "user",
        content: "Anything unusual in the audit log this week?",
        delay: 400,
      },
      {
        role: "assistant",
        content:
          "I scanned the last 7 days. Most activity is routine, but two things stand out:\n\n1. **Invocation spike** — *Document Classifier* received 340 calls on Tuesday, versus a 7-day average of 42. (8× above baseline)\n2. **Failed vetting run** — *Customer Onboarding Agent* failed its automated PII scan at 14:07 on Thursday. Status is still **In Review**.\n\nWould you like me to drill into either of these?",
        delay: 1100,
      },
      {
        role: "user",
        content: "Tell me more about the invocation spike.",
        delay: 400,
      },
      {
        role: "assistant",
        content:
          "The spike started at 09:14 and peaked at 11:30 on Tuesday. All 340 calls came from a single service account (`svc-data-pipeline`) in the Finance workspace.\n\nThe calls were successful — no errors — and the content classified matches Finance's typical document types. This looks like a scheduled batch job that ran for the first time. I'd recommend confirming with the Finance team that the batch was intentional.\n\nI can add a recurring alert rule if you'd like to be notified automatically next time any agent exceeds 3× its weekly average.",
        delay: 1300,
      },
      {
        role: "user",
        content: "Yes, add the alert rule.",
        delay: 400,
      },
      {
        role: "assistant",
        content:
          "Alert rule created. ✓\n\nYou'll receive an in-platform notification whenever any agent in your workspace exceeds 3× its 7-day rolling average. You can adjust the threshold anytime under **Command Center → Anomaly Alerts**.",
        delay: 900,
      },
    ],
  },
];
