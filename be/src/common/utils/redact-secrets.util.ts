/** Che trường bí mật trong JSON audit kể cả object/mảng lồng nhau, giữ nguyên field kỹ thuật để vẫn đọc được cấu trúc thay đổi */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    /password|token|authorization|secret|key|ciphertext|cookie|credential|p256dh|^auth$/i.test(key)
      ? "[ĐÃ CHE]" : redactSecrets(item),
  ]));
}
