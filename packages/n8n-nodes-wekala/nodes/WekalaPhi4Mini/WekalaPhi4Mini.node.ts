import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "phi4-mini:latest";

export class WekalaPhi4Mini implements INodeType {
  description = buildChatDescription({
    displayName: "Phi-4 Mini",
    name: "wekalaPhi4Mini",
    modelTag: MODEL_TAG,
    icon: "wekala-phi4-mini.svg",
    description: "Phi-4 Mini chat model — strong structured output. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
