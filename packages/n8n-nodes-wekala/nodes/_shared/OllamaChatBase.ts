import { ChatOllama } from "@langchain/ollama";
import {
  type INodeProperties,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  NodeConnectionTypes,
  type SupplyData,
} from "n8n-workflow";

const DEFAULT_BASE_URL =
  process.env.OLLAMA_URL ?? process.env.OLLAMA_BASE_URL ?? "http://ollama:11434";

const sharedChatOptions: INodeProperties = {
  displayName: "Options",
  name: "options",
  placeholder: "Add Option",
  type: "collection",
  default: {},
  options: [
    {
      displayName: "Temperature",
      name: "temperature",
      type: "number",
      default: 0.7,
      typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
      description: "Sampling temperature (0 = deterministic, 1 = creative).",
    },
    {
      displayName: "Top P",
      name: "topP",
      type: "number",
      default: 0.9,
      typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 2 },
      description: "Nucleus sampling threshold.",
    },
    {
      displayName: "Max Tokens",
      name: "maxTokens",
      type: "number",
      default: -1,
      typeOptions: { minValue: -1 },
      description: "Maximum tokens to generate (-1 = no limit).",
    },
    {
      displayName: "Keep Alive",
      name: "keepAlive",
      type: "string",
      default: "5m",
      description: "How long Ollama keeps the model loaded after a request (e.g. 5m, 1h, 0).",
    },
  ],
};

interface ChatOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  keepAlive?: string;
}

export function buildChatDescription(opts: {
  displayName: string;
  name: string;
  modelTag: string;
  icon: string;
  description: string;
}): INodeTypeDescription {
  return {
    displayName: opts.displayName,
    name: opts.name,
    icon: `file:${opts.icon}` as `file:${string}.svg`,
    group: ["transform"],
    version: 1,
    description: opts.description,
    defaults: { name: opts.displayName },
    codex: {
      categories: ["AI"],
      subcategories: {
        AI: ["Language Models", "Root Nodes"],
        "Language Models": ["Chat Models (Recommended)"],
      },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiLanguageModel],
    outputNames: ["Model"],
    properties: [
      {
        displayName: `Calls the local <strong>${opts.modelTag}</strong> model via the in-cluster Ollama runtime. No data leaves the device.`,
        name: "notice",
        type: "notice",
        default: "",
      },
      sharedChatOptions,
    ],
  };
}

export async function supplyChatModel(
  this: ISupplyDataFunctions,
  itemIndex: number,
  modelTag: string
): Promise<SupplyData> {
  const options = this.getNodeParameter("options", itemIndex, {}) as ChatOptions;
  const model = new ChatOllama({
    baseUrl: DEFAULT_BASE_URL,
    model: modelTag,
    temperature: options.temperature ?? 0.7,
    topP: options.topP ?? 0.9,
    numPredict: options.maxTokens ?? -1,
    keepAlive: options.keepAlive ?? "5m",
  });
  return { response: model };
}
