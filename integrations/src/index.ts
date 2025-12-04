import { IMessage } from "@data";

export interface GenAIClient {
  generateResponse: (messages: IMessage[]) => Promise<any>;
}

export * from "./gemini";
