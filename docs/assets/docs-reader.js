(() => {
  const searchInput = document.querySelector('#doc-search');
  const searchResults = document.querySelector('#search-results');
  const searchableSections = [...document.querySelectorAll('main [data-search-title]')];
  const tocLinks = [...document.querySelectorAll('.sidebar nav a')];
  const tocToggle = document.querySelector('.toc-toggle');
  const sidebar = document.querySelector('.sidebar');
  const termPopover = document.querySelector('#term-popover');
  let activeSearchIndex = -1;
  let currentResults = [];

  const closeSearch = () => {
    searchResults.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    activeSearchIndex = -1;
  };

  const chooseSearchResult = (index) => {
    const result = currentResults[index];
    if (!result) return;
    window.location.hash = result.id;
    document.querySelector(`#${CSS.escape(result.id)}`)?.scrollIntoView();
    closeSearch();
    searchInput.blur();
  };

  const setActiveSearchResult = (index) => {
    const buttons = [...searchResults.querySelectorAll('.search-result')];
    if (!buttons.length) return;
    activeSearchIndex = (index + buttons.length) % buttons.length;
    buttons.forEach((button, buttonIndex) => {
      button.setAttribute('aria-selected', String(buttonIndex === activeSearchIndex));
    });
    buttons[activeSearchIndex].scrollIntoView({ block: 'nearest' });
  };

  const renderSearch = () => {
    const query = searchInput.value.trim().toLocaleLowerCase('zh-CN');
    searchResults.replaceChildren();
    activeSearchIndex = -1;

    if (!query) {
      closeSearch();
      return;
    }

    currentResults = searchableSections
      .filter((section) => section.textContent.toLocaleLowerCase('zh-CN').includes(query))
      .map((section) => {
        const text = section.textContent.replace(/\s+/g, ' ').trim();
        const matchIndex = text.toLocaleLowerCase('zh-CN').indexOf(query);
        const start = Math.max(0, matchIndex - 30);
        const excerpt = `${start > 0 ? '...' : ''}${text.slice(start, start + 100)}${text.length > start + 100 ? '...' : ''}`;
        return {
          id: section.id,
          title: section.dataset.searchTitle,
          excerpt,
        };
      });

    if (!currentResults.length) {
      const empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = `没有找到“${searchInput.value.trim()}”`;
      searchResults.append(empty);
    } else {
      currentResults.forEach((result, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'search-result';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', 'false');
        const title = document.createElement('strong');
        title.textContent = result.title;
        const excerpt = document.createElement('span');
        excerpt.textContent = result.excerpt;
        button.append(title, excerpt);
        button.addEventListener('click', () => chooseSearchResult(index));
        searchResults.append(button);
      });
    }

    searchResults.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
  };

  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSearchResult(activeSearchIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSearchResult(activeSearchIndex - 1);
    } else if (event.key === 'Enter' && activeSearchIndex >= 0) {
      event.preventDefault();
      chooseSearchResult(activeSearchIndex);
    } else if (event.key === 'Escape') {
      closeSearch();
      searchInput.blur();
    }
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      searchInput.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-shell')) closeSearch();
  });

  tocToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    tocToggle.setAttribute('aria-expanded', String(open));
  });

  tocLinks.forEach((link) => link.addEventListener('click', () => {
    sidebar.classList.remove('open');
    tocToggle.setAttribute('aria-expanded', 'false');
  }));

  const sections = [document.querySelector('#start'), ...searchableSections].filter(Boolean);
  const updateNavigation = () => {
    const activeSection = sections.reduce((current, section) => (
      section.getBoundingClientRect().top <= 184 ? section : current
    ), sections[0]);

    tocLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${activeSection.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  updateNavigation();
  window.addEventListener('scroll', updateNavigation, { passive: true });
  window.addEventListener('resize', updateNavigation);
  window.addEventListener('hashchange', updateNavigation);

  const hideTerm = () => {
    termPopover.hidden = true;
  };

  const showTerm = (term) => {
    termPopover.querySelector('strong').textContent = term.dataset.term;
    termPopover.querySelector('p').textContent = term.dataset.definition;
    termPopover.hidden = false;
    const rect = term.getBoundingClientRect();
    const popoverRect = termPopover.getBoundingClientRect();
    const left = Math.min(window.innerWidth - popoverRect.width - 16, Math.max(16, rect.left));
    const placeAbove = rect.bottom + popoverRect.height + 12 > window.innerHeight;
    const preferredTop = placeAbove ? rect.top - popoverRect.height - 8 : rect.bottom + 8;
    const top = Math.min(window.innerHeight - popoverRect.height - 12, Math.max(12, preferredTop));
    termPopover.style.left = `${left}px`;
    termPopover.style.top = `${top}px`;
  };

  document.querySelectorAll('.term').forEach((term) => {
    term.addEventListener('mouseenter', () => showTerm(term));
    term.addEventListener('mouseleave', hideTerm);
    term.addEventListener('focus', () => {
      showTerm(term);
      window.requestAnimationFrame(() => showTerm(term));
    });
    term.addEventListener('blur', hideTerm);
    term.addEventListener('click', (event) => {
      event.stopPropagation();
      if (termPopover.hidden) showTerm(term);
      else hideTerm();
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.term')) hideTerm();
  });

  document.querySelectorAll('.copy-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.querySelector(`#${CSS.escape(button.dataset.copyTarget)}`);
      if (!target) return;
      try {
        await navigator.clipboard.writeText(target.textContent);
        button.textContent = '已复制';
      } catch {
        button.textContent = '复制失败';
      }
      window.setTimeout(() => { button.textContent = '复制'; }, 1400);
    });
  });
})();
