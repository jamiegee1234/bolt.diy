const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function uint8ToBase64(bytes: Uint8Array): string {
  // Convert Uint8Array to binary string in chunks to avoid call stack limits
  let binary = '';
  const chunkSize = 0x8000; // 32KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[]);
  }

  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

export function stringToBase64(input: string): string {
  const bytes = textEncoder.encode(input);
  return uint8ToBase64(bytes);
}

export function base64ToString(base64: string): string {
  const bytes = base64ToUint8(base64);
  return textDecoder.decode(bytes);
}

export function jsonToBase64<T>(data: T): string {
  return stringToBase64(JSON.stringify(data));
}

export function base64ToJson<T = unknown>(base64: string): T {
  const json = base64ToString(base64);
  return JSON.parse(json) as T;
}

