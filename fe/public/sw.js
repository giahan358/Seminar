self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    console.error("Received an invalid Web Push payload.", error);
    return;
  }

  const title = typeof payload.title === "string" ? payload.title : "Thông báo mới";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    tag: typeof payload.id === "string" ? payload.id : undefined,
    data: {
      url: typeof payload.url === "string" ? payload.url : "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url;
  let destination = self.location.origin;
  if (typeof requestedUrl === "string" && requestedUrl.startsWith("/") && !requestedUrl.startsWith("//")) {
    destination = new URL(requestedUrl, self.location.origin).href;
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  })());
});
