let items = [];
let currentIndex = 0;
let activeTab = "intro";
const markerState = loadState("lawMarkerState", {});
const visibleAnswers = loadState("lawVisibleAnswers", {});

const itemList = document.getElementById("itemList");
const itemNo = document.getElementById("itemNo");
const itemTitle = document.getElementById("itemTitle");
const counter = document.getElementById("counter");
const content = document.getElementById("content");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const redMarkerToggle = document.getElementById("redMarkerToggle");
const blueMarkerToggle = document.getElementById("blueMarkerToggle");
const boostBold = document.getElementById("boostBold");

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
    // 一時状態だけでも動作できればよいので、保存失敗は無視する。
  }
}

function markdownInlineToHtml(text) {
  return String(text || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function paragraphHtml(text) {
  if (!text) return '<p class="empty">内容がありません。</p>';
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p>${markdownInlineToHtml(line)}</p>`)
    .join("");
}

function renderItemList() {
  itemList.innerHTML = items
    .map(
      (item, index) =>
        `<button type="button" class="${index === currentIndex ? "active" : ""}" data-index="${index}">
          ${String(item.itemNo).padStart(2, "0")} ${item.title}
        </button>`
    )
    .join("");
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
  let markerIndex = 1;
  content.querySelectorAll("span.red, span.blue").forEach((span) => {
    const markerId = `${item.id}-${activeTab}-m${String(markerIndex).padStart(3, "0")}`;
    markerIndex += 1;
    span.classList.add("marker");
    span.classList.toggle("marker-red", span.classList.contains("red"));
    span.classList.toggle("marker-blue", span.classList.contains("blue"));
    span.dataset.markerId = markerId;
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");
    setMarkerElementState(span, isMarkerOn(markerId));
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
  saveState("lawMarkerState", markerState);
  updateColorToggleButtons();
}

function toggleVisibleMarkersByColor(colorClass) {
  const markers = [...content.querySelectorAll(`.${colorClass}[data-marker-id]`)];
  const allOn = markers.length > 0 && markers.every((marker) => marker.classList.contains("marker-on"));
  setVisibleMarkersByColor(colorClass, !allOn);
}

function renderContent(item) {
  if (activeTab === "intro") {
    content.innerHTML = paragraphHtml(item.intro);
    applyMarkers(item);
    return;
  }
  if (activeTab === "body") {
    content.innerHTML = paragraphHtml(item.body);
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
          <div class="question-text">${paragraphHtml(question.question)}</div>
          <ol class="choices">
            ${question.choices.map((choice) => `<li>${markdownInlineToHtml(choice)}</li>`).join("")}
          </ol>
          <button class="answer-toggle" type="button" aria-expanded="${Boolean(visibleAnswers[question.id])}">
            ${visibleAnswers[question.id] ? "回答を隠す" : "回答表示"}
          </button>
          <div class="answer answer-block" ${visibleAnswers[question.id] ? "" : "hidden"}>
            <p><strong>正解：${question.answer}</strong></p>
            ${paragraphHtml(question.explanation)}
          </div>
        </section>`
    )
    .join("");
  applyMarkers(item);
}

function render() {
  const item = items[currentIndex];
  renderItemList();
  itemNo.textContent = `項目 ${String(item.itemNo).padStart(2, "0")}`;
  itemTitle.textContent = item.title;
  counter.textContent = `${currentIndex + 1} / ${items.length}・問題 ${item.questions.length}`;
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === items.length - 1;
  renderContent(item);
  document.body.classList.toggle("boost-bold", boostBold.checked);
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
}

itemList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  currentIndex = Number(button.dataset.index);
  render();
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
  currentIndex = Math.min(items.length - 1, currentIndex + 1);
  render();
});

boostBold.addEventListener("change", render);

redMarkerToggle.addEventListener("click", () => {
  toggleVisibleMarkersByColor("marker-red");
});

blueMarkerToggle.addEventListener("click", () => {
  toggleVisibleMarkersByColor("marker-blue");
});

content.addEventListener("click", (event) => {
  const marker = event.target.closest(".marker[data-marker-id]");
  if (marker) {
    const markerId = marker.dataset.markerId;
    markerState[markerId] = !isMarkerOn(markerId);
    setMarkerElementState(marker, markerState[markerId]);
    saveState("lawMarkerState", markerState);
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
  saveState("lawVisibleAnswers", visibleAnswers);
});

content.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const marker = event.target.closest(".marker[data-marker-id]");
  if (!marker) return;
  event.preventDefault();
  marker.click();
});

if (Array.isArray(window.LAW_CHAPTER_01_ITEMS)) {
  items = window.LAW_CHAPTER_01_ITEMS;
  render();
} else {
  fetch("law_chapter_01_items.json")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      items = data;
      render();
    })
    .catch((error) => {
      content.innerHTML = `<p class="empty">データを読み込めませんでした。</p><p class="empty">${error.message}</p>`;
    });
}
