import { OllamaEmbeddings } from "@langchain/ollama";
import {
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  NodeConnectionTypes,
  type SupplyData,
} from "n8n-workflow";

const DEFAULT_BASE_URL =
  process.env.OLLAMA_URL ?? process.env.OLLAMA_BASE_URL ?? "http://ollama:11434";

export function buildEmbedDescription(opts: {
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
        AI: ["Embeddings", "Root Nodes"],
      },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiEmbedding],
    outputNames: ["Embeddings"],
    properties: [
      {
        displayName: `Generates embeddings using the local <strong>${opts.modelTag}</strong> model via the in-cluster Ollama runtime.`,
        name: "notice",
        type: "notice",
        default: "",
      },
    ],
  };
}

export async function supplyEmbedModel(
  this: ISupplyDataFunctions,
  _itemIndex: number,
  modelTag: string
): Promise<SupplyData> {
  const embeddings = new OllamaEmbeddings({
    baseUrl: DEFAULT_BASE_URL,
    model: modelTag,
  });
  return { response: embeddings };
}
