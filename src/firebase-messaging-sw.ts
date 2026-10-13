/// <reference lib="webworker" />

import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import firebaseConfig from "../firebase-applet-config.json";
import { createVocabularyNotificationDisplay } from "./lib/pushNotification";

declare const self: ServiceWorkerGlobalScope;

const messaging = getMessaging(initializeApp(firebaseConfig));

onBackgroundMessage(messaging, (payload) => {
  const notification = createVocabularyNotificationDisplay(payload.data);
  return self.registration.showNotification(notification.title, notification.options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationData = event.notification.data as { url?: string } | undefined;
  const path = notificationData?.url?.startsWith("/")
    ? notificationData.url
    : "/dictionary";
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existingWindow = windows.find((client) => "focus" in client);
    if (existingWindow && "navigate" in existingWindow) {
      await existingWindow.navigate(targetUrl);
      return existingWindow.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
