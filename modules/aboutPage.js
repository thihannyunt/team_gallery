import { about, people, crewOrder } from './teamData.js';

// Fills the About page in the menu (index.html #about-overlay) from teamData.js, so it says the same
// as the name cards on the gallery walls.

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export const setupAboutPage = () => {
  document.getElementById('about-title').textContent = about.title;
  document.getElementById('about-intro').textContent = about.intro;
  document.getElementById('about-tagline').textContent = about.tagline;
  document.getElementById('about-sign-off').textContent = about.signOff;

  document
    .getElementById('about-highlights')
    .append(...about.highlights.map((highlight) => element('li', null, highlight)));

  document.getElementById('about-features').append(
    ...about.features.map((feature) => {
      const card = element('div', 'about-feature');
      card.append(element('h3', null, feature.title), element('p', null, feature.body));
      return card;
    })
  );

  document.getElementById('about-crew').append(
    ...crewOrder.map((key) => {
      const person = people[key];
      const card = element('article', 'about-member');
      card.append(
        element('h3', null, person.name),
        element('p', 'about-role', person.role),
        element('p', 'about-quote', `“${person.quote}”`),
        element('p', null, person.description)
      );
      if (person.portfolio) {
        const link = element('a', 'about-portfolio', 'Visit portfolio ↗');
        link.href = person.portfolio;
        link.target = '_blank';
        link.rel = 'noopener';
        card.append(link);
      }
      return card;
    })
  );

  const email = document.getElementById('about-email');
  email.textContent = about.email;
  email.href = `mailto:${about.email}`;
  document.getElementById('about-app').href = about.appUrl;
};
