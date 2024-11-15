import crypto from 'crypto';
import dotenv from 'dotenv'
dotenv.config()
const algorithm = 'aes-256-gcm';
const keyLength = 32;
const ivLength = 12; // GCM typically uses 12-byte IVs
const saltLength = 16;
const iterations = 100000;
const digest = 'sha256';

/**
 * Encrypts plaintext using a password with AES-256-GCM. Returns base64-encoded string with salt, iv, auth tag, and ciphertext.
 */
function encryptGCM(plaintext, password) {
  const salt = crypto.randomBytes(saltLength);
  const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);
  const iv = crypto.randomBytes(ivLength);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Structure: salt + iv + authTag + ciphertext
  const encryptedBuffer = Buffer.concat([salt, iv, authTag, ciphertext]);
  return encryptedBuffer.toString('base64');
}

/**
 * Decrypts data encrypted with AES-256-GCM using a password.
 */
function decryptGCM(encryptedData, password) {
  const encryptedBuffer = Buffer.from(encryptedData, 'base64');

  const salt = encryptedBuffer.slice(0, saltLength);
  const iv = encryptedBuffer.slice(saltLength, saltLength + ivLength);
  const authTag = encryptedBuffer.slice(saltLength + ivLength, saltLength + ivLength + 16); // GCM auth tag is 16 bytes
  const ciphertext = encryptedBuffer.slice(saltLength + ivLength + 16);

  const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
