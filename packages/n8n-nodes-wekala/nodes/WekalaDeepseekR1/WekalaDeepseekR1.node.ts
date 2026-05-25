import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "deepseek-r1:8b";

export class WekalaDeepseekR1 implements INodeType {
  description = buildChatDescription({
    displayName: "DeepSeek R1 8B",
    name: "wekalaDeepseekR1",
    modelTag: MODEL_TAG,
    icon: "wekala-deepseek-r1.svg",
    description: "DeepSeek R1 (8B) reasoning model — chain-of-thought. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
