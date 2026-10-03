export function mountPortfolio() {
  const home = document.querySelector('.greeting-home');
  const launcher = document.querySelector('#open-portfolio');
  const page = document.querySelector('#portfolio-page');
  const main = document.querySelector('main');
  const tabs = [...page.querySelectorAll('[data-portfolio-tab]')];
  let homeScroll = 0;


  function navigate() {
    const section = window.location.hash.slice(1);
    if (section === 'project' || section === 'experience') {
      const opening = page.hidden;
      if (opening) {
        homeScroll = window.scrollY;
        if (!document.querySelector('#character-page').hidden) document.querySelector('#back-to-greeting').click();
      }
      home.hidden = true;
      page.hidden = false;
      main.dataset.view = 'portfolio';
      tabs.forEach(tab => {
        if (tab.dataset.portfolioTab === section) tab.setAttribute('aria-current', 'page');
        else tab.removeAttribute('aria-current');
      });
      document.querySelector('#project-panel').hidden = section !== 'project';
      document.querySelector('#experience-panel').hidden = section !== 'experience';
      if (opening) {
        window.scrollTo(0, 0);
        page.focus({ preventScroll: true });
      }
    } else if (!page.hidden) {
      page.hidden = true;
      home.hidden = false;
      main.dataset.view = 'greeting';
      window.scrollTo(0, homeScroll);
      launcher.focus({ preventScroll: true });
    }
  }
  function escape(event) {
    if (event.key === 'Escape' && !page.hidden) {
      event.preventDefault();
      window.location.hash = 'home';
    }
  }
  window.addEventListener('hashchange', navigate);
  document.addEventListener('keydown', escape);
  navigate();
  return () => {
    window.removeEventListener('hashchange', navigate);
    document.removeEventListener('keydown', escape);
  };
}
