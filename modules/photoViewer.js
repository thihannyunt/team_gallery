// Full-size photo pop-up shown when a painting is clicked or tapped
let controls;
let relockOnClose = false; // desktop: go back to mouse-look after closing if it was on before

const viewer = () => document.getElementById('photo-viewer');

export const isPhotoViewerOpen = () => viewer().classList.contains('show');

// BASE_URL keeps the path right whether or not the page URL ends with a slash
// (vite.config sets it without a trailing slash, so add exactly one)
const photoUrl = (info) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${info.link}`;

// Full-size photos fetched ahead, so the viewer opens on them straight away (photoPrompt.js asks for the
// one the visitor is facing, when its "View photo" button appears)
const preloaded = new Map();
export const preloadPhoto = (info) => {
  const url = photoUrl(info);
  if (preloaded.has(url)) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  preloaded.set(url, image);
};

export const openPhotoViewer = (info) => {
  if (isPhotoViewerOpen()) return; // a tap can arrive twice (touchend + click)

  // A fresh <img> each time: changing the old one's src kept the last photo on screen until the new one
  // had downloaded. Until it has, a placeholder in the photo's shape shows instead (style.css .loading).
  const old = document.getElementById('photo-viewer-image');
  const image = old.cloneNode(false);
  image.removeAttribute('src');
  image.alt = info.title;
  image.style.aspectRatio = info.aspect ? String(info.aspect) : '';
  image.classList.add('loading');
  const loaded = () => {
    if (image.isConnected) image.classList.remove('loading');
  };
  image.addEventListener('load', loaded, { once: true });
  image.addEventListener('error', loaded, { once: true });
  old.replaceWith(image);
  image.src = photoUrl(info);
  if (image.complete && image.naturalWidth) loaded(); // already fetched (preloadPhoto)
  document.getElementById('photo-viewer-title').textContent = info.title;
  document.getElementById('photo-viewer-role').textContent = info.role ?? '';
  document.getElementById('photo-viewer-description').textContent = info.description ?? '';
  const portfolio = document.getElementById('photo-viewer-portfolio');
  portfolio.href = info.portfolio || '';
  portfolio.hidden = !info.portfolio;

  // Free the mouse so the close button can be clicked
  relockOnClose = controls.isLocked;
  if (controls.isLocked) controls.unlock();

  viewer().classList.add('show');
  document.getElementById('close-photo').focus();
};

const closePhotoViewer = ({ relock }) => {
  viewer().classList.remove('show');
  // Pointer lock needs a click, so pressing Esc leaves the mouse free (Enter resumes)
  if (relock && relockOnClose) controls.lock();
  relockOnClose = false;
};

export const setupPhotoViewer = (pointerLockControls) => {
  controls = pointerLockControls;

  document
    .getElementById('close-photo')
    .addEventListener('click', () => closePhotoViewer({ relock: true }));

  // Clicking the dark area around the photo also closes it
  viewer().addEventListener('click', (event) => {
    if (event.target === viewer()) closePhotoViewer({ relock: true });
  });

  // While open, keys belong to the viewer: Esc closes it instead of opening the menu,
  // and W/A/S/D don't walk around behind it (keyup still passes so keys can't get stuck)
  window.addEventListener(
    'keydown',
    (event) => {
      if (!isPhotoViewerOpen()) return;
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        closePhotoViewer({ relock: false });
      }
    },
    true
  );
};
