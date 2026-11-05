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
  // "WebXR needs HTTPS" (on top of the touch joystick), so only show it where VR can actually start.
  // three.js puts it at the bottom centre, on top of the "Sit & watch" / "Play" buttons, so it joins the
  // music and full-screen buttons at the top right instead (style.css #VRButton).
  navigator.xr
    ?.isSessionSupported("immersive-vr")
    .then((supported) => {
      if (supported) document.getElementById("audio_controls").appendChild(VRButton.createButton(renderer));
    })
    .catch(() => {});
};
