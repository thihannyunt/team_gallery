// Lower only the 3D canvas resolution when sustained slow frames make looking around laggy.
// HTML controls keep their full resolution. Never change quality for one loading hitch or a hidden tab.
const SLOW_FRAME = 1 / 55;
const SETTLE_TIME = 1.5;
const SAMPLE_TIME = 1.5;
const MIN_SAMPLES = 12;
const MIN_PIXEL_RATIO = 0.75;

export const createRenderQuality = (renderer) => {
  let settling = SETTLE_TIME;
  let time = 0;
  let frames = 0;
  let slowFrames = 0;

  const resetSample = () => {
    time = 0;
    frames = 0;
    slowFrames = 0;
  };

  return (delta, active) => {
    if (!active || !Number.isFinite(delta) || delta <= 0 || delta >= 1) {
      settling = SETTLE_TIME;
      resetSample();
      return;
    }
    if (settling > 0) {
      settling -= delta;
      return;
    }

    time += delta;
    frames += 1;
    if (delta > SLOW_FRAME) slowFrames += 1;
    if (time < SAMPLE_TIME || frames < MIN_SAMPLES) return;

    // A majority of missed frames indicates sustained load, not an occasional asset upload.
    // Include 250–999 ms frames: the old filter ignored severely struggling devices entirely.
    const ratio = renderer.getPixelRatio();
    if (slowFrames / frames >= 0.6 && ratio > MIN_PIXEL_RATIO) {
      renderer.setPixelRatio(Math.max(MIN_PIXEL_RATIO, ratio - 0.25));
    }
    resetSample();
  };
};
