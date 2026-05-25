import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "llama3.2:3b";

export class WekalaLlama32 implements INodeType {
  description = buildChatDescription({
    displayName: "Llama 3.2 3B",
    name: "wekalaLlama32",
    modelTag: MODEL_TAG,
    icon: "wekala-llama32.svg",
    description: "Llama 3.2 (3B) tiny chat fallback. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
