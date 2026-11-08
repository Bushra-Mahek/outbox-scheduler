import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

const getEncryptionKey = (): Buffer => {
  const keyHex = process.env.SLACK_TOKEN_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "SLACK_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key."
    );
  }

  return Buffer.from(keyHex, "hex");
};

export const encryptSlackToken = (token: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex")
  ].join(":");
};

export const decryptSlackToken = (payload: string): string => {
  const [ivHex, authTagHex, encryptedHex] = payload.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted Slack token.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]).toString("utf8");
};