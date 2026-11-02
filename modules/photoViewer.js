// Full-size photo pop-up shown when a painting is clicked or tapped
let controls;
let relockOnClose = false; // desktop: go back to mouse-look after closing if it was on before

const viewer = () => document.getElementById('photo-viewer');

export const isPhotoViewerOpen = () => viewer().classList.contains('show');

export const openPhotoViewer = (info) => {
  if (isPhotoViewerOpen()) return; // a tap can arrive twice (touchend + click)

  const image = document.getElementById('photo-viewer-image');
  // BASE_URL keeps the path right whether or not the page URL ends with a slash
  // (vite.config sets it without a trailing slash, so add exactly one)
  image.src = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${info.link}`;
  image.alt = info.title;
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
