export function notificationsSupported() {
  return "Notification" in window;
}

export function getNotificationPermission() {
  if (!notificationsSupported()) {
    return "unsupported" as const;
  }

  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const permission = await Notification.requestPermission();

  return permission === "granted";
}

export function sendNotification(title: string, body: string, tag?: string) {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "/icon-192.png",
    tag,
  });
}
