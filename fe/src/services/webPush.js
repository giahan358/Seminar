const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

async function requestJson(path, accessToken, options = {}) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Web Push request failed (${response.status}): ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function enableWebPush(accessToken) {
  if (!accessToken) {
    throw new Error("An authenticated access token is required to enable Web Push.");
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support Web Push.");
  }
  if (!vapidPublicKey) {
    throw new Error("VITE_WEB_PUSH_VAPID_PUBLIC_KEY is not configured.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const publicKeyResponse = await requestJson("/notifications/web-push/public-key");
  if (publicKeyResponse.publicKey !== vapidPublicKey) {
    throw new Error("Frontend and backend Web Push public keys do not match.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await requestJson("/notifications/web-push/subscriptions", accessToken, {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });
  return subscription;
}

export async function disableWebPush(accessToken) {
  if (!accessToken) {
    throw new Error("An authenticated access token is required to disable Web Push.");
  }
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  await requestJson("/notifications/web-push/subscriptions/current", accessToken, {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}
