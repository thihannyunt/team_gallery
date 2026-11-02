// Display painting info in the DOM
export const displayPaintingInfo = (info) => {
  const infoElement = document.getElementById('painting-info'); // Get the reference

  // Set the html content inside info element
  infoElement.innerHTML = `
    <h3>${info.title}</h3>
    ${info.role ? `<p>Role: ${info.role}</p>` : ''}
    <p>${info.description}</p>
    <p>Year: ${info.year}</p>
  `;
  infoElement.classList.add('show'); // Add the 'show' class
};

// Hide painting info in the DOM
export const hidePaintingInfo = () => {
  const infoElement = document.getElementById('painting-info'); // Get the reference
  infoElement.classList.remove('show'); // Remove the 'show' class
};

