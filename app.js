const els = {
  themeToggle: document.querySelector('#themeToggle'),
  contextForm: document.querySelector('#contextForm'),
  contextStatus: document.querySelector('#contextStatus'),
  icp: document.querySelector('#icp'),
  offer: document.querySelector('#offer'),
  acv: document.querySelector('#acv'),
  motion: document.querySelector('#motion'),
  outreachForm: document.querySelector('#outreachForm'),
  leadName: document.querySelector('#leadName'),
  company: document.querySelector('#company'),
  pain: document.querySelector('#pain'),
  signal: document.querySelector('#signal'),
  outreachOutput: document.querySelector('#outreachOutput'),
  scoreForm: document.querySelector('#scoreForm'),
  scoreOutput: document.querySelector('#scoreOutput'),
  intelForm: document.querySelector('#intelForm'),
  zoominfo: document.querySelector('#zoominfo'),
  salesnav: document.querySelector('#salesnav'),
  intent: document.querySelector('#intent'),
  web: document.querySelector('#web'),
  sfdcFile: document.querySelector('#sfdcFile'),
  intelOutput: document.querySelector('#intelOutput'),
};

const store = {
  themeKey: 'aerie-theme-v1',
  context: null,
};

init();

async function init() {
  hydrateTheme();
  bindEvents();
  await hydrateContextFromApi();
}

function bindEvents() {
  els.themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem(store.themeKey, document.body.classList.contains('light') ? 'light' : 'dark');
  });

  els.contextForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const context = {
      icp: els.icp.value.trim(),
      offer: els.offer.value.trim(),
      acv: Number(els.acv.value || 0),
      motion: els.motion.value,
    };

    const response = await api('/api/context', { method: 'POST', body: { context } });
    store.context = response.context;
    els.contextStatus.textContent = `Context saved for ${store.context.icp} | ${store.context.motion}`;
  });

  els.outreachForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.outreachOutput.textContent = 'Generating outreach...';

    const response = await api('/api/outreach', {
      method: 'POST',
      body: {
        context: withDefaultContext(),
        leadName: els.leadName.value.trim(),
        company: els.company.value.trim(),
        pain: els.pain.value.trim(),
        signal: els.signal.value.trim(),
      },
    });

    els.outreachOutput.textContent = response.sequence;
  });

  els.scoreForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.scoreOutput.textContent = 'Calculating score...';

    const response = await api('/api/score', {
      method: 'POST',
      body: {
        problem: Number(document.querySelector('#problem').value),
        persona: Number(document.querySelector('#persona').value),
        differentiation: Number(document.querySelector('#differentiation').value),
        winloss: Number(document.querySelector('#winloss').value),
        gtm: Number(document.querySelector('#gtm').value),
      },
    });

    els.scoreOutput.textContent = `Pragmatic Business Score: ${response.score}/100\nReadiness tier: ${response.tier}\nRecommendation: ${response.recommendation}`;
  });

  els.intelForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.intelOutput.textContent = 'Running cross-platform analysis...';

    const csvText = await readFileText(els.sfdcFile.files[0]);
    const response = await api('/api/intel', {
      method: 'POST',
      body: {
        context: withDefaultContext(),
        zoominfo: els.zoominfo.value.trim(),
        salesnav: els.salesnav.value.trim(),
        intent: els.intent.value.trim(),
        web: els.web.value.trim(),
        csvText,
      },
    });

    els.intelOutput.textContent = response.findings;
  });
}

function withDefaultContext() {
  return (
    store.context || {
      icp: 'B2B revenue leaders',
      offer: 'AI-powered revenue workflow platform',
      acv: 0,
      motion: 'Outbound-led',
    }
  );
}

function hydrateTheme() {
  if (localStorage.getItem(store.themeKey) === 'light') {
    document.body.classList.add('light');
  }
}

async function hydrateContextFromApi() {
  try {
    const response = await api('/api/context');
    if (!response.context) {
      return;
    }

    store.context = response.context;
    els.icp.value = response.context.icp || '';
    els.offer.value = response.context.offer || '';
    els.acv.value = response.context.acv || '';
    els.motion.value = response.context.motion || 'Outbound-led';
    els.contextStatus.textContent = `Context loaded for ${response.context.icp}`;
  } catch {
    els.contextStatus.textContent = 'Backend unavailable; enter context and retry.';
  }
}

async function readFileText(file) {
  if (!file) {
    return '';
  }
  return file.text();
}

async function api(url, options = {}) {
  const request = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (options.body) {
    request.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, request);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}
