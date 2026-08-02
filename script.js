let chapters = [];
let chapterData = {};
let currentChapterId = "law";
let currentIndex = 0;
let activeTab = "intro";
const markerState = loadState("integratedMarkerState", {});
const visibleAnswers = loadState("integratedVisibleAnswers", {});

const menuButton = document.getElementById("menuButton");
const menuOverlay = document.getElementById("menuOverlay");
const sideMenu = document.getElementById("sideMenu");
const menuCloseButton = document.getElementById("menuCloseButton");
const chapterItemNav = document.getElementById("chapterItemNav");
const chapterLabel = document.getElementById("chapterLabel");
const chapterTitle = document.getElementById("chapterTitle");
const itemNo = document.getElementById("itemNo");
const itemTitle = document.getElementById("itemTitle");
const counter = document.getElementById("counter");
const content = document.getElementById("content");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const redMarkerToggle = document.getElementById("redMarkerToggle");
const blueMarkerToggle = document.getElementById("blueMarkerToggle");

function loadState(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorageが使えない環境でも、その場の表示操作は継続する。
  }
}

function currentChapter() {
  return chapters.find((chapter) => chapter.id === currentChapterId);
}

function currentItems() {
  return chapterData[currentChapterId] || [];
}

function markdownInlineToHtml(text) {
  return String(text || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function tableHtml(lines, startIndex) {
  const rows = [];
  let index = startIndex;
  while (index < lines.length && /^\|.*\|$/.test(lines[index])) {
    rows.push(lines[index]);
    index += 1;
  }
  const parsed = rows
    .filter((row, rowIndex) => rowIndex !== 1 || !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(row))
    .map((row) => row.slice(1, -1).split("|").map((cell) => markdownInlineToHtml(cell.trim())));
  const head = parsed[0] || [];
  const body = parsed.slice(1);
  return {
    html: `<table><thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${body
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`,
    nextIndex: index,
  };
}

function richTextHtml(text) {
  if (!text) return '<p class="empty">内容がありません。</p>';
  const lines = String(text).split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(lines[i + 1])) {
      const table = tableHtml(lines, i);
      blocks.push(table.html);
      i = table.nextIndex;
      continue;
    }
    const isSubheading = /^<strong class="body-subheading">/.test(line.trim());
    blocks.push(`<p${isSubheading ? ' class="body-subheading"' : ""}>${markdownInlineToHtml(line)}</p>`);
    i += 1;
  }
  return blocks.join("");
}

function openMenu() {
  menuOverlay.hidden = false;
  sideMenu.classList.add("open");
  document.body.classList.add("menu-open");
  sideMenu.setAttribute("aria-hidden", "false");
  menuButton.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  menuOverlay.hidden = true;
  sideMenu.classList.remove("open");
  document.body.classList.remove("menu-open");
  sideMenu.setAttribute("aria-hidden", "true");
  menuButton.setAttribute("aria-expanded", "false");
}

function renderSideMenu() {
  chapterItemNav.innerHTML = chapters
    .map((chapter) => {
      const items = chapterData[chapter.id] || [];
      const itemButtons = items
        .map((item, index) => {
          const isActive = chapter.id === currentChapterId && index === currentIndex;
          return `<button type="button" class="nav-item ${isActive ? "active" : ""}" data-chapter-id="${chapter.id}" data-index="${index}">
            <span class="nav-item-no">${String(item.itemNo).padStart(2, "0")}</span>
            <span>${item.title}</span>
          </button>`;
        })
        .join("");
      return `<section class="nav-chapter">
        <h3>第${chapter.chapter}章 ${chapter.title}</h3>
        <div class="nav-items">${itemButtons}</div>
      </section>`;
    })
    .join("");
}

function normalizeLegacyMarkers(item) {
  let markerIndex = 1;
  content.querySelectorAll("span.red, span.blue").forEach((span) => {
    if (!span.dataset.markerId) {
      span.dataset.markerId = `${item.id}-${activeTab}-m${String(markerIndex).padStart(3, "0")}`;
      markerIndex += 1;
    }
    span.classList.add("marker");
    span.classList.toggle("marker-red", span.classList.contains("red"));
    span.classList.toggle("marker-blue", span.classList.contains("blue"));
  });
}

function isMarkerOn(markerId) {
  return markerState[markerId] !== false;
}

function setMarkerElementState(marker, isOn) {
  marker.classList.toggle("marker-on", isOn);
  marker.classList.toggle("marker-off", !isOn);
  marker.setAttribute("aria-pressed", String(isOn));
  marker.setAttribute("title", isOn ? "クリックでマーカーOFF" : "クリックでマーカーON");
}

