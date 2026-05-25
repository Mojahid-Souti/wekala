import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "qwen3.5:2b";

export class WekalaQwen35_2b implements INodeType {
  description = buildChatDescription({
    displayName: "Qwen 3.5 2B",
    name: "wekalaQwen35_2b",
    modelTag: MODEL_TAG,
    icon: "wekala-qwen35-2b.svg",
    description: "Tiny Qwen 3.5 (2B) — fast routing and quick replies. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
