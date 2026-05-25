import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildChatDescription, supplyChatModel } from "../_shared/OllamaChatBase";

const MODEL_TAG = "glm4:9b";

export class WekalaGlm4 implements INodeType {
  description = buildChatDescription({
    displayName: "GLM-4 9B",
    name: "wekalaGlm4",
    modelTag: MODEL_TAG,
    icon: "wekala-glm4.svg",
    description: "GLM-4 (9B) workhorse chat model with tools. Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyChatModel.call(this, itemIndex, MODEL_TAG);
  }
}
