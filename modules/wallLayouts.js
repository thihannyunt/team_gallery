// Gallery wall layout recipes (see gallery-walls-2026-layout-recipes.md).
// Each layout takes a piece count and returns one slot per piece: { x, y, width, height } in inches,
// where x/y is the frame's center relative to the arrangement's center (x right, y up).
// Positions are built from frame edges plus a fixed gap, so spacing stays consistent whatever the sizes.

// Shift slots so the bounding box of the whole arrangement is centered on (0, 0)
function centerSlots(slots) {
  const left = Math.min(...slots.map((s) => s.x - s.width / 2));
  const right = Math.max(...slots.map((s) => s.x + s.width / 2));
  const bottom = Math.min(...slots.map((s) => s.y - s.height / 2));
  const top = Math.max(...slots.map((s) => s.y + s.height / 2));
  const dx = (left + right) / 2;
  const dy = (bottom + top) / 2;
  return slots.map((s) => ({ ...s, x: s.x - dx, y: s.y - dy }));
}

// Stack frames of one size vertically, centered on y = 0, with their centers at x
function column(x, count, [width, height], gap) {
  const total = count * height + (count - 1) * gap;
  return Array.from({ length: count }, (_, i) => ({
    x,
    y: total / 2 - height / 2 - i * (height + gap),
    width,
    height,
  }));
}

// Recipe #1: one large anchor plus smaller satellites. The first slot is the anchor.
// Narrow 8x10 satellites go on the left and wider 11x14 ones on the right, so the anchor
// sits slightly off-center and the wall avoids a static, symmetrical look.
export function statementSatellites(count, { gap = 2.5, anchor = [30, 40] } = {}) {
  const [anchorWidth] = anchor;
  const small = [8, 10];
  const medium = [11, 14];
  const satellites = count - 1;
  const rightCount = Math.ceil(satellites / 2);
  const leftCount = satellites - rightCount;

  const slots = [{ x: 0, y: 0, width: anchor[0], height: anchor[1] }];
  slots.push(...column(anchorWidth / 2 + gap + medium[0] / 2, rightCount, medium, gap));
  if (leftCount > 0) {
    slots.push(...column(-(anchorWidth / 2 + gap + small[0] / 2), leftCount, small, gap));
  }
  return centerSlots(slots);
}

// Recipe #2: identical frames in a perfectly aligned grid (4 → 2x2, 6 → 3x2).
export function quietGrid(count, { gap = 3, frame = [16, 20] } = {}) {
  const [width, height] = frame;
  const cols = Math.ceil(Math.sqrt(count));
  return centerSlots(
    Array.from({ length: count }, (_, i) => ({
      x: (i % cols) * (width + gap),
      y: -Math.floor(i / cols) * (height + gap),
      width,
      height,
    }))
  );
}

// Recipe #3: mixed sizes rising left to right, with bottom edges on one diagonal line.
export function staircaseRhythm(count, { gap = 2, slope = 0.35 } = {}) {
  const sizes = [[8, 10], [11, 14], [16, 20], [11, 14], [16, 20], [8, 10], [11, 14]];
  const slots = [];
  let left = 0;
  for (let i = 0; i < count; i++) {
    const [width, height] = sizes[i % sizes.length];
    const x = left + width / 2;
    slots.push({ x, y: x * slope + height / 2, width, height });
    left += width + gap;
  }
  return centerSlots(slots);
}

// A single straight row of identical frames, e.g. one portrait per teammate.
export function singleRow(count, { gap = 4, frame = [16, 20] } = {}) {
  const [width, height] = frame;
  return centerSlots(
    Array.from({ length: count }, (_, i) => ({ x: i * (width + gap), y: 0, width, height }))
  );
}
