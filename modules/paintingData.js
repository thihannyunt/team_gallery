import { statementSatellites, singleRow } from './wallLayouts.js';
import { people, about } from './teamData.js';

// What the proximity card and photo pop-up say about each member's photos
const member = (person) => ({
  name: person.name,
  role: person.role,
  description: `"${person.quote}" ${person.description}`,
  portfolio: person.portfolio,
  person, // the member's name card under the portrait reads this
});

const team = {
  name: 'The Court Connect Crew',
  role: 'Six teammates, one obsession',
  description: about.intro,
};

// Photos on the walls. Files live in public/artworks/mine/. `aspect` is width / height of the image.
const photos = {
  four_people: { file: 'four_people.jpg', ...team, name: 'The Team', aspect: 1819 / 2048 },
  cooperate_team_portrait: { file: 'cooperate_team_portrait.jpg', ...team, aspect: 1 },
  abp: { file: 'abp.jpg', ...member(people.abp), aspect: 1536 / 2048 },
  abp_eye: { file: 'abp_eye.jpg', ...member(people.abp), name: `${people.abp.name} (Detail)`, aspect: 1 },
  ar_kar: { file: 'ar_kar.jpg', ...member(people.arKar), aspect: 1638 / 2048 },
  arkar: { file: 'arkar.jpg', ...member(people.arKar), aspect: 1365 / 2048 },
  ko_pyae: { file: 'ko_pyae.jpg', ...member(people.mike), aspect: 1536 / 2048 },
  myat: { file: 'myat.jpg', ...member(people.myat), aspect: 1638 / 2048 },
  pyae_sone: { file: 'pyae_sone.jpg', ...member(people.pyaeSone), aspect: 1638 / 2048 },
  thn: { file: 'thn.jpg', ...member(people.thn), aspect: 1638 / 2048 },
};

const TEAM = 'Court Connect';
const YEAR = '2026';

export const FLOOR_Y = -Math.PI; // matches floor.js
export const UNITS_PER_METER = (2 - FLOOR_Y) / 1.6; // the camera's eye height (y = 2) is treated as 1.6 m
export const CENTERLINE_Y = FLOOR_Y + 1.5 * UNITS_PER_METER; // arrangement center at 57–60 in from the floor
// Recipe sizes are in inches. Life size (~0.08) looks lost on these 40-unit walls, so hang at ~1.7x.
const UNITS_PER_INCH = 0.14;

// One story per wall. `photos` are listed in slot order (for Statement + Satellites the first one is
// the anchor); each wall hangs exactly its photos.
// `layoutOptions` overrides recipe defaults such as the anchor size or gap; `raise` lifts the whole
// arrangement (inches) to leave room for name cards underneath; `nameCards` hangs one under each photo.
// `frame` is the finish of the shared thin frame profile: 'oak' (natural wood) or 'black' (matte metal).
// A wall without a `title` gets no wall label.
// The right wall holds the "Team Activities" projector screen (projector.js) and the front wall's
// "Rally" print hangs to the right of the team portrait (featureArt.js).
const walls = [
  {
    // The team portrait, with the "Rally" print beside it (no wall label)
    layout: statementSatellites,
    layoutOptions: { anchor: [36, 36] }, // square anchor to match the square team portrait
    frame: 'oak',
    photos: ['cooperate_team_portrait'],
    origin: { x: -8, z: -19.5 }, // Front Wall, left of center
    rotationY: 0,
  },
  {
    title: 'Meet the Crew',
    subtitle: 'Tap a portrait for more',
    layout: singleRow,
    layoutOptions: { frame: [28, 35], gap: 12 },
    raise: 7,
    nameCards: true,
    frame: 'black',
    photos: ['ko_pyae', 'thn', 'pyae_sone', 'ar_kar', 'abp', 'myat'], // About page order
    origin: { x: -19.5, z: 0 }, // Left Wall
    rotationY: Math.PI / 2,
  },
  {
    title: 'Behind the Scenes',
    layout: singleRow,
    layoutOptions: { frame: [20, 25], gap: 8 },
    frame: 'black',
    photos: ['four_people', 'arkar', 'abp_eye'],
    origin: { x: 0, z: 19.5 }, // Back Wall
    rotationY: Math.PI,
  },
];

// Converts a point on the wall (x along the wall to the viewer's right, y up) to world coordinates
function wallToWorld(wall, x, y) {
  return {
    x: wall.origin.x + Math.cos(wall.rotationY) * x,
    y,
    z: wall.origin.z - Math.sin(wall.rotationY) * x,
  };
}

const layouts = walls.map((wall) => {
  const slots = wall.layout(wall.photos.length, wall.layoutOptions).map((slot) => ({
    x: slot.x * UNITS_PER_INCH,
    y: CENTERLINE_Y + (slot.y + (wall.raise ?? 0)) * UNITS_PER_INCH,
    width: slot.width * UNITS_PER_INCH,
    height: slot.height * UNITS_PER_INCH,
  }));
  return { wall, slots };
});

export const paintingData = layouts.flatMap(({ wall, slots }) =>
  slots.map((slot, i) => {
    const photo = photos[wall.photos[i]];
    const imgSrc = `artworks/mine/${photo.file}`;

    return {
      imgSrc,
      aspect: photo.aspect,
      // Outer size of the frame; the photo is fitted inside its mat without stretching
      width: slot.width,
      height: slot.height,
      frame: wall.frame,
      nameCard: wall.nameCards ? photo.person : null,
      position: wallToWorld(wall, slot.x, slot.y),
      rotationY: wall.rotationY,
      info: {
        title: photo.name,
        role: photo.role,
        description: photo.description,
        portfolio: photo.portfolio,
        year: YEAR,
        link: imgSrc, // clicking a painting opens the full-size photo
      },
    };
  })
);

// One small wall label per arrangement, hung to the right of it just below the centerline
export const wallLabelData = layouts.filter(({ wall }) => wall.title).map(({ wall, slots }) => {
  const right = Math.max(...slots.map((s) => s.x + s.width / 2));
  return {
    title: wall.title,
    subtitle: wall.subtitle ?? `${TEAM}, ${YEAR}`,
    position: wallToWorld(wall, right + 1.4, CENTERLINE_Y - 0.6),
    rotationY: wall.rotationY,
  };
});
