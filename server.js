const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const CONTEXT_PATH = path.join(ROOT, '.aerie-context.json');

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function loadContext() {
  try {
    return JSON.parse(fs.readFileSync(CONTEXT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveContext(context) {
  fs.writeFileSync(CONTEXT_PATH, JSON.stringify(context, null, 2));
}

function withDefaultContext(context) {
  return context || {
    icp: 'B2B revenue leaders',
    offer: 'AI-powered revenue workflow platform',
    acv: 0,
    motion: 'Outbound-led',
  };
}

function generateOutreach({ context, leadName, company, pain, signal }) {
  const c = withDefaultContext(context);
  const safeSignal = (signal || 'No intent signal provided').toLowerCase();
  const safePain = (pain || 'pipeline conversion gaps').toLowerCase();

  return [
    `Email 1 (Problem-led):\nSubject: ${company} x ${c.offer}\nHi ${leadName}, noticed ${safeSignal}. Teams like ${c.icp} often struggle with ${safePain}. We help improve this with ${c.offer}. Open to a 15-minute teardown?`,
    `LinkedIn DM:\n${leadName}, quick idea: if ${company} is prioritizing ${safePain}, we can benchmark your workflow against top performers and map a next-step plan in one call.`,
    `Email 2 (Value + CTA):\nGiven your ${String(c.motion).toLowerCase()} motion and roughly $${c.acv || 'N/A'} ACV targets, I can share a mini playbook for faster pipeline conversion. Worth sending?`,
  ].join('\n\n');
}

function calculateScore(input) {
  const weights = {
    problem: 0.25,
    persona: 0.2,
    differentiation: 0.2,
    winloss: 0.15,
    gtm: 0.2,
  };

  const total =
    Number(input.problem || 0) * weights.problem +
    Number(input.persona || 0) * weights.persona +
    Number(input.differentiation || 0) * weights.differentiation +
    Number(input.winloss || 0) * weights.winloss +
    Number(input.gtm || 0) * weights.gtm;

  const score = Number((total * 10).toFixed(1));
  let tier = 'Scale-ready';
  let recommendation = 'Double down on segmentation and multi-threaded enterprise plays.';

  if (total < 5) {
    tier = 'Foundation risk';
    recommendation = 'Refine market problem evidence and tighten persona definitions before scaling spend.';
  } else if (total < 7.5) {
    tier = 'Developing';
    recommendation = 'Prioritize win/loss interviews and package clearer differentiation for outbound messaging.';
  }

  return { score, tier, recommendation };
}

function parseCsvSummary(csvText) {
  if (!csvText) {
    return 'No SFDC CSV uploaded.';
  }
  const rows = String(csvText)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    return 'Uploaded CSV did not include data rows.';
  }

  const headers = rows[0].split(',').map((h) => h.trim());
  return `Parsed ${rows.length - 1} SFDC records with fields: ${headers.slice(0, 6).join(', ')}.`;
}

function findIntersection(text) {
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4);

  const map = new Map();
  for (const word of words) {
    map.set(word, (map.get(word) || 0) + 1);
  }

  return [...map.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
    .join(', ');
}

function buildAgentInsight({ zoominfo, salesnav, intent, web, context }) {
  const snippets = [zoominfo, salesnav, web].filter(Boolean).join(' ');
  const trigger = snippets.toLowerCase();
  const c = withDefaultContext(context);

  if (trigger.includes('hiring') || trigger.includes('fund')) {
    return `Expansion signal detected. Position ${c.offer} as a way to onboard reps faster and protect conversion quality during growth.`;
  }
  if (trigger.includes('launch') || trigger.includes('new product')) {
    return 'Product-change signal detected. Lead with a campaign focused on accelerating message-market fit for the new motion.';
  }
  if (intent) {
    return `Intent detected around ${intent}. Build account plans with pain-specific discovery questions and multi-thread outreach.`;
  }
  return 'Not enough external signal yet; gather one more intent data point before outreach.';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/context') {
      json(res, 200, { context: loadContext() });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/context') {
      const body = await readBody(req);
      saveContext(body.context || null);
      json(res, 200, { ok: true, context: body.context || null });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/outreach') {
      const body = await readBody(req);
      const sequence = generateOutreach(body);
      json(res, 200, { sequence });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/score') {
      const body = await readBody(req);
      json(res, 200, calculateScore(body));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/intel') {
      const body = await readBody(req);
      const context = withDefaultContext(body.context);
      const csvSummary = parseCsvSummary(body.csvText);
      const intersection = findIntersection([body.zoominfo, body.salesnav, body.intent, body.web, csvSummary].join(' '));
      const insight = buildAgentInsight({
        zoominfo: body.zoominfo,
        salesnav: body.salesnav,
        intent: body.intent,
        web: body.web,
        context,
      });

      const findings = [
        `Matched themes: ${intersection || 'No repeated terms found.'}`,
        `Agent insight: ${insight}`,
        `SFDC intelligence: ${csvSummary}`,
        `Next action: Launch a 5-touch sequence to ${context.icp} using ${context.offer}, prioritizing accounts with intent around "${body.intent || 'your core category'}".`,
      ].join('\n\n');

      json(res, 200, { findings });
      return;
    }

    const rawPath = req.url === '/' ? '/index.html' : req.url;
    const safePath = path.normalize(rawPath).replace(/^\.+/, '');
    const filePath = path.join(ROOT, safePath);

    if (!filePath.startsWith(ROOT)) {
      json(res, 403, { error: 'Forbidden' });
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      json(res, 404, { error: 'Not Found' });
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    json(res, 400, { error: error.message || 'Request failed' });
  }
});

server.listen(PORT, () => {
  console.log(`Aerie Revenue Machine listening on http://0.0.0.0:${PORT}`);
});
