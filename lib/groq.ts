import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  // No tiramos error en import-time para no romper el build; falla al usar.
  console.warn("[groq] GROQ_API_KEY no está definida");
}

export const groq = new Groq({ apiKey: apiKey ?? "" });

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";
