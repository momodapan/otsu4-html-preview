(() => {
  'use strict';
  const app = { chapters: [], data: {}, chapterIndex: 0, itemIndex: 0, view: 'intro' };
  const views = ['intro', 'body', 'questions'];
  const content = document.getElementById('content-region');
  const menu = document.getElementById('side-menu');
  const overlay = document.getElementById('menu-overlay');
  const menuButton = document.getElementById('menu-button');
  const questionKey = 'integratedQuestionState';

  const currentChapter = () => app.chapters[app.chapterIndex];
  const currentItems = () => app.data[currentChapter().id] || [];
  const currentItem = () => currentItems()[app.itemIndex];
  const top = () => window.scrollTo({ top: 0, behavior: 'auto' });
  function qState() { try { return JSON.parse(localStorage.getItem(questionKey) || '{}'); } catch { return {}; } }
  function saveQState(value) { try { localStorage.setItem(questionKey, JSON.stringify(value)); } catch {} }
  function htmlText(value) { return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }

  async function loadData() {
    if (Array.isArray(window.INTEGRATED_CHAPTERS) && window.INTEGRATED_CHAPTER_DATA && Object.keys(window.INTEGRATED_CHAPTER_DATA).length) {
      return { chapters: window.INTEGRATED_CHAPTERS, data: window.INTEGRATED_CHAPTER_DATA };
    }
    const response = await fetch('data/chapters.json');
    if (!response.ok) throw new Error('章データを取得できませんでした。');
    const chapters = await response.json();
    const pairs = await Promise.all(chapters.map(async chapter => {
      const itemResponse = await fetch(`data/${chapter.dataFile}`);
      if (!itemResponse.ok) throw new Error(`${chapter.title}の項目データを取得できませんでした。`);
      return [chapter.id, await itemResponse.json()];
    }));
    return { chapters, data: Object.fromEntries(pairs) };
  }

  function drawHeader() {
    const chapter = currentChapter();
    document.getElementById('chapter-header').innerHTML = `<span class="chapter-number">第${chapter.chapter}章</span><span class="chapter-title">${chapter.title}</span>`;
    const item = currentItem();
    document.getElementById('item-heading').innerHTML = `<div class="item-meta">項目${item.itemNo}/${currentItems().length}</div><h1 class="item-title">${item.title}</h1>`;
  }
  function drawMenu() {
    const list = document.getElementById('menu-list');
    list.innerHTML = app.chapters.map((chapter, index) => {
      const selected = index === app.chapterIndex;
      const items = app.data[chapter.id] || [];
      return `<section class="menu-section"><button type="button" class="menu-chapter" data-chapter="${index}" aria-current="${selected}">第${chapter.chapter}章　${chapter.title}</button>${items.map((item, itemIndex) => `<button type="button" class="menu-item" data-chapter="${index}" data-item="${itemIndex}" aria-current="${selected && itemIndex === app.itemIndex}">項目${item.itemNo}　${item.title}</button>`).join('')}</section>`;
    }).join('');
    list.querySelectorAll('.menu-chapter').forEach(button => button.addEventListener('click', () => { app.chapterIndex = Number(button.dataset.chapter); app.itemIndex = 0; closeMenu(); render(); top(); }));
    list.querySelectorAll('.menu-item').forEach(button => button.addEventListener('click', () => { app.chapterIndex = Number(button.dataset.chapter); app.itemIndex = Number(button.dataset.item); closeMenu(); render(); top(); }));
  }
  function drawTabs() {
    content.setAttribute('aria-labelledby', `tab-${app.view}`);
    document.querySelectorAll('[role="tab"]').forEach(tab => { const selected = tab.dataset.view === app.view; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
  }
  function navButton(direction, lower) {
    const available = app.itemIndex + direction >= 0 && app.itemIndex + direction < currentItems().length;
    return `<button type="button" class="item-nav${lower ? ' bottom' : ''}" data-item-move="${direction}" ${available ? '' : 'disabled'}>${direction < 0 ? '↑ 前の項目へ' : '↓ 次の項目へ'}</button>`;
  }
  function markerTools() { return `<div class="marker-tools"><button type="button" class="red-tool" data-marker-colour="red">赤ON</button><button type="button" class="blue-tool" data-marker-colour="blue">青ON</button></div>`; }
  function contentFor(item) {
    if (app.view === 'intro') return `${item.intro || ''}${item.introImage ? `<img class="illustration" src="${item.introImage}" alt="${item.introImageAlt || ''}">` : ''}`;
    if (app.view === 'body') return item.body || '';
    if (!item.questions || !item.questions.length) return '<p>この項目には参考問題がありません。</p>';
    const saved = qState();
    return `<div class="questions">${item.questions.map(question => questionMarkup(question, saved[question.id])).join('')}</div>`;
  }
  function questionMarkup(question, saved) {
    const answered = !!(saved && saved.selected);
    const selected = answered ? saved.selected : 0;
    const choices = question.choices.map((choice, index) => {
      const number = index + 1;
      const classes = ['choice'];
      if (answered && number === selected) classes.push('selected');
      if (answered && number === question.answer) classes.push('correct');
      if (answered && number === selected && number !== question.answer) classes.push('incorrect');
      return `<button type="button" class="${classes.join(' ')}" data-question="${question.id}" data-choice="${number}" aria-label="選択肢${number}: ${htmlText(choice)}" aria-pressed="${number === selected}" ${answered ? 'disabled' : ''}>${number}. ${choice}</button>`;
    }).join('');
    const feedback = answered ? `<div class="result ${selected === question.answer ? 'correct' : 'incorrect'}" aria-live="polite">${selected === question.answer ? '◯ 正解' : '× 不正解'}</div><div class="answer-detail">正解：${question.answer}. ${question.choices[question.answer - 1]}<br>${question.explanation}</div><button type="button" class="retry" data-retry="${question.id}">もう一度解く</button>` : '';
    return `<article class="question"><h3>問題${question.questionNo}</h3><div>${question.question}</div><div class="choices">${choices}</div>${feedback}</article>`;
  }
  function drawContent() {
    content.innerHTML = `${navButton(-1, false)}${markerTools()}<div class="content">${contentFor(currentItem())}</div>${navButton(1, true)}`;
    wireContent();
  }
  function updateBulkButtons() {
    content.querySelectorAll('[data-marker-colour]').forEach(button => {
      const colour = button.dataset.markerColour;
      const markers = [...content.querySelectorAll(`.marker-${colour}`)];
      const allMasked = markers.length > 0 && markers.every(marker => marker.classList.contains('is-masked'));
      button.disabled = markers.length === 0;
      button.textContent = `${colour === 'red' ? '赤' : '青'}${allMasked ? 'OFF' : 'ON'}`;
      button.setAttribute('aria-pressed', String(allMasked));
    });
  }
  function wireContent() {
    content.querySelectorAll('[data-item-move]').forEach(button => button.addEventListener('click', () => { app.itemIndex += Number(button.dataset.itemMove); render(); top(); }));
    content.querySelectorAll('.marker-red,.marker-blue').forEach(marker => {
      const toggle = () => { marker.classList.toggle('is-masked'); marker.setAttribute('aria-pressed', String(marker.classList.contains('is-masked'))); updateBulkButtons(); };
      marker.addEventListener('click', toggle);
      marker.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
    });
    content.querySelectorAll('[data-marker-colour]').forEach(button => button.addEventListener('click', () => {
      const markers = [...content.querySelectorAll(`.marker-${button.dataset.markerColour}`)];
      const turnOn = !markers.every(marker => marker.classList.contains('is-masked'));
      markers.forEach(marker => { marker.classList.toggle('is-masked', turnOn); marker.setAttribute('aria-pressed', String(turnOn)); });
      updateBulkButtons();
    }));
    content.querySelectorAll('.choice').forEach(button => button.addEventListener('click', () => { const all = qState(); all[button.dataset.question] = { selected: Number(button.dataset.choice) }; saveQState(all); drawContent(); }));
    content.querySelectorAll('[data-retry]').forEach(button => button.addEventListener('click', () => { const all = qState(); delete all[button.dataset.retry]; saveQState(all); drawContent(); }));
    updateBulkButtons();
  }
  function render() { drawHeader(); drawMenu(); drawTabs(); drawContent(); }
  function openMenu() { menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false'); menuButton.setAttribute('aria-expanded', 'true'); overlay.hidden = false; document.getElementById('menu-close').focus(); }
  function closeMenu() { menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); menuButton.setAttribute('aria-expanded', 'false'); overlay.hidden = true; menuButton.focus(); }

  document.querySelectorAll('[role="tab"]').forEach(tab => tab.addEventListener('click', () => { app.view = tab.dataset.view; render(); top(); }));
  menuButton.addEventListener('click', openMenu); document.getElementById('menu-close').addEventListener('click', closeMenu); overlay.addEventListener('click', closeMenu);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.classList.contains('is-open')) closeMenu(); });
  let gesture = null;
  function blockedTarget(target) { return target.closest('button,a,input,select,textarea,.marker'); }
  function resolveSwipe(dx, dy, event) { if (!gesture || gesture.blocked || gesture.cancelled || Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy)) return; const next = views.indexOf(app.view) + (dx < 0 ? 1 : -1); if (next >= 0 && next < views.length) { event.preventDefault(); app.view = views[next]; render(); top(); } }
  if (window.PointerEvent) {
    content.addEventListener('pointerdown', event => { if (!event.isPrimary) { if (gesture) gesture.cancelled = true; return; } gesture = { x:event.clientX, y:event.clientY, blocked:!!blockedTarget(event.target), cancelled:false }; });
    content.addEventListener('pointerup', event => { if (event.isPrimary && gesture) resolveSwipe(event.clientX - gesture.x, event.clientY - gesture.y, event); gesture = null; });
    content.addEventListener('pointercancel', () => { gesture = null; });
  } else {
    content.addEventListener('touchstart', event => { const touch = event.touches[0]; gesture = { x:touch.clientX, y:touch.clientY, blocked:!!blockedTarget(event.target), cancelled:event.touches.length !== 1 }; }, { passive:true });
    content.addEventListener('touchend', event => { if (gesture && event.changedTouches.length === 1) { const touch = event.changedTouches[0]; resolveSwipe(touch.clientX - gesture.x, touch.clientY - gesture.y, event); } gesture = null; }, { passive:false });
    content.addEventListener('touchcancel', () => { gesture = null; });
  }
  loadData().then(result => { app.chapters = result.chapters; app.data = result.data; if (!app.chapters.length || !currentItems().length) throw new Error('表示できる項目データがありません。'); render(); }).catch(error => { content.innerHTML = `<p role="alert">データの読込みに失敗しました。${error.message}</p>`; });
})();
