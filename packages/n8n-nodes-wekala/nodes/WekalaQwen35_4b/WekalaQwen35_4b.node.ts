import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "qwen3.5:4b";

export class WekalaQwen35_4b implements INodeType {
  description = buildChatDescription({
    displayName: "Qwen 3.5 4B",
    name: "wekalaQwen35_4b",
    modelTag: MODEL_TAG,
    icon: "wekala-qwen35-4b.svg",
    description: "Default Qwen 3.5 (4B) chat model with tools. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
