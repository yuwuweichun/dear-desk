/* global addEventListener, clearTimeout, document, history, innerHeight, innerWidth, location, navigator, requestAnimationFrame, scrollY, setTimeout */

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const normalize = (value) => value.toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
  const escapeHtml = (value) => value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const sections = $$('[data-searchable]');
  const nav = $('#doc-nav');
  const menuButton = $('.menu-button');
  const mobileScrim = $('.mobile-scrim');

  nav.innerHTML = sections.map((section) => {
    const title = section.dataset.nav || $('h1, h2', section)?.textContent.trim() || section.id;
    return `<a href="#${escapeHtml(section.id)}">${escapeHtml(title)}</a>`;
  }).join('');

  const navLinks = $$('a[href^="#"]', nav);
  const activateHashNavigation = () => {
    if (!location.hash) return;
    navLinks.forEach((link) => link.classList.toggle('active', link.hash === location.hash));
  };
  const updateActiveNavigation = () => {
    const marker = 96;
    let active = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= marker) active = section;
    });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) active = sections.at(-1);
    navLinks.forEach((link) => link.classList.toggle('active', link.hash === `#${active?.id}`));
  };
  let navFrame = 0;
  addEventListener('scroll', () => {
    if (navFrame) return;
    navFrame = requestAnimationFrame(() => { updateActiveNavigation(); navFrame = 0; });
  }, { passive: true });
  addEventListener('hashchange', activateHashNavigation);
  addEventListener('load', activateHashNavigation);
  updateActiveNavigation();
  activateHashNavigation();

  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    mobileScrim.hidden = true;
  };
  menuButton.addEventListener('click', () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    mobileScrim.hidden = !open;
  });
  mobileScrim.addEventListener('click', closeMenu);
  navLinks.forEach((link) => link.addEventListener('click', closeMenu));

  const searchInput = $('#doc-search');
  const searchResults = $('#search-results');
  const searchIndex = sections.map((section) => {
    const title = $('h1, h2', section)?.textContent.trim() || section.id;
    const group = section.dataset.group || '文档';
    const navTitle = section.dataset.nav || '';
    return {
      id: section.id,
      title,
      group,
      text: normalize(`${navTitle} ${group} ${title} ${section.innerText || section.textContent || ''}`),
      section
    };
  });
  let matches = [];
  let activeResult = -1;

  const setSearchOpen = (open) => {
    searchResults.hidden = !open;
    searchInput.setAttribute('aria-expanded', String(open));
    if (!open) searchInput.removeAttribute('aria-activedescendant');
  };
  const excerpt = (entry, term) => {
    const index = Math.max(0, entry.text.indexOf(term));
    const start = Math.max(0, index - 36);
    const raw = entry.text.slice(start, start + 116);
    return `${start ? '…' : ''}${raw}${start + 116 < entry.text.length ? '…' : ''}`;
  };
  const mark = (value, terms) => {
    let html = escapeHtml(value);
    terms.filter(Boolean).sort((a, b) => b.length - a.length).forEach((term) => {
      html = html.replace(new RegExp(`(${escapeRegExp(escapeHtml(term))})`, 'ig'), '<mark>$1</mark>');
    });
    return html;
  };
  const setActiveResult = (index) => {
    const buttons = $$('.search-result', searchResults);
    if (!buttons.length) { activeResult = -1; return; }
    activeResult = (index + buttons.length) % buttons.length;
    buttons.forEach((button, buttonIndex) => button.setAttribute('aria-selected', String(buttonIndex === activeResult)));
    buttons[activeResult].scrollIntoView({ block: 'nearest' });
    searchInput.setAttribute('aria-activedescendant', buttons[activeResult].id);
  };
  const renderSearch = () => {
    const terms = normalize(searchInput.value).split(' ').filter(Boolean);
    if (!terms.length) { matches = []; activeResult = -1; searchResults.innerHTML = ''; setSearchOpen(false); return; }
    matches = searchIndex
      .filter((entry) => terms.every((term) => entry.text.includes(term)))
      .map((entry) => ({ ...entry, score: terms.reduce((score, term) => score + (normalize(entry.title).includes(term) ? 40 : 0) + Math.min(8, entry.text.split(term).length - 1) * 4, 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    if (!matches.length) {
      searchResults.innerHTML = `<div class="search-empty">没有找到“${escapeHtml(searchInput.value.trim())}”</div>`;
      setSearchOpen(true);
      activeResult = -1;
      return;
    }
    searchResults.innerHTML = `<div class="search-count">${matches.length} 个匹配章节</div>${matches.map((entry, index) => `
      <button id="search-result-${index}" class="search-result" type="button" role="option" aria-selected="false" data-index="${index}">
        <small>${escapeHtml(entry.group)}</small>
        <span><strong>${mark(entry.title, terms)}</strong><p>${mark(excerpt(entry, terms[0]), terms)}</p></span>
      </button>`).join('')}`;
    setSearchOpen(true);
    setActiveResult(0);
  };
  const visitResult = (index) => {
    const entry = matches[index];
    if (!entry) return;
    history.pushState(null, '', `#${entry.id}`);
    entry.section.scrollIntoView({ behavior: 'auto', block: 'start' });
    entry.section.classList.remove('search-hit');
    requestAnimationFrame(() => entry.section.classList.add('search-hit'));
    setTimeout(() => entry.section.classList.remove('search-hit'), 1300);
    setSearchOpen(false);
    searchInput.blur();
  };
  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) renderSearch(); });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveResult(activeResult + 1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveResult(activeResult - 1); }
    if (event.key === 'Enter' && activeResult >= 0) { event.preventDefault(); visitResult(activeResult); }
    if (event.key === 'Escape') { setSearchOpen(false); searchInput.blur(); }
  });
  searchResults.addEventListener('click', (event) => {
    const button = event.target.closest('.search-result');
    if (button) visitResult(Number(button.dataset.index));
  });
  document.addEventListener('keydown', (event) => {
    const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    const slash = event.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '');
    if (shortcut || slash) { event.preventDefault(); searchInput.focus(); searchInput.select(); }
    if (event.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('.search-shell')) setSearchOpen(false); });

  $$('.code-block').forEach((block) => {
    const head = document.createElement('div');
    head.className = 'code-head';
    head.innerHTML = `<span>${escapeHtml(block.dataset.codeTitle || 'Code')}</span><button class="copy-button" type="button" aria-label="复制代码">复制</button>`;
    block.prepend(head);
    $('.copy-button', head).addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const text = $('pre', block)?.textContent || '';
      const fallbackCopy = () => {
        const area = document.createElement('textarea');
        area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
        document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
      };
      try {
        if (location.protocol === 'file:' || !navigator.clipboard) fallbackCopy();
        else await navigator.clipboard.writeText(text);
      } catch {
        fallbackCopy();
      }
      button.textContent = '已复制';
      setTimeout(() => { button.textContent = '复制'; }, 1200);
    });
  });

  const definitions = new Map($$('[data-wiki-definition]').map((entry) => [entry.dataset.term, entry]));
  const popover = $('#wiki-popover');
  const popCategory = $('#wiki-category');
  const popTitle = $('#wiki-title');
  const popBody = $('#wiki-body');
  const popLink = $('#wiki-link');
  const popClose = $('#wiki-close');
  let activeTerm = null;
  let pinnedTerm = null;
  let suppressFocusOpen = false;
  let hideTimer = 0;

  const positionPopover = (trigger) => {
    if (innerWidth <= 580) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(390, innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - 12));
    popover.style.left = `${left}px`;
    popover.style.top = '12px';
    const height = popover.getBoundingClientRect().height;
    popover.style.top = `${rect.bottom + height + 12 < innerHeight ? rect.bottom + 10 : Math.max(12, rect.top - height - 10)}px`;
  };
  const hideWiki = (restoreFocus = false) => {
    clearTimeout(hideTimer);
    const trigger = activeTerm;
    popover.hidden = true;
    activeTerm = null;
    pinnedTerm = null;
    if (restoreFocus && trigger) {
      suppressFocusOpen = true;
      trigger.focus();
      requestAnimationFrame(() => { suppressFocusOpen = false; });
    }
  };
  const showWiki = (trigger) => {
    clearTimeout(hideTimer);
    const definition = definitions.get(trigger.dataset.wiki);
    if (!definition) return;
    activeTerm = trigger;
    popCategory.textContent = definition.dataset.category || '术语';
    popTitle.textContent = $('h3', definition)?.textContent || trigger.textContent;
    popBody.innerHTML = $$('p', definition).map((paragraph) => paragraph.outerHTML).join('');
    popLink.href = `#${definition.id || 'glossary'}`;
    popover.hidden = false;
    positionPopover(trigger);
  };
  const scheduleWikiHide = () => {
    clearTimeout(hideTimer);
    if (!pinnedTerm) hideTimer = setTimeout(() => hideWiki(false), 160);
  };
  $$('.wiki-term').forEach((trigger) => {
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('pointerenter', () => showWiki(trigger));
    trigger.addEventListener('pointerleave', scheduleWikiHide);
    trigger.addEventListener('focus', () => { if (!suppressFocusOpen) showWiki(trigger); });
    trigger.addEventListener('blur', scheduleWikiHide);
    trigger.addEventListener('click', () => {
      if (pinnedTerm === trigger && !popover.hidden) {
        hideWiki(false);
        return;
      }
      pinnedTerm = trigger;
      showWiki(trigger);
    });
  });
  popover.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  popover.addEventListener('pointerleave', scheduleWikiHide);
  popClose.addEventListener('click', () => hideWiki(true));
  popLink.addEventListener('click', () => hideWiki(false));
  document.addEventListener('click', (event) => {
    if (!popover.hidden && !event.target.closest('.wiki-term, .wiki-popover')) hideWiki(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !popover.hidden) hideWiki(true); });
  addEventListener('resize', () => { if (!popover.hidden && activeTerm) positionPopover(activeTerm); });
  addEventListener('scroll', () => { if (!popover.hidden && activeTerm && innerWidth > 580) positionPopover(activeTerm); }, { passive: true });
})();
