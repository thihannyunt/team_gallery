// Court Connect "About us" content. This gallery replaces the About page at
// https://cconnect.tspdigital.solutions/about, so the wording follows that page.
// Used by the member name cards (paintings.js), the photo pop-up (photoViewer.js) and the About page
// in the menu (aboutPage.js).

// `portfolio`: each member's portfolio site, e.g. 'https://your-name.dev'. Leave it empty until there
// is one; the name card and About page then simply leave the link out.
export const people = {
  mike: {
    name: 'Pyae Htut Khaing (Mike)',
    role: 'Project Manager',
    quote: 'Standup in two minutes. Court at six.',
    description: 'Keeps the crew on track from the first wireframe to the last deploy.',
    portfolio: '',
  },
  thn: {
    name: 'Thi Han Nyunt',
    role: 'Technical Team Lead',
    quote: 'Ship it — right after one tiny review.',
    description: 'Leads the technical side of Court Connect and reviews what ships.',
    portfolio: '',
  },
  pyaeSone: {
    name: 'Pyae Sone Thant Kyaw',
    role: 'DevOps & LINE Integration',
    quote: "Server's up, bot replied. Great day.",
    description: 'Runs the servers and deploys, and connects Court Connect to LINE.',
    portfolio: '',
  },
  arKar: {
    name: 'Ar Kar',
    role: 'Software Developer',
    quote: "One more refactor and it's perfect. Probably.",
    description: 'Builds the features players use to organise sessions and matches.',
    portfolio: '',
  },
  abp: {
    name: 'Aung Bhone Pyae',
    role: 'Software Developer',
    quote: "It's not a bug until Myat finds it.",
    description: 'Builds the features players use to fill lobbies and keep score.',
    portfolio: '',
  },
  myat: {
    name: 'Aye Myo Myat',
    role: 'Software Tester',
    quote: 'Found it. I clicked everything twice.',
    description: 'Tests every flow before it reaches players.',
    portfolio: '',
  },
};

// Order the crew appears in on the About page
export const crewOrder = ['mike', 'thn', 'pyaeSone', 'arKar', 'abp', 'myat'];

export const about = {
  title: 'The crew behind your court',
  intro:
    'Court Connect helps badminton players organise sessions, find matches, manage lobbies, and keep track of play — together in one place.',
  tagline: 'Six teammates, one obsession: getting you on court faster.',
  features: [
    {
      title: 'Organise sessions',
      body: 'Pick a court, set a time, and let the crew know — booking and reminders handled in one flow.',
    },
    {
      title: 'Fill the lobby',
      body: 'Share an invite, watch players join, and balance the teams before anyone steps on court.',
    },
    {
      title: 'Keep the score',
      body: 'Run matches live, track every rally, and keep a history of how the night actually went.',
    },
  ],
  highlights: ['6 teammates', 'One obsession', 'Built for badminton'],
  email: 'office.courtconnect@gmail.com',
  appUrl: 'https://cconnect.tspdigital.solutions',
  lineUrl: 'https://line.me/ti/p/~Kopaye-19', // LINE chat, on the contact whiteboard and the About page
  signOff: 'See you on court.',
};
