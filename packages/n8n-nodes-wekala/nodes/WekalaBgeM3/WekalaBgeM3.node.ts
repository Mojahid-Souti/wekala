import type { INodeType, ISupplyDataFunctions, SupplyData } from "n8n-workflow";
import { buildEmbedDescription, supplyEmbedModel } from "../_shared/OllamaEmbedBase";

const MODEL_TAG = "bge-m3:latest";

export class WekalaBgeM3 implements INodeType {
  description = buildEmbedDescription({
    displayName: "BGE-M3 Embeddings",
    name: "wekalaBgeM3",
    modelTag: MODEL_TAG,
    icon: "wekala-bge-m3.svg",
    description: "BGE-M3 multilingual embeddings (1024-dim). Runs locally on Ollama.",
  });

  async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
    return supplyEmbedModel.call(this, itemIndex, MODEL_TAG);
  }
}
