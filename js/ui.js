// ============================================================
//  ГОРОД РЕШЕНИЙ — ui.js
// ============================================================

const UI = (() => {

  // ── Elements ──────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  // ── Init ──────────────────────────────────────────────────
  function init() {
    Game.load();
    renderProgress();
    renderMap();
    bindResultBtn();
    bindResetBtn();

    if (Game.isComplete()) {
      $('resultBtn').classList.remove('hidden');
    }
  }
  async function sendToSheets(answers) {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx1ghZT5VkTSM1TK8bh2hCplAnHNST7tmRysqt0YnKeHhkqP0bfyPCmkN1rzb5nw6YJPA/exec';

    // Формируем объект q1..q60 из твоего формата ответов
    const formatted = {};
    Object.entries(answers).forEach(([questionId, optionId]) => {
      // questionId у тебя выглядит как "fin_1", "shop_3" и т.д.
      // можно хранить как есть, или маппить в q1..q60
      formatted[questionId] = optionId;
    });

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        // Apps Script требует text/plain из-за CORS preflight
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          session_id: getSessionId(),
          answers: formatted
        })
      });
    } catch (err) {
      console.warn('Не удалось отправить в Sheets:', err);
      // Не блокируем пользователя — тихая ошибка
    }
  }

  function getSessionId() {
    let id = localStorage.getItem('session_id');
    if (!id) {
      id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      localStorage.setItem('session_id', id);
    }
    return id;
  }
  // ── Progress bar ─────────────────────────────────────────
  function renderProgress() {
    const answered = Game.getAnsweredCount();
    const total = Game.getTotalCount();
    const pct = Math.round(Game.getProgress() * 100);

    $('progressFill').style.width = pct + '%';
    $('progressText').textContent = `${answered} / ${total}`;

    if (Game.isComplete()) {
      $('resultBtn').classList.remove('hidden');
    }
  }

  // ── City map ─────────────────────────────────────────────
  function renderMap() {
    const map = $('cityMap');
    // Update district badges with progress
    Object.keys(DISTRICTS).forEach(dId => {
      const badge = map.querySelector(`[data-district-badge="${dId}"]`);
      if (!badge) return;
      const { answered, total } = Game.getDistrictProgress(dId);
      badge.textContent = `${answered}/${total}`;
      if (answered === total) {
        const zone = map.querySelector(`[data-district="${dId}"]`);
        if (zone) zone.classList.add('done');
      }
    });
  }

  // ── District click → open modal ───────────────────────────
  function openDistrict(districtId) {
    Game.setCurrentDistrict(districtId);
    const district = DISTRICTS[districtId];

    $('modalTitle').textContent = `${district.icon} ${district.name}`;
    $('modalOverlay').style.setProperty('--district-color', district.color);
    $('modalOverlay').style.setProperty('--district-glow', district.glow);

    renderQuestion();
    $('modalOverlay').classList.remove('hidden');
    $('modalOverlay').classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('modalOverlay').classList.remove('visible');
    setTimeout(() => $('modalOverlay').classList.add('hidden'), 300);
    document.body.style.overflow = '';
    renderProgress();
    renderMap();
  }

  // ── Question rendering ────────────────────────────────────
  function renderQuestion() {
    const q = Game.getCurrentQuestion();
    if (!q) return;

    const districtId = Game.getState().currentDistrict;
    const qs = Game.getDistrictQuestions(districtId);
    const idx = Game.getCurrentIndex();
    const savedAnswer = Game.getAnswer(q.id);

    // Counter
    $('questionCounter').textContent = `${idx + 1} / ${qs.length}`;

    // Text
    $('questionText').textContent = q.text;

    // Options
    const container = $('optionsContainer');
    container.innerHTML = '';
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.optionId = opt.id;
      btn.innerHTML = `<span class="option-letter">${opt.id}</span><span class="option-text">${opt.text}</span>`;

      if (savedAnswer === opt.id) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => selectOption(q.id, opt.id));
      container.appendChild(btn);
    });

    // Nav buttons
    $('btnBack').disabled = idx === 0;
    $('btnForward').disabled = idx === qs.length - 1;
  }

  function selectOption(questionId, optionId) {
    Game.setAnswer(questionId, optionId);

    // Update UI
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.optionId === optionId);
    });

    // Auto-advance after short delay
    setTimeout(() => {
      const districtId = Game.getState().currentDistrict;
      const qs = Game.getDistrictQuestions(districtId);
      const idx = Game.getCurrentIndex();
      if (idx < qs.length - 1) {
        Game.navigate(1);
        renderQuestion();
      }
      renderProgress();
    }, 400);
  }

  // ── Nav buttons ───────────────────────────────────────────
  function bindResultBtn() {
    $('resultBtn').addEventListener('click', showResults);
  }

  function bindResetBtn() {
    $('resetBtn').addEventListener('click', () => {
      if (confirm('Сбросить весь прогресс и начать заново?')) {
        Game.reset();
        location.reload();
      }
    });
  }

  // ── Result screen ─────────────────────────────────────────
  function showResults() {
    const scores = Game.computeScores();
    sendToSheets(Game.getState().answers);
    const screen = $('resultScreen');

    // Build bias cards
    const container = $('biasResults');
    container.innerHTML = '';

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([biasId, score]) => {
      const bias = BIASES[biasId];
      if (!bias) return;
      const level = Game.getLevel(score);

      const card = document.createElement('div');
      card.className = `bias-card level-${level.cls}`;
      card.innerHTML = `
        <div class="bias-header">
          <span class="bias-icon">${bias.icon}</span>
          <div class="bias-info">
            <h3 class="bias-name">${bias.name}</h3>
            <span class="bias-level level-badge-${level.cls}">${level.label}</span>
          </div>
          <div class="bias-score-wrap">
            <svg class="score-ring" viewBox="0 0 40 40">
              <circle class="ring-bg" cx="20" cy="20" r="16" />
              <circle class="ring-fill" cx="20" cy="20" r="16"
                stroke-dasharray="${score} 100"
                stroke-dashoffset="25" />
              <text class="ring-text" x="20" y="24">${score}%</text>
            </svg>
          </div>
        </div>
        <div class="bias-bar-wrap">
          <div class="bias-bar">
            <div class="bias-bar-fill level-fill-${level.cls}" style="width:${score}%"></div>
          </div>
        </div>
        <p class="bias-desc">${bias.description}</p>
        <p class="bias-advice">💡 ${bias.advice}</p>
      `;
      container.appendChild(card);
    });

    // Radar chart
    drawRadar(scores);

    // Top bias highlight
    const top = sorted[0];
    if (top && BIASES[top[0]]) {
      $('topBiasText').innerHTML = `
        Твоё главное когнитивное искажение — <strong>${BIASES[top[0]].name}</strong> (${top[1]}%).
        ${BIASES[top[0]].description}
      `;
    }

    screen.classList.remove('hidden');
    screen.scrollIntoView({ behavior: 'smooth' });
  }

  function hideResults() {
    $('resultScreen').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Radar chart (SVG) ────────────────────────────────────
  function drawRadar(scores) {
    const canvas = $('radarCanvas');
    const biasIds = Object.keys(BIASES);
    const N = biasIds.length;
    const cx = 200, cy = 200, r = 160;

    const toXY = (angle, radius) => ({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    });

    const angleStep = (2 * Math.PI) / N;
    const startAngle = -Math.PI / 2;

    let svgContent = '';

    // Grid rings
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      const pts = biasIds.map((_, i) => {
        const a = startAngle + i * angleStep;
        const p = toXY(a, r * frac);
        return `${p.x},${p.y}`;
      }).join(' ');
      svgContent += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
    });

    // Spokes
    biasIds.forEach((_, i) => {
      const a = startAngle + i * angleStep;
      const end = toXY(a, r);
      svgContent += `<line x1="${cx}" y1="${cy}" x2="${end.x}" y2="${end.y}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>`;
    });

    // Data polygon
    const dataPoints = biasIds.map((id, i) => {
      const a = startAngle + i * angleStep;
      const val = (scores[id] || 0) / 100;
      return toXY(a, r * val);
    });
    const polyPts = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
    svgContent += `<polygon points="${polyPts}" fill="rgba(99,102,241,0.35)" stroke="#818cf8" stroke-width="2"/>`;

    // Dots
    dataPoints.forEach(p => {
      svgContent += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#a5b4fc"/>`;
    });

    // Labels
    biasIds.forEach((id, i) => {
      const a = startAngle + i * angleStep;
      const labelPos = toXY(a, r + 28);
      const bias = BIASES[id];
      const shortName = bias.name.split(' ').slice(0, 2).join(' ');
      svgContent += `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="middle"
        fill="rgba(255,255,255,0.75)" font-size="10" font-family="sans-serif">${bias.icon} ${shortName}</text>`;
    });

    canvas.innerHTML = svgContent;
  }

  // ── Expose ────────────────────────────────────────────────
  return { init, openDistrict, closeModal, renderQuestion, hideResults };
})();

// ── Bootstrap ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  UI.init();

  // Modal nav
  document.getElementById('btnBack').addEventListener('click', () => {
    Game.navigate(-1);
    UI.renderQuestion();
  });
  document.getElementById('btnForward').addEventListener('click', () => {
    Game.navigate(1);
    UI.renderQuestion();
  });
  document.getElementById('btnMap').addEventListener('click', UI.closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) UI.closeModal();
  });
  document.getElementById('btnBackToMap').addEventListener('click', UI.hideResults);
});
