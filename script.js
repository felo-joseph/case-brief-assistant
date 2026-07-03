// script.js
// Talks to /api/brief, which is the only place the Anthropic API key lives.

const textarea = document.getElementById("opinion-input");
const charCount = document.getElementById("char-count");
const clearBtn = document.getElementById("clear-btn");
const briefBtn = document.getElementById("brief-btn");
const formError = document.getElementById("form-error");

const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const briefEl = document.getElementById("brief");

const caseNameEl = document.getElementById("case-name");
const stampEl = document.getElementById("stamp");
const issueEl = document.getElementById("issue-text");
const holdingEl = document.getElementById("holding-text");
const factsEl = document.getElementById("facts-text");
const reasoningEl = document.getElementById("reasoning-text");
const ruleEl = document.getElementById("rule-text");
const summaryEl = document.getElementById("summary-text");

const MIN_LENGTH = 200;

function updateCharCount() {
  const length = textarea.value.length;
  charCount.textContent = `${length.toLocaleString()} characters`;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.hidden = true;
  formError.textContent = "";
}

function setLoading(isLoading) {
  briefBtn.disabled = isLoading;
  briefBtn.querySelector(".btn__label").textContent = isLoading ? "Drafting..." : "Brief this opinion";

  if (isLoading) {
    emptyState.hidden = true;
    briefEl.hidden = true;
    loadingState.hidden = false;
  } else {
    loadingState.hidden = true;
  }
}

function showEmptyState() {
  emptyState.hidden = false;
  loadingState.hidden = true;
  briefEl.hidden = true;
}

function renderBrief(brief) {
  caseNameEl.textContent = brief.case_name ? brief.case_name : "Case name not identified from the text";
  issueEl.textContent = brief.issue;
  holdingEl.textContent = brief.holding;
  factsEl.textContent = brief.facts;
  reasoningEl.textContent = brief.reasoning;
  ruleEl.textContent = brief.rule;
  summaryEl.textContent = brief.plain_summary;

  emptyState.hidden = true;
  loadingState.hidden = true;
  briefEl.hidden = false;

  // Restart the stamp animation on every new brief.
  stampEl.style.animation = "none";
  void stampEl.offsetWidth;
  stampEl.style.animation = "";
}

async function requestBrief() {
  const opinionText = textarea.value.trim();

  clearError();

  if (opinionText.length < MIN_LENGTH) {
    showError(`Paste more of the opinion. At least ${MIN_LENGTH} characters are needed for a reliable brief.`);
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/api/brief", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opinionText }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong generating the brief.");
    }

    renderBrief(data.brief);
  } catch (err) {
    showEmptyState();
    showError(err.message || "Something went wrong generating the brief.");
  } finally {
    setLoading(false);
  }
}

textarea.addEventListener("input", () => {
  updateCharCount();
  if (!formError.hidden) clearError();
});

clearBtn.addEventListener("click", () => {
  textarea.value = "";
  updateCharCount();
  clearError();
  showEmptyState();
  textarea.focus();
});

briefBtn.addEventListener("click", requestBrief);

updateCharCount();
