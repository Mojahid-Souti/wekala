import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "gemma4:e4b";

export class WekalaGemma4 implements INodeType {
  description = buildChatDescription({
    displayName: "Gemma 4",
    name: "wekalaGemma4",
    modelTag: MODEL_TAG,
    icon: "wekala-gemma4.svg",
    description:
      "Gemma 4 multimodal model — vision + audio + thinking, 131k context. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
