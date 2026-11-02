export const hideMenu = () => {
  const menu = document.getElementById('menu');
  menu.style.display = 'none'; // Hide the menu
  document.body.classList.add('exploring'); // Show the on-screen touch controls (in touch mode)
};

export const showMenu = () => {
  const menu = document.getElementById('menu');
  menu.style.display = 'block'; // Show the menu
  document.body.classList.remove('exploring');
};

// Lock the pointer (controls are activated) and hide the menu when the experience starts
export const startExperience = (controls) => {
  // Phones and tablets can't lock the pointer, touch mode looks around by dragging instead
  if (!document.body.classList.contains('touch-mode')) {
    controls.lock(); // Lock the pointer (controls are activated)
  }
  hideMenu();
};

export const setupPlayButton = (controls) => {
  const playButton = document.getElementById('play_button'); // Get the reference
  playButton.addEventListener('click', () => startExperience(controls)); // Add the click event listener to the play button to start the experience
};