function applyMarkers(item) {
  normalizeLegacyMarkers(item);
  content.querySelectorAll(".marker[data-marker-id]").forEach((marker) => {
    marker.setAttribute("role", "button");
    marker.setAttribute("tabindex", "0");
    setMarkerElementState(marker, isMarkerOn(marker.dataset.markerId));
  });
  updateColorToggleButtons();
}

function updateColorToggleButton(button, markers, colorLabel) {
  const hasMarkers = markers.length > 0;
  const allOn = hasMarkers && markers.every((marker) => marker.classList.contains("marker-on"));
  button.disabled = !hasMarkers;
  button.textContent = allOn ? `${colorLabel}を表示` : `${colorLabel}を隠す`;
  button.setAttribute("aria-pressed", String(allOn));
}

function updateColorToggleButtons() {
  updateColorToggleButton(redMarkerToggle, [...content.querySelectorAll(".marker-red[data-marker-id]")], "赤");
  updateColorToggleButton(blueMarkerToggle, [...content.querySelectorAll(".marker-blue[data-marker-id]")], "青");
}

function setVisibleMarkersByColor(colorClass, isOn) {
  content.querySelectorAll(`.${colorClass}[data-marker-id]`).forEach((marker) => {
    markerState[marker.dataset.markerId] = isOn;
    setMarkerElementState(marker, isOn);
  });
  saveState("integratedMarkerState", markerState);
  updateColorToggleButtons();
}

function toggleVisibleMarkersByColor(colorClass) {
  const markers = [...content.querySelectorAll(`.${colorClass}[data-marker-id]`)];
  const allOn = markers.length > 0 && markers.every((marker) => marker.classList.contains("marker-on"));
  setVisibleMarkersByColor(colorClass, !allOn);
}

function renderContent(item) {
  if (activeTab === "intro") {
    content.innerHTML = richTextHtml(item.intro) + (item.introImage ? `<img class="intro-image" src="${item.introImage}" alt="${item.introImageAlt || ""}" />` : "");
    applyMarkers(item);
    return;
  }
  if (activeTab === "body") {
    content.innerHTML = richTextHtml(item.body);
    applyMarkers(item);
    return;
  }
  if (!item.questions.length) {
    content.innerHTML = '<p class="empty">この項目には参考問題がありません。</p>';
    updateColorToggleButtons();
    return;
  }
  content.innerHTML = item.questions
    .map(
      (question) => `
        <section class="question question-card" data-question-id="${question.id}">
          <h3>問題 ${question.questionNo}</h3>
          <div class="question-text">${richTextHtml(question.question)}</div>
          <ol class="choices">
            ${question.choices.map((choice) => `<li>${markdownInlineToHtml(choice)}</li>`).join("")}
          </ol>
          <button class="answer-toggle" type="button" aria-expanded="${Boolean(visibleAnswers[question.id])}">
            ${visibleAnswers[question.id] ? "回答を隠す" : "回答表示"}
          </button>
          <div class="answer answer-block" ${visibleAnswers[question.id] ? "" : "hidden"}>
            <p><strong>正解：${question.answer}</strong></p>
            ${richTextHtml(question.explanation)}
          </div>
        </section>`
    )
    .join("");
  applyMarkers(item);
}

function render() {
  const chapter = currentChapter();
  const items = currentItems();
  const item = items[currentIndex];
  if (!chapter || !item) {
    content.innerHTML = '<p class="empty">データを読み込めませんでした。</p>';
    return;
  }
  renderSideMenu();
  chapterLabel.textContent = `第${chapter.chapter}章`;
  chapterTitle.textContent = chapter.title;
  itemNo.textContent = `項目 ${String(item.itemNo).padStart(2, "0")}`;
  itemTitle.textContent = item.title;
  counter.textContent = `${currentIndex + 1} / ${items.length}・問題 ${item.questions.length}`;
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === items.length - 1;
  renderContent(item);
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
}

function selectChapter(chapterId, itemIndex = 0) {
  currentChapterId = chapterId;
  currentIndex = Math.max(0, Math.min(itemIndex, currentItems().length - 1));
  render();
}

menuButton.addEventListener("click", openMenu);
menuCloseButton.addEventListener("click", closeMenu);
menuOverlay.addEventListener("click", closeMenu);

chapterItemNav.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-chapter-id][data-index]");
  if (!button) return;
  selectChapter(button.dataset.chapterId, Number(button.dataset.index));
  closeMenu();
});

document.querySelector(".tabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  activeTab = button.dataset.tab;
  render();
});

prevBtn.addEventListener("click", () => {
  currentIndex = Math.max(0, currentIndex - 1);
  render();
});

nextBtn.addEventListener("click", () => {
  currentIndex = Math.min(currentItems().length - 1, currentIndex + 1);
  render();
});

