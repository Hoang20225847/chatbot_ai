// integrations/src/gemini/index.ts
import { IMessage } from "@data";
import { GenAIClient } from "..";

type GeminiRole = "user" | "model";

export class GeminiClient implements GenAIClient {
  async generateResponse(messages: IMessage[]) {
    const history = messages.map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as GeminiRole,
      parts: [{ text: m.content }],
    }));

    const body = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are a blockchain expert and educator. You explain blockchain concepts clearly, provide technical details when needed, and help users understand how blockchain technology works. You can discuss topics like smart contracts, consensus mechanisms, cryptocurrencies, DeFi, NFTs, and blockchain architecture. Always provide accurate, up-to-date information and use examples to make complex concepts easier to understand.",
            },
          ],
        },
        ...history,
      ],
    });

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set");
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw error;
      }

      const completion = await response.json();
      const text =
        completion?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

      if (!text) {
        throw completion;
      }

      
      return {
        role: "assistant",
        content: text,
      };
    } catch (err) {
      console.error(
        "GEMINI_ERROR",
        JSON.stringify(
          {
            err,
          },
          null,
          2
        )
      );
      return null;
    }
  }
}
export * from './embeddings.service';
export * from './chat.service';