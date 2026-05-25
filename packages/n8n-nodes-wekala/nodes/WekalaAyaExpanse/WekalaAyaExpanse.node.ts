import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "aya-expanse:8b";

export class WekalaAyaExpanse implements INodeType {
  description = buildChatDescription({
    displayName: "Aya Expanse 8B",
    name: "wekalaAyaExpanse",
    modelTag: MODEL_TAG,
    icon: "wekala-aya-expanse.svg",
    description:
      "Aya Expanse (8B) multilingual chat — Arabic + 22 other languages. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
