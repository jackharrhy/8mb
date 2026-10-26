import { $ } from "./ui";
export function initOffline() {
  async function registerOffline() {
    if (!("serviceWorker" in navigator) || !isSecureContext) {
      $("offline-status").textContent = "HTTPS needed for offline mode";
      return;
    }
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        $("offline-status").textContent = e.data.ready
          ? "Available offline"
          : "Offline setup incomplete";
      };
      navigator.serviceWorker.controller?.postMessage({ type: "status" }, [
        channel.port2,
      ]);
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            $("offline-status").textContent = "Available offline";
          },
          { once: true },
        );
      }
    } catch {
      $("offline-status").textContent =
        "Offline setup failed · reload to retry";
    }
  }
  void registerOffline();
  let installEvent: (Event & { prompt: () => Promise<void> }) | undefined;
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as typeof installEvent;
    $("install").hidden = false;
  });
  $("install").addEventListener("click", async () => {
    await installEvent?.prompt();
    $("install").hidden = true;
  });
}
