// Cifrado en reposo de datos sensibles (tokens de MercadoLibre).
// AES-256-GCM con clave de 32 bytes en ML_TOKEN_ENC_KEY (base64). Solo servidor.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "v1:"; // marca de versión/formato; permite detectar valores legacy en texto plano.

function getKey(): Buffer {
  const raw = process.env.ML_TOKEN_ENC_KEY ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ML_TOKEN_ENC_KEY ausente o inválida (se esperan 32 bytes en base64)");
  }
  return key;
}

// Devuelve "v1:<iv>:<authTag>:<ciphertext>" (cada parte en base64).
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

// Descifra un valor producido por encrypt(). Si el valor NO tiene el prefijo,
// se asume legacy (texto plano de antes de cifrar) y se devuelve tal cual.
export function decrypt(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value;
  const [, ivB64, tagB64, dataB64] = value.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
