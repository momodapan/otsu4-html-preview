(() => {
  const state = { chapter: 0, item: 0, view: 'intro' };
  const data = window.itemData || {};
  const panel = document.getElementById('panel');
  const selector = document.getElementById('chapter-selector');
  const header = document.getElementById('item-header');
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const questionKey = 'integratedQuestionState';

  function currentChapter() { return window.chapters[state.chapter]; }
  function items() { return data[currentChapter().id] || []; }
  function currentItem() { return items()[state.item]; }
  function readQuestionState() { try { return JSON.parse(localStorage.getItem(questionKey) || '{}'); } catch { return {}; } }
  function writeQuestionState(value) { try { localStorage.setItem(questionKey, JSON.stringify(value)); } catch {} }
  function resetMarkers() { panel.querySelectorAll('.marker').forEach(marker => { marker.classList.remove('is-revealed'); marker.setAttribute('aria-pressed', 'false'); }); }
  function scrollTop() { window.scrollTo({ top: 0, behavior: 'auto' }); }

  function renderChapterSelector() {
    selector.innerHTML = window.chapters.map((chapter, index) => `<button type="button" aria-current="${index === state.chapter}" data-chapter="${index}">第${chapter.chapter}章 ${chapter.title}</button>`).join('');
    selector.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { state.chapter = Number(button.dataset.chapter); state.item = 0; render(); scrollTop(); }));
  }
  function renderHeader() {
    const chapter = currentChapter(), item = currentItem();
    header.innerHTML = `<div class="chapter-name"><span class="chapter-number">第${chapter.chapter}章</span><span class="chapter-title">${chapter.title}</span></div><div class="item-meta">項目${item.itemNo}/${items().length}</div><h1 class="item-title">${item.title}</h1>`;
  }
  function nav(direction) {
    const next = state.item + direction;
    if (next < 0 || next >= items().length) return;
    state.item = next; render(); scrollTop();
  }
  function navButton(direction) {
    const available = state.item + direction >= 0 && state.item + direction < items().length;
    const label = direction < 0 ? '↑ 前の項目へ' : '↓ 次の項目へ';
    return `<button type="button" class="item-nav" data-direction="${direction}" ${available ? '' : 'disabled'}>${label}</button>`;
  }
  function markerTools() { return `<div class="marker-tools"><button type="button" data-marker-all="red">赤マーカーをすべて表示</button><button type="button" data-marker-all="blue">青マーカーをすべて表示</button><button type="button" data-marker-all="clear">マーカー表示を解除</button></div>`; }
  function wireMarkers() {
    panel.querySelectorAll('.marker').forEach(marker => {
      const toggle = () => { const active = marker.classList.toggle('is-revealed'); marker.setAttribute('aria-pressed', String(active)); };
      marker.addEventListener('click', toggle);
      marker.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
    });
    panel.querySelectorAll('[data-marker-all]').forEach(button => button.addEventListener('click', () => {
      const colour = button.dataset.markerAll;
      panel.querySelectorAll('.marker').forEach(marker => { const active = colour !== 'clear' && marker.classList.contains(`marker-${colour}`); marker.classList.toggle('is-revealed', active); marker.setAttribute('aria-pressed', String(active)); });
    }));
  }
  function renderQuestions(item) {
    const saved = readQuestionState();
    panel.innerHTML = navButton(-1) + `<div class="questions">${item.questions.map(question => questionCard(question, saved[question.id])).join('')}</div>` + navButton(1);
    panel.querySelectorAll('.choice').forEach(button => button.addEventListener('click', () => answer(button.dataset.question, Number(button.dataset.choice))));
    panel.querySelectorAll('.retry').forEach(button => button.addEventListener('click', () => { const all = readQuestionState(); delete all[button.dataset.question]; writeQuestionState(all); renderPanel(); }));
    wireNav();
  }
  function questionCard(question, answer) {
    const answered = Boolean(answer && answer.selected);
    const selected = answered ? answer.selected : 0;
    const correct = question.answer;
    const choices = question.choices.map((choice, index) => {
      const number = index + 1;
      const classes = ['choice'];
      if (answered && number === selected) classes.push('selected');
      if (answered && number === correct) classes.push('correct');
      if (answered && number === selected && selected !== correct) classes.push('incorrect');
      return `<button type="button" class="${classes.join(' ')}" data-question="${question.id}" data-choice="${number}" aria-label="選択肢${number}: ${choice.replace(/<[^>]*>/g, '')}" aria-pressed="${number === selected}" ${answered ? 'disabled' : ''}>${number}. ${choice}</button>`;
    }).join('');
    let feedback = '';
    if (answered) { const ok = selected === correct; feedback = `<div class="result ${ok ? 'correct' : 'incorrect'}" aria-live="polite">${ok ? '◯ 正解' : '× 不正解'}</div><div class="answer-detail">正解：${correct}. ${question.choices[correct - 1]}<br>${question.explanation}</div><button type="button" class="retry" data-question="${question.id}">もう一度解く</button>`; }
    return `<article class="question"><h3>問題${question.questionNo}</h3><div>${question.question}</div><div class="choices">${choices}</div>${feedback}</article>`;
  }
  function answer(questionId, choice) { const all = readQuestionState(); all[questionId] = { selected: choice }; writeQuestionState(all); renderPanel(); }
  function wireNav() { panel.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => nav(Number(button.dataset.direction)))); }
  function renderPanel() {
    const item = currentItem();
    if (state.view === 'questions') { renderQuestions(item); return; }
    const content = state.view === 'intro' ? `<img class="illustration" src="${item.introImage}" alt="${item.introImageAlt}">${item.intro}` : markerTools() + item.body;
    panel.innerHTML = navButton(-1) + `<div class="content">${content}</div>` + navButton(1);
    wireNav(); wireMarkers();
  }
  function renderTabs() { panel.setAttribute('aria-labelledby', `tab-${state.view}`); tabs.forEach(tab => { const active = tab.dataset.view === state.view; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; }); }
  function render() { renderChapterSelector(); renderHeader(); renderTabs(); renderPanel(); }
  tabs.forEach(tab => tab.addEventListener('click', () => { state.view = tab.dataset.view; render(); scrollTop(); }));
  let start = null, ignorePointer = false;
  panel.addEventListener('pointerdown', event => { if (!event.isPrimary) { ignorePointer = true; return; } start = { x:event.clientX, y:event.clientY, target:event.target }; ignorePointer = false; });
  panel.addEventListener('pointerup', event => { if (!start || ignorePointer || !event.isPrimary) return; const dx = event.clientX - start.x, dy = event.clientY - start.y; const blocked = start.target.closest('button,a,input,select,textarea,.marker'); if (!blocked && Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy)) { event.preventDefault(); const views=['intro','body','questions']; const next=views.indexOf(state.view)+(dx < 0 ? 1 : -1); if (next >= 0 && next < views.length) { state.view=views[next]; render(); scrollTop(); } } start=null; });
  panel.addEventListener('pointercancel', () => { start=null; ignorePointer=true; });
  render();
})();