redMarkerToggle.addEventListener("click", () => toggleVisibleMarkersByColor("marker-red"));
blueMarkerToggle.addEventListener("click", () => toggleVisibleMarkersByColor("marker-blue"));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

content.addEventListener("click", (event) => {
  const marker = event.target.closest(".marker[data-marker-id]");
  if (marker) {
    markerState[marker.dataset.markerId] = !isMarkerOn(marker.dataset.markerId);
    setMarkerElementState(marker, markerState[marker.dataset.markerId]);
    saveState("integratedMarkerState", markerState);
    updateColorToggleButtons();
    return;
  }
  const answerButton = event.target.closest(".answer-toggle");
  if (!answerButton) return;
  const card = answerButton.closest(".question-card");
  const answerBlock = card.querySelector(".answer-block");
  const questionId = card.dataset.questionId;
  visibleAnswers[questionId] = !visibleAnswers[questionId];
  answerBlock.hidden = !visibleAnswers[questionId];
  answerButton.textContent = visibleAnswers[questionId] ? "回答を隠す" : "回答表示";
  answerButton.setAttribute("aria-expanded", String(Boolean(visibleAnswers[questionId])));
  saveState("integratedVisibleAnswers", visibleAnswers);
});

content.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const marker = event.target.closest(".marker[data-marker-id]");
  if (!marker) return;
  event.preventDefault();
  marker.click();
});

let swipeStart = null;
function startsOnControl(target) {
  return Boolean(target.closest("button, a, input, select, textarea, .marker"));
}
function beginSwipe(x, y, target, pointerId) {
  swipeStart = startsOnControl(target) ? null : { x, y, pointerId, multi: false };
}
function finishSwipe(x, y, event) {
  if (!swipeStart || swipeStart.multi) { swipeStart = null; return; }
  const start = swipeStart;
  swipeStart = null;
  const dx = x - start.x;
  const dy = y - start.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  let moved = false;
  if (absX >= 60 && absX > absY) {
    if (dx < 0 && activeTab !== "questions") { activeTab = activeTab === "intro" ? "body" : "questions"; moved = true; }
    if (dx > 0 && activeTab !== "intro") { activeTab = activeTab === "questions" ? "body" : "intro"; moved = true; }
  } else if (absY >= 60 && absY > absX) {
    if (start.y <= 50 && dy <= -60 && currentIndex > 0) { currentIndex -= 1; moved = true; }
    if (start.y >= window.innerHeight - 50 && dy >= 60 && currentIndex < currentItems().length - 1) { currentIndex += 1; moved = true; }
  }
  if (moved) { if (event.cancelable) event.preventDefault(); render(); }
}
content.addEventListener("pointerdown", (event) => {
  if (swipeStart) swipeStart.multi = true;
  if (event.isPrimary) beginSwipe(event.clientX, event.clientY, event.target, event.pointerId);
});
content.addEventListener("pointerup", (event) => {
  if (swipeStart && swipeStart.pointerId === event.pointerId) finishSwipe(event.clientX, event.clientY, event);
});
content.addEventListener("pointercancel", () => { swipeStart = null; });
content.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 1) { swipeStart = null; return; }
  const touch = event.touches[0];
  beginSwipe(touch.clientX, touch.clientY, event.target, touch.identifier);
}, { passive: true });
content.addEventListener("touchend", (event) => {
  if (swipeStart && event.changedTouches.length === 1) {
    const touch = event.changedTouches[0];
    finishSwipe(touch.clientX, touch.clientY, event);
  }
}, { passive: false });

async function loadData() {
  if (Array.isArray(window.INTEGRATED_CHAPTERS) && window.INTEGRATED_CHAPTER_DATA) {
    chapters = window.INTEGRATED_CHAPTERS;
    chapterData = window.INTEGRATED_CHAPTER_DATA;
    currentChapterId = chapters[0]?.id || "law";
    render();
    return;
  }
  const chaptersResponse = await fetch("data/chapters.json");
  if (!chaptersResponse.ok) throw new Error(`chapters.json HTTP ${chaptersResponse.status}`);
  chapters = await chaptersResponse.json();
  const dataEntries = await Promise.all(
    chapters.map(async (chapter) => {
      const response = await fetch(`data/${chapter.dataFile}`);
      if (!response.ok) throw new Error(`${chapter.dataFile} HTTP ${response.status}`);
      return [chapter.id, await response.json()];
    })
  );
  chapterData = Object.fromEntries(dataEntries);
  currentChapterId = chapters[0]?.id || "law";
  render();
}

loadData().catch((error) => {
  content.innerHTML = `<p class="empty">データを読み込めませんでした。</p><p class="empty">${error.message}</p>`;
});
