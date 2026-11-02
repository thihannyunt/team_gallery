import { VRButton } from "three/examples/jsm/webxr/VRButton.js";

export const setupVR = (renderer) => {
  renderer.xr.enabled = true;

  renderer.xr.addEventListener("sessionstart", () => {
    console.log("WebXR session started");
  });

  renderer.xr.addEventListener("sessionend", () => {
    console.log("WebXR session ended");
  });

  // Phones and most computers can't start VR, and the button then just says "VR not supported" or
  // "WebXR needs HTTPS" (on top of the touch joystick), so only show it where VR can actually start
  navigator.xr
    ?.isSessionSupported("immersive-vr")
    .then((supported) => {
      if (supported) document.body.appendChild(VRButton.createButton(renderer));
    })
    .catch(() => {});
};
