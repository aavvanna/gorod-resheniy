// ============================================================
//  ГОРОД РЕШЕНИЙ — game.js
// ============================================================

const STORAGE_KEY = 'gorod_resheniy_v1';

const Game = (() => {
  let state = {
    answers: {},       // { questionId: optionId }
    currentDistrict: null,
    currentQuestionIndex: 0
  };

  // ── Persistence ──────────────────────────────────────────
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        state.answers = saved.answers || {};
      } catch (e) {
        console.warn('Could not parse saved state');
      }
    }
  }

  function reset() {
    state = { answers: {}, currentDistrict: null, currentQuestionIndex: 0 };
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── Answers ───────────────────────────────────────────────
  function setAnswer(questionId, optionId) {
    const wasAnswered = state.answers[questionId] !== undefined;
    state.answers[questionId] = optionId;
    save();
    return !wasAnswered; // returns true if this is a new answer
  }

  function getAnswer(questionId) {
    return state.answers[questionId] || null;
  }

  // ── Progress ──────────────────────────────────────────────
  function getAnsweredCount() {
    return Object.keys(state.answers).length;
  }

  function getTotalCount() {
    return QUESTIONS.length; // 60
  }

  function getProgress() {
    return getAnsweredCount() / getTotalCount();
  }

  function isComplete() {
    return getAnsweredCount() >= getTotalCount();
  }

  // ── District helpers ──────────────────────────────────────
  function getDistrictQuestions(districtId) {
    return QUESTIONS.filter(q => q.district === districtId);
  }

  function getDistrictProgress(districtId) {
    const qs = getDistrictQuestions(districtId);
    const answered = qs.filter(q => state.answers[q.id] !== undefined).length;
    return { answered, total: qs.length };
  }

  function setCurrentDistrict(districtId) {
    state.currentDistrict = districtId;
    // Find first unanswered question in district, or start from 0
    const qs = getDistrictQuestions(districtId);
    const firstUnanswered = qs.findIndex(q => state.answers[q.id] === undefined);
    state.currentQuestionIndex = firstUnanswered >= 0 ? firstUnanswered : 0;
  }

  function getCurrentQuestion() {
    if (!state.currentDistrict) return null;
    const qs = getDistrictQuestions(state.currentDistrict);
    return qs[state.currentQuestionIndex] || null;
  }

  function getCurrentIndex() {
    return state.currentQuestionIndex;
  }

  function navigate(direction) {
    if (!state.currentDistrict) return;
    const qs = getDistrictQuestions(state.currentDistrict);
    const next = state.currentQuestionIndex + direction;
    if (next >= 0 && next < qs.length) {
      state.currentQuestionIndex = next;
    }
  }

  // ── Scoring ───────────────────────────────────────────────
  function computeScores() {
    const counts = {};   // { biasId: { total: N, triggered: N } }
    const maxPer = {};   // max points per bias

    // Count questions per bias
    QUESTIONS.forEach(q => {
      if (!counts[q.bias]) counts[q.bias] = { total: 0, triggered: 0 };
      counts[q.bias].total++;
    });

    // Count triggered (biased answer chosen)
    Object.entries(state.answers).forEach(([qIdStr, optionId]) => {
      const qId = parseInt(qIdStr);
      const q = QUESTIONS.find(x => x.id === qId);
      if (!q) return;
      const opt = q.options.find(o => o.id === optionId);
      if (opt && opt.biased) {
        counts[q.bias].triggered++;
      }
    });

    // Compute normalized scores 0–100
    const scores = {};
    Object.entries(counts).forEach(([biasId, { total, triggered }]) => {
      scores[biasId] = total > 0 ? Math.round((triggered / total) * 100) : 0;
    });

    return scores;
  }

  function getLevel(score) {
    if (score >= 70) return { label: 'Высокий', cls: 'high' };
    if (score >= 30) return { label: 'Средний', cls: 'medium' };
    return { label: 'Низкий', cls: 'low' };
  }

  // ── Public API ────────────────────────────────────────────
  return {
    load, save, reset,
    setAnswer, getAnswer,
    getAnsweredCount, getTotalCount, getProgress, isComplete,
    getDistrictQuestions, getDistrictProgress,
    setCurrentDistrict, getCurrentQuestion, getCurrentIndex, navigate,
    computeScores, getLevel,
    getState: () => state
  };
})();
