import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encodedHash.split("$");

  if (algorithm !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }

  const expectedHash = Buffer.from(hashHex, "hex");
  const derivedKey = (await scrypt(password, Buffer.from(saltHex, "hex"), expectedHash.length)) as Buffer;

  return expectedHash.length === derivedKey.length && timingSafeEqual(expectedHash, derivedKey);
}
