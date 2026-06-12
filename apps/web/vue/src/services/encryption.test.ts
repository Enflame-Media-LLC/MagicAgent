/**
 * Unit tests for TweetNaCl box encryption service
 *
 * Tests cover:
 * - Key pair generation (box and signing)
 * - Box encryption/decryption (X25519-XSalsa20-Poly1305)
 * - Detached signatures
 * - Random byte generation
 * - String encoding/decoding helpers
 * - Cross-instance encryption/decryption
 * - Error handling for invalid data
 *
 * @see HAP-720 - NativeScript Mobile Testing Suite
 */

import { describe, it, expect, beforeEach } from "vite-plus/test";
import {
  generateBoxKeyPair,
  decryptBox,
  encryptBox,
  encryptBoxString,
  decryptBoxString,
  generateSigningKeyPair,
  signDetached,
  randomBytes,
  type BoxKeyPair,
} from "./encryption";
import nacl from "tweetnacl";

describe("Encryption Service", () => {
  describe("generateBoxKeyPair", () => {
    it("should generate a valid keypair", () => {
      const keypair = generateBoxKeyPair();

      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
    });

    it("should generate 32-byte public key", () => {
      const keypair = generateBoxKeyPair();
      expect(keypair.publicKey.length).toBe(nacl.box.publicKeyLength);
    });

    it("should generate 32-byte secret key", () => {
      const keypair = generateBoxKeyPair();
      expect(keypair.secretKey.length).toBe(nacl.box.secretKeyLength);
    });

    it("should generate unique keypairs", () => {
      const keypair1 = generateBoxKeyPair();
      const keypair2 = generateBoxKeyPair();

      // Public keys should be different
      expect(keypair1.publicKey).not.toEqual(keypair2.publicKey);

      // Secret keys should be different
      expect(keypair1.secretKey).not.toEqual(keypair2.secretKey);
    });

    it("should generate 100 unique keypairs", () => {
      const publicKeys = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const keypair = generateBoxKeyPair();
        const keyHex = Array.from(keypair.publicKey)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        publicKeys.add(keyHex);
      }

      // All keypairs should be unique
      expect(publicKeys.size).toBe(100);
    });
  });

  describe("encryptBox", () => {
    let recipientKeypair: BoxKeyPair;

    beforeEach(() => {
      recipientKeypair = generateBoxKeyPair();
    });

    it("should encrypt data successfully", () => {
      const data = new TextEncoder().encode("Hello, World!");
      const encrypted = encryptBox(data, recipientKeypair.publicKey);

      expect(encrypted).toBeInstanceOf(Uint8Array);
      expect(encrypted.length).toBeGreaterThan(data.length);
    });

    it("should produce different ciphertext for same plaintext", () => {
      const data = new TextEncoder().encode("Same message");

      const encrypted1 = encryptBox(data, recipientKeypair.publicKey);
      const encrypted2 = encryptBox(data, recipientKeypair.publicKey);

      // Should be different due to random ephemeral key and nonce
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it("should include ephemeral public key in output", () => {
      const data = new TextEncoder().encode("Test");
      const encrypted = encryptBox(data, recipientKeypair.publicKey);

      // Output format: ephemeral public key (32) + nonce (24) + ciphertext
      expect(encrypted.length).toBeGreaterThanOrEqual(32 + 24 + 1);
    });

    it("should handle empty data", () => {
      const data = new Uint8Array(0);
      const encrypted = encryptBox(data, recipientKeypair.publicKey);

      expect(encrypted).toBeInstanceOf(Uint8Array);
      // Should still have header (32 + 24 = 56 bytes minimum) + authentication tag
      expect(encrypted.length).toBeGreaterThanOrEqual(56);
    });

    it("should handle large data (64KB)", () => {
      // Note: crypto.getRandomValues has a 65536 byte limit in browsers
      const largeData = new Uint8Array(64 * 1024);
      crypto.getRandomValues(largeData);

      const encrypted = encryptBox(largeData, recipientKeypair.publicKey);

      expect(encrypted.length).toBeGreaterThan(largeData.length);
    });

    it("should handle binary data with all byte values", () => {
      const binaryData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        binaryData[i] = i;
      }

      const encrypted = encryptBox(binaryData, recipientKeypair.publicKey);
      expect(encrypted).toBeInstanceOf(Uint8Array);
    });
  });

  describe("decryptBox", () => {
    let recipientKeypair: BoxKeyPair;

    beforeEach(() => {
      recipientKeypair = generateBoxKeyPair();
    });

    it("should decrypt encrypted data", () => {
      const originalData = new TextEncoder().encode("Hello, World!");
      const encrypted = encryptBox(originalData, recipientKeypair.publicKey);

      const decrypted = decryptBox(encrypted, recipientKeypair.secretKey);

      expect(decrypted).not.toBeNull();
      expect(decrypted).toEqual(originalData);
    });

    it("should decrypt empty data", () => {
      const originalData = new Uint8Array(0);
      const encrypted = encryptBox(originalData, recipientKeypair.publicKey);

      const decrypted = decryptBox(encrypted, recipientKeypair.secretKey);

      expect(decrypted).not.toBeNull();
      expect(decrypted?.length).toBe(0);
    });

    it("should decrypt large data", () => {
      const originalData = new Uint8Array(50 * 1024);
      crypto.getRandomValues(originalData);

      const encrypted = encryptBox(originalData, recipientKeypair.publicKey);
      const decrypted = decryptBox(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toEqual(originalData);
    });

    it("should return null for data encrypted with different key", () => {
      const otherKeypair = generateBoxKeyPair();
      const data = new TextEncoder().encode("Secret message");

      const encrypted = encryptBox(data, otherKeypair.publicKey);

      // Try to decrypt with wrong secret key
      const decrypted = decryptBox(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toBeNull();
    });

    it("should return null for truncated data", () => {
      const data = new TextEncoder().encode("Test message");
      const encrypted = encryptBox(data, recipientKeypair.publicKey);

      // Truncate the encrypted data
      const truncated = encrypted.slice(0, 30);

      const decrypted = decryptBox(truncated, recipientKeypair.secretKey);

      expect(decrypted).toBeNull();
    });

    it("should return null for modified ciphertext", () => {
      const data = new TextEncoder().encode("Test message");
      const encrypted = encryptBox(data, recipientKeypair.publicKey);

      // Modify the ciphertext portion (index 60 is guaranteed to exist in encrypted data)
      const modified = new Uint8Array(encrypted);
      modified[60]! ^= 0xff; // Flip bits in ciphertext area

      const decrypted = decryptBox(modified, recipientKeypair.secretKey);

      expect(decrypted).toBeNull();
    });

    it("should return null for modified nonce", () => {
      const data = new TextEncoder().encode("Test message");
      const encrypted = encryptBox(data, recipientKeypair.publicKey);

      // Modify the nonce (bytes 32-55, index 35 is guaranteed to exist)
      const modified = new Uint8Array(encrypted);
      modified[35]! ^= 0xff;

      const decrypted = decryptBox(modified, recipientKeypair.secretKey);

      expect(decrypted).toBeNull();
    });

    it("should return null for empty Uint8Array", () => {
      const decrypted = decryptBox(new Uint8Array(0), recipientKeypair.secretKey);
      expect(decrypted).toBeNull();
    });

    it("should return null for data too short for header", () => {
      const shortData = new Uint8Array(50); // Less than 32 + 24 + 1
      const decrypted = decryptBox(shortData, recipientKeypair.secretKey);
      expect(decrypted).toBeNull();
    });
  });

  describe("encryptBoxString / decryptBoxString", () => {
    let recipientKeypair: BoxKeyPair;

    beforeEach(() => {
      recipientKeypair = generateBoxKeyPair();
    });

    it("should encrypt and decrypt string message", () => {
      const message = "Hello, World!";
      const encrypted = encryptBoxString(message, recipientKeypair.publicKey);
      const decrypted = decryptBoxString(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toBe(message);
    });

    it("should handle empty string", () => {
      const message = "";
      const encrypted = encryptBoxString(message, recipientKeypair.publicKey);
      const decrypted = decryptBoxString(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toBe("");
    });

    it("should handle Unicode characters", () => {
      const message = "你好世界 🚀 مرحبا";
      const encrypted = encryptBoxString(message, recipientKeypair.publicKey);
      const decrypted = decryptBoxString(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toBe(message);
    });

    it("should handle multiline strings", () => {
      const message = `Line 1
Line 2
Line 3`;
      const encrypted = encryptBoxString(message, recipientKeypair.publicKey);
      const decrypted = decryptBoxString(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toBe(message);
    });

    it("should handle JSON strings", () => {
      const jsonMessage = JSON.stringify({
        type: "session",
        data: { id: 123, name: "test" },
      });
      const encrypted = encryptBoxString(jsonMessage, recipientKeypair.publicKey);
      const decrypted = decryptBoxString(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toBe(jsonMessage);
      expect(JSON.parse(decrypted!)).toEqual(JSON.parse(jsonMessage));
    });

    it("should handle long strings (10KB)", () => {
      const longMessage = "a".repeat(10 * 1024);
      const encrypted = encryptBoxString(longMessage, recipientKeypair.publicKey);
      const decrypted = decryptBoxString(encrypted, recipientKeypair.secretKey);

      expect(decrypted).toBe(longMessage);
    });

    it("should return null for invalid encrypted data", () => {
      const decrypted = decryptBoxString(new Uint8Array([1, 2, 3]), recipientKeypair.secretKey);
      expect(decrypted).toBeNull();
    });

    it("should return null for wrong key", () => {
      const message = "Secret";
      const encrypted = encryptBoxString(message, recipientKeypair.publicKey);

      const wrongKeypair = generateBoxKeyPair();
      const decrypted = decryptBoxString(encrypted, wrongKeypair.secretKey);

      expect(decrypted).toBeNull();
    });
  });

  describe("generateSigningKeyPair", () => {
    it("should generate signing keypair from seed", () => {
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);

      const keypair = generateSigningKeyPair(seed);

      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
    });

    it("should generate 32-byte public key", () => {
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);

      const keypair = generateSigningKeyPair(seed);

      expect(keypair.publicKey.length).toBe(nacl.sign.publicKeyLength);
    });

    it("should generate 64-byte secret key", () => {
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);

      const keypair = generateSigningKeyPair(seed);

      expect(keypair.secretKey.length).toBe(nacl.sign.secretKeyLength);
    });

    it("should be deterministic with same seed", () => {
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);

      const keypair1 = generateSigningKeyPair(seed);
      const keypair2 = generateSigningKeyPair(seed);

      expect(keypair1.publicKey).toEqual(keypair2.publicKey);
      expect(keypair1.secretKey).toEqual(keypair2.secretKey);
    });

    it("should produce different keypairs with different seeds", () => {
      const seed1 = new Uint8Array(32);
      const seed2 = new Uint8Array(32);
      crypto.getRandomValues(seed1);
      crypto.getRandomValues(seed2);

      const keypair1 = generateSigningKeyPair(seed1);
      const keypair2 = generateSigningKeyPair(seed2);

      expect(keypair1.publicKey).not.toEqual(keypair2.publicKey);
    });
  });

  describe("signDetached", () => {
    let signingKeypair: ReturnType<typeof generateSigningKeyPair>;

    beforeEach(() => {
      const seed = new Uint8Array(32);
      crypto.getRandomValues(seed);
      signingKeypair = generateSigningKeyPair(seed);
    });

    it("should create a 64-byte signature", () => {
      const message = new TextEncoder().encode("Test message");
      const signature = signDetached(message, signingKeypair.secretKey);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(nacl.sign.signatureLength);
    });

    it("should create verifiable signature", () => {
      const message = new TextEncoder().encode("Test message");
      const signature = signDetached(message, signingKeypair.secretKey);

      const isValid = nacl.sign.detached.verify(message, signature, signingKeypair.publicKey);

      expect(isValid).toBe(true);
    });

    it("should create different signatures for different messages", () => {
      const message1 = new TextEncoder().encode("Message 1");
      const message2 = new TextEncoder().encode("Message 2");

      const signature1 = signDetached(message1, signingKeypair.secretKey);
      const signature2 = signDetached(message2, signingKeypair.secretKey);

      expect(signature1).not.toEqual(signature2);
    });

    it("should be deterministic for same message", () => {
      const message = new TextEncoder().encode("Same message");

      const signature1 = signDetached(message, signingKeypair.secretKey);
      const signature2 = signDetached(message, signingKeypair.secretKey);

      expect(signature1).toEqual(signature2);
    });

    it("should fail verification with wrong public key", () => {
      const message = new TextEncoder().encode("Test message");
      const signature = signDetached(message, signingKeypair.secretKey);

      const otherSeed = new Uint8Array(32);
      crypto.getRandomValues(otherSeed);
      const otherKeypair = generateSigningKeyPair(otherSeed);

      const isValid = nacl.sign.detached.verify(message, signature, otherKeypair.publicKey);

      expect(isValid).toBe(false);
    });

    it("should fail verification with modified message", () => {
      const message = new TextEncoder().encode("Test message");
      const signature = signDetached(message, signingKeypair.secretKey);

      const modifiedMessage = new TextEncoder().encode("Test message!");

      const isValid = nacl.sign.detached.verify(
        modifiedMessage,
        signature,
        signingKeypair.publicKey,
      );

      expect(isValid).toBe(false);
    });

    it("should handle empty message", () => {
      const message = new Uint8Array(0);
      const signature = signDetached(message, signingKeypair.secretKey);

      expect(signature.length).toBe(64);
      expect(nacl.sign.detached.verify(message, signature, signingKeypair.publicKey)).toBe(true);
    });

    it("should handle large message (64KB)", () => {
      // Note: crypto.getRandomValues has a 65536 byte limit in browsers
      const largeMessage = new Uint8Array(64 * 1024);
      crypto.getRandomValues(largeMessage);

      const signature = signDetached(largeMessage, signingKeypair.secretKey);

      expect(signature.length).toBe(64);
      expect(nacl.sign.detached.verify(largeMessage, signature, signingKeypair.publicKey)).toBe(
        true,
      );
    });
  });

  describe("randomBytes", () => {
    it("should generate bytes of specified length", () => {
      const bytes = randomBytes(32);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });

    it("should generate unique sequences", () => {
      const bytes1 = randomBytes(32);
      const bytes2 = randomBytes(32);

      expect(bytes1).not.toEqual(bytes2);
    });

    it("should handle zero length", () => {
      const bytes = randomBytes(0);
      expect(bytes.length).toBe(0);
    });

    it("should handle max browser-supported length (64KB)", () => {
      // Note: crypto.getRandomValues has a 65536 byte limit in browsers
      const bytes = randomBytes(64 * 1024);
      expect(bytes.length).toBe(64 * 1024);
    });

    it("should produce well-distributed random values", () => {
      const bytes = randomBytes(10000);
      const counts = Array.from({ length: 256 }, () => 0);

      for (const byte of bytes) {
        counts[byte] = (counts[byte] ?? 0) + 1;
      }

      // Each byte value should appear roughly 39 times (10000/256)
      // Allow for statistical variance
      const avgExpected = 10000 / 256;
      const minCount = Math.min(...counts);
      const maxCount = Math.max(...counts);

      // Allow ±50% variance for statistical distribution
      expect(minCount).toBeGreaterThan(avgExpected * 0.3);
      expect(maxCount).toBeLessThan(avgExpected * 1.7);
    });
  });

  describe("cross-instance encryption", () => {
    it("should allow decryption by recipient only", () => {
      const alice = generateBoxKeyPair();
      const bob = generateBoxKeyPair();
      const eve = generateBoxKeyPair();

      // Alice encrypts for Bob
      const message = "Secret message for Bob";
      const encrypted = encryptBoxString(message, bob.publicKey);

      // Bob can decrypt
      const decryptedByBob = decryptBoxString(encrypted, bob.secretKey);
      expect(decryptedByBob).toBe(message);

      // Eve cannot decrypt
      const decryptedByEve = decryptBoxString(encrypted, eve.secretKey);
      expect(decryptedByEve).toBeNull();

      // Alice cannot decrypt (using original encryptor's key)
      const decryptedByAlice = decryptBoxString(encrypted, alice.secretKey);
      expect(decryptedByAlice).toBeNull();
    });

    it("should support authenticated encryption pattern", () => {
      // CLI generates keypair and shares public key via QR
      const cliKeypair = generateBoxKeyPair();

      // Web app generates keypair
      const webKeypair = generateBoxKeyPair();

      // Server encrypts response for web app using web's public key
      // (simulating the auth flow)
      const serverResponse = JSON.stringify({
        sharedSecret: "abc123",
        cliPublicKey: Array.from(cliKeypair.publicKey),
      });

      const encryptedResponse = encryptBoxString(serverResponse, webKeypair.publicKey);

      // Web app decrypts
      const decrypted = decryptBoxString(encryptedResponse, webKeypair.secretKey);

      expect(decrypted).toBe(serverResponse);
      const parsed = JSON.parse(decrypted!);
      expect(parsed.sharedSecret).toBe("abc123");
    });
  });

  describe("interoperability with CLI encryption", () => {
    it("should match expected bundle format", () => {
      const recipientKeypair = generateBoxKeyPair();
      const message = "Test message";

      const encrypted = encryptBoxString(message, recipientKeypair.publicKey);

      // Bundle format: ephemeral public key (32 bytes) + nonce (24 bytes) + ciphertext
      expect(encrypted.length).toBeGreaterThanOrEqual(56); // 32 + 24

      // First 32 bytes should be a valid public key
      const ephemeralPublicKey = encrypted.slice(0, 32);
      expect(ephemeralPublicKey.length).toBe(32);

      // Bytes 32-55 should be the nonce
      const nonce = encrypted.slice(32, 56);
      expect(nonce.length).toBe(24);

      // Rest is ciphertext
      const ciphertext = encrypted.slice(56);
      expect(ciphertext.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle null-like values in decryptBox", () => {
      const keypair = generateBoxKeyPair();

      // These should not throw, but return null
      expect(decryptBox(new Uint8Array(0), keypair.secretKey)).toBeNull();
      expect(decryptBox(new Uint8Array(55), keypair.secretKey)).toBeNull(); // One byte short
    });

    it("should handle consecutive encrypt/decrypt cycles", () => {
      const keypair = generateBoxKeyPair();
      const originalMessage = "Test message";

      for (let i = 0; i < 100; i++) {
        const encrypted = encryptBoxString(originalMessage, keypair.publicKey);
        const decrypted = decryptBoxString(encrypted, keypair.secretKey);
        expect(decrypted).toBe(originalMessage);
      }
    }, 10000);

    it("should handle special characters in messages", () => {
      const keypair = generateBoxKeyPair();
      const specialMessage = "!@#$%^&*()_+-=[]{}|;':\",.<>?/`~\\";

      const encrypted = encryptBoxString(specialMessage, keypair.publicKey);
      const decrypted = decryptBoxString(encrypted, keypair.secretKey);

      expect(decrypted).toBe(specialMessage);
    });

    it("should handle control characters", () => {
      const keypair = generateBoxKeyPair();
      const controlMessage = "\x00\x01\x02\x03\t\n\r";

      const encrypted = encryptBoxString(controlMessage, keypair.publicKey);
      const decrypted = decryptBoxString(encrypted, keypair.secretKey);

      expect(decrypted).toBe(controlMessage);
    });
  });
});
