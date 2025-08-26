import { base64ToString, stringToBase64, uint8ToBase64, base64ToUint8 } from '~/utils/base64';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IV_LENGTH = 16;

export async function encrypt(key: string, data: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await getKey(key);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    cryptoKey,
    encoder.encode(data),
  );

  // Bundle format: IV || CIPHERTEXT (iv first for conventional layout)
  const cipherBytes = new Uint8Array(ciphertext);
  const bundle = new Uint8Array(IV_LENGTH + cipherBytes.byteLength);
  bundle.set(iv, 0);
  bundle.set(cipherBytes, IV_LENGTH);

  return uint8ToBase64(bundle);
}

export async function decrypt(key: string, payload: string) {
  const bundle = base64ToUint8(payload);

  const iv = bundle.slice(0, IV_LENGTH);
  const ciphertext = bundle.slice(IV_LENGTH);

  const cryptoKey = await getKey(key);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    cryptoKey,
    ciphertext,
  );

  return decoder.decode(plaintext);
}

async function getKey(key: string) {
  const raw = encoder.encode(key);
  return await crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
}
