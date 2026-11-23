import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getLatestAndroidBuild } from "../api";
import { mobileApp } from "../content";

// The newest published Android build from the backend, so the download button and QR code
// always point to the latest APK. Falls back to VITE_ANDROID_APK_URL if the backend has none.
export function useAndroidRelease() {
  const [release, setRelease] = useState({ apkUrl: mobileApp.apkUrl, version: "" });

  useEffect(() => {
    let active = true;
    getLatestAndroidBuild()
      .then((res) => {
        if (active && res.ok && res.data?.apk_url) {
          setRelease({ apkUrl: res.data.apk_url, version: res.data.version || "" });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return release;
}

// A QR code image for a link. Renders nothing until the image is ready.
export function QRImage({ value, label, size = 220 }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size, margin: 1 }).then(setSrc).catch(() => setSrc(""));
  }, [value, size]);

  if (!value || !src) return null;
  return <img src={src} width={size} height={size} alt={label} />;
}
