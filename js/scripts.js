(function () {
  /*** UTILITIES ***/
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

  /*** DOM ***/
  const app = qs('#app');
  const progressBar = qs('#progressBar');
  const badgeProgress = qs('#badgeProgress');
  const scoreLine = qs('#scoreLine');
  const flagIndexEl = qs('#flagIndex');
  const flagTotalEl = qs('#flagTotal');
  const flagImg = qs('#flagImg');
  const flagLabel = qs('#flagLabel');
  const choicesEl = qs('#choices');
  const hintCapital = qs('#hintCapital');
  const hintContinent = qs('#hintContinent');
  const btnSkip = qs('#btnSkip');
  const btnReset = qs('#btnReset');
  const btnReview = qs('#btnReview');
  const reviewDialog = qs('#reviewDialog');
  const btnCloseReview = qs('#btnCloseReview');
  const reviewList = qs('#reviewList');
  const btnPracticeWrong = qs('#btnPracticeWrong');
  const btnReturnMain = qs('#btnReturnMain');
  const resumeDialog = qs('#resumeDialog');
  const btnResume = qs('#btnResume');
  const btnNewRun = qs('#btnNewRun');
  const streakEl = qs('#streak');
  const accuracyEl = qs('#accuracy');
  const playedEl = qs('#played');
  const flagTotalBadge = qs('#flagTotal');
  const themeToggle = qs('#themeToggle input');

  const STORAGE_KEY = 'flagGame.v1';

  /*** GAME STATE ***/
  let countries = [];
  let order = [];
  let index = 0;
  let correct = 0;
  let answered = 0;
  let streak = 0;
  let wrongBank = [];
  let practiceWrong = false;
  let mainBackup = null;

  /*** THEME ***/
  const savedTheme = localStorage.getItem('flagGame.theme') || 'dark';
  document.documentElement.dataset.theme = savedTheme;
  themeToggle.checked = savedTheme === 'light';
  themeToggle.addEventListener('change', () => {
    const now = themeToggle.checked ? 'light' : 'dark';
    document.documentElement.dataset.theme = now;
    localStorage.setItem('flagGame.theme', now);
  });

  /*** DATA FETCH ***/
  async function fetchCountries() {
    const url =
      'https://restcountries.com/v3.1/all?fields=cca2,name,capital,region,continents,flags,independent,unMember';
    const res = await fetch(url);
    const data = await res.json();
    let base = data.filter((c) => c.unMember && c.independent);
    const extras = data.filter((c) =>
      ['XK', 'TW', 'VA', 'PS'].includes(c.cca2)
    );
    const map = new Map(base.concat(extras).map((c) => [c.cca2, c]));
    countries = [...map.values()].sort((a, b) =>
      a.name.common.localeCompare(b.name.common)
    );
  }

  function buildOrder() {
    order = countries.map((c) => c.cca2);
    shuffle(order);
  }

  function save() {
    const payload = {
      order,
      index,
      correct,
      answered,
      streak,
      wrongBank,
      practiceWrong,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    updateProgressBadge();
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function resetAll() {
    correct = 0;
    answered = 0;
    streak = 0;
    index = 0;
    wrongBank = [];
    practiceWrong = false;
    buildOrder();
    render();
    save();
  }

  function currentCountry() {
    return countries.find((c) => c.cca2 === order[index]);
  }

  function others(count, except) {
    const pool = countries.filter((c) => c.cca2 !== except);
    shuffle(pool);
    return pool.slice(0, count);
  }

  function updateProgressBadge() {
    const pct = Math.round((index / order.length) * 100);
    badgeProgress.textContent = pct + '%';
    progressBar.style.width = pct + '%';
  }

  function updateStats() {
    flagIndexEl.textContent = Math.min(index + 1, order.length);
    flagTotalEl.textContent = order.length;
    scoreLine.textContent = `${correct} / ${answered}`;
    accuracyEl.textContent = answered
      ? Math.round((correct / answered) * 100) + '%'
      : '0%';
    playedEl.textContent = answered;
    streakEl.textContent = streak + '🔥';
  }

  function setFlag(c) {
    flagImg.src = c.flags.svg || c.flags.png;
    flagImg.alt = `Flag of ${c.name.common}`;
    flagLabel.textContent = 'Guess the country';
    hintCapital.textContent = Array.isArray(c.capital)
      ? c.capital[0] || '—'
      : c.capital || '—';
    hintContinent.textContent =
      (c.continents && c.continents[0]) || c.region || '—';
  }

  function makeChoices(c) {
    const answers = [c, ...others(2, c.cca2)];
    shuffle(answers);
    choicesEl.innerHTML = '';
    answers.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<span class="kbd">${i + 1}</span> ${opt.name.common}`;
      b.addEventListener('click', () => pick(opt.cca2, b));
      choicesEl.appendChild(b);
    });
  }

  let locked = false;
  async function pick(code, btn) {
    if (locked) return;
    locked = true;
    const c = currentCountry();
    const nodes = qsa('.choice', choicesEl);
    nodes.forEach((n) => (n.disabled = true));

    const correctBtn = nodes.find((n) =>
      n.textContent.trim().endsWith(c.name.common)
    );
    if (code === c.cca2) {
      correctBtn.classList.add('correct');
      correct++;
      streak++;
    } else {
      btn.classList.add('wrong');
      correctBtn.classList.add('correct');
      streak = 0;
      wrongBank.push({
        code: c.cca2,
        picked: code,
      });
    }

    answered++;
    updateStats();
    save();
    await wait(600);
    next();
    locked = false;
  }

  function next() {
    if (index < order.length - 1) {
      index++;
      render();
      save();
    } else {
      flagLabel.textContent = '🎉 End of game!';
    }
  }

  function skip() {
    if (locked) return;
    index = Math.min(index + 1, order.length - 1);
    render();
    save();
  }

  function render() {
    const c = currentCountry();
    if (!c) return;
    setFlag(c);
    makeChoices(c);
    updateStats();
    updateProgressBadge();
  }

  /*** REVIEW MODAL ***/
  function openReview() {
    reviewList.innerHTML = '';
    if (!wrongBank.length) {
      const d = document.createElement('div');
      d.textContent = 'No mistakes yet!';
      d.style.color = 'var(--muted)';
      reviewList.appendChild(d);
    } else {
      const seen = new Set();
      wrongBank
        .slice()
        .reverse()
        .forEach((item) => {
          if (seen.has(item.code)) return;
          seen.add(item.code);
          const c = countries.find((cc) => cc.cca2 === item.code);
          const li = document.createElement('div');
          li.className = 'listItem';
          li.innerHTML = `<div><strong>${c?.name?.common || item.code}</strong>
                                                                    <div style="color:var(--muted); font-size:12px;">
                                                                    Capital: ${
                                                                      Array.isArray(
                                                                        c?.capital
                                                                      )
                                                                        ? c
                                                                            .capital[0] ||
                                                                          '—'
                                                                        : c?.capital ||
                                                                          '—'
                                                                    }
                                                                    • Continent: ${
                                                                      (c?.continents &&
                                                                        c
                                                                          .continents[0]) ||
                                                                      c?.region ||
                                                                      '—'
                                                                    }</div></div>`;
          reviewList.appendChild(li);
        });
    }
    reviewDialog.showModal();
  }

  function practiceWrongOn() {
    if (!wrongBank.length) {
      reviewDialog.close();
      return;
    }
    mainBackup = {
      order: [...order],
      index,
      correct,
      answered,
      streak,
    };
    order = [...new Set(wrongBank.map((w) => w.code))];
    index = 0;
    practiceWrong = true;
    render();
    save();
    reviewDialog.close();
    btnReturnMain.hidden = false;
  }

  function returnMain() {
    if (mainBackup) {
      ({ order, index, correct, answered, streak } = mainBackup);
      practiceWrong = false;
      render();
      save();
      mainBackup = null;
      btnReturnMain.hidden = true;
    }
  }

  /*** WIRE UP ***/
  btnSkip.onclick = skip;
  const resetDialog = qs('#resetDialog');
  const btnConfirmReset = qs('#btnConfirmReset');

  btnReset.onclick = () => {
    if (resetDialog) resetDialog.showModal();
  };

  if (btnConfirmReset) {
    btnConfirmReset.onclick = () => {
      resetDialog.close();
      resetAll();
    };
  }

  btnReview.onclick = openReview;
  btnCloseReview.onclick = () => reviewDialog.close();
  btnPracticeWrong.onclick = practiceWrongOn;
  btnReturnMain.onclick = returnMain;
  btnResume.onclick = () => {
    resumeDialog.close();
    render();
  };
  btnNewRun.onclick = () => {
    resumeDialog.close();
    resetAll();
  };

  /*** INIT ***/
  (async function init() {
    await fetchCountries();
    buildOrder();
    const saved = load();
    if (saved) {
      ({ order, index, correct, answered, streak, wrongBank, practiceWrong } =
        saved);
      resumeDialog.showModal();
    }
    app.hidden = false;
    render();
    save();
  })();
})();

/* MODERN, MINIMAL JS FOR RIPPLE + VISIBILITY + SMOOTH SCROLL
 */

(function () {
  const btn = document.getElementById('backToTopBtn');
  const rippleWrap = btn.querySelector('.ripple-wrap');
  const SHOW_AFTER = 200;
  const SCROLL_OPTIONS = { behavior: 'smooth' };

  function updateVisibility() {
    if (window.scrollY > SHOW_AFTER) {
      btn.classList.add('show');
      btn.setAttribute('aria-hidden', 'false');
    } else {
      btn.classList.remove('show');
      btn.setAttribute('aria-hidden', 'true');
    }
  }

  // CREATE A RIPPLE AT (X, Y) RELATIVE TO THE BUTTON
  function createRipple(x, y, opts = {}) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      btn.animate([{ opacity: 0.95 }, { opacity: 1 }], { duration: 120 });
      return;
    }

    const rect = btn.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;

    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.left = cx + 'px';
    r.style.top = cy + 'px';

    const s = document.createElement('span');
    s.className = 'ripple stroke';
    s.style.left = cx + 'px';
    s.style.top = cy + 'px';

    rippleWrap.appendChild(r);
    rippleWrap.appendChild(s);

    requestAnimationFrame(() => {
      const maxDim = Math.max(rect.width, rect.height) * 1.9;
      r.style.transform = `translate(-50%, -50%) scale(${maxDim / 12})`;
      r.style.opacity = '0';
      s.style.transform = `translate(-50%, -50%) scale(${maxDim / 14})`;
      s.style.opacity = '0';
    });

    setTimeout(() => {
      r.remove();
      s.remove();
    }, 600);
  }

  function handleClick(ev) {
    const x =
      ev && ev.clientX
        ? ev.clientX
        : btn.getBoundingClientRect().left + btn.offsetWidth / 2;
    const y =
      ev && ev.clientY
        ? ev.clientY
        : btn.getBoundingClientRect().top + btn.offsetHeight / 2;

    createRipple(x, y);

    window.scrollTo({ top: 0, left: 0, behavior: SCROLL_OPTIONS.behavior });
  }

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      const rect = btn.getBoundingClientRect();
      createRipple(rect.left + rect.width / 2, rect.top + rect.height / 2);
      window.scrollTo({ top: 0, left: 0, behavior: SCROLL_OPTIONS.behavior });
    }
  }

  function handlePointerDown(e) {
    if (
      e.pointerType &&
      e.pointerType !== 'mouse' &&
      e.pointerType !== 'pen' &&
      e.pointerType !== 'touch'
    )
      return;
    if (e.clientX && e.clientY) {
      createRipple(e.clientX, e.clientY);
    }
  }

  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('load', updateVisibility);
  btn.addEventListener('click', handleClick);
  btn.addEventListener('keydown', handleKey);
  btn.addEventListener('pointerdown', handlePointerDown);

  btn.tabIndex = 0;
  btn.setAttribute('role', 'button');

  updateVisibility();

  window.__backToTop_uninstall = function () {
    window.removeEventListener('scroll', updateVisibility);
    window.removeEventListener('load', updateVisibility);
    btn.removeEventListener('click', handleClick);
    btn.removeEventListener('keydown', handleKey);
    btn.removeEventListener('pointerdown', handlePointerDown);
  };
})();

// AUTO-SET FOOTER YEAR
document.getElementById('year').textContent = new Date().getFullYear();
