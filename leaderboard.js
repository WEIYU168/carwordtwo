(() => {
  const form = document.querySelector('#lb-form');
  const nameInput = document.querySelector('#lb-name');
  const submit = form.querySelector('button');
  const status = document.querySelector('#lb-status');
  const scope = document.querySelector('#lb-scope');
  const rows = document.querySelector('#lb-rows');
  const local = location.protocol === 'file:' || location.hostname === 'weiyu168.github.io';
  const storageKey = 'carwordtwo-racers-v1';
  const endpoint = '/api/leaderboard';
  const number = new Intl.NumberFormat('zh-TW');
  let round = null;

  function readLocal() {
    const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(data) ? data : [];
  }

  function saveLocal(entry) {
    const racers = readLocal();
    const key = entry.name.normalize('NFKC').toLowerCase();
    const previous = racers.find(racer => racer.key === key);
    const improved = !previous || entry.score > previous.score;
    if (improved) {
      const next = racers.filter(racer => racer.key !== key);
      next.push({ ...entry, key, achievedAt: Date.now() });
      next.sort((a, b) => b.score - a.score || a.achievedAt - b.achievedAt);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return { entries: next.slice(0, 8), improved };
    }
    return { entries: racers.slice(0, 8), improved };
  }

  function render(entries, highlight) {
    rows.replaceChildren();
    for (let rank = 1; rank <= 8; rank++) {
      const entry = entries[rank - 1];
      const row = rows.insertRow();
      const badge = document.createElement('span');
      badge.className = 'lb-position';
      badge.textContent = String(rank).padStart(2, '0');
      row.insertCell().append(badge);
      row.insertCell().textContent = entry?.name ?? '空席';
      row.insertCell().textContent = entry ? number.format(entry.score) : '—';
      row.classList.toggle('lb-empty', !entry);
      if (entry && entry.name === highlight) row.classList.add('lb-highlight');
    }
  }

  async function requestBoard(options = {}) {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(8000),
      ...options,
    });
    if (!response.ok) throw new Error('Leaderboard unavailable');
    return response.json();
  }

  window.openRaceLeaderboard = async score => {
    const current = { score, submitted: false };
    round = current;
    nameInput.disabled = submit.disabled = false;
    form.reset();
    scope.textContent = local ? '本機排名' : '全站排名';
    status.textContent = local ? '' : '正在載入排名…';
    render([]);
    try {
      const entries = local ? readLocal().slice(0, 8) : (await requestBoard()).entries;
      if (round === current && !current.submitted) {
        render(entries);
        if (!submit.disabled) status.textContent = '';
      }
    } catch {
      if (round === current && !submit.disabled && !current.submitted) {
        status.textContent = '暫時讀不到排名，仍可嘗試登錄成績。';
      }
    }
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const current = round;
    if (!current || submit.disabled) return;
    const name = nameInput.value.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!name || /\p{C}/u.test(name)) {
      status.textContent = '請輸入有效的車手姓名或暱稱。';
      nameInput.focus();
      return;
    }
    nameInput.disabled = submit.disabled = true;
    status.textContent = '正在登錄…';
    try {
      const entry = { name, score: current.score };
      const result = local ? saveLocal(entry) : await requestBoard({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (round !== current) return;
      current.submitted = true;
      render(result.entries, name);
      status.textContent = result.improved
        ? '已登錄最高分。'
        : '已保留這位車手原有的最高分。';
    } catch {
      if (round !== current) return;
      status.textContent = '登錄失敗，請再試一次。';
      nameInput.disabled = submit.disabled = false;
    }
  });
})();
