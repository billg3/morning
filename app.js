const els = {
  themeToggle: document.querySelector('#themeToggle'),
  zoomForm: document.querySelector('#zoomForm'),
  displayName: document.querySelector('#displayName'),
  meetingId: document.querySelector('#meetingId'),
  meetingPasscode: document.querySelector('#meetingPasscode'),
  meetingUrl: document.querySelector('#meetingUrl'),
  matchResult: document.querySelector('#matchResult'),
  saveProfile: document.querySelector('#saveProfile'),
  zoomStatus: document.querySelector('#zoomStatus'),
  startListening: document.querySelector('#startListening'),
  stopListening: document.querySelector('#stopListening'),
  clearTranscript: document.querySelector('#clearTranscript'),
  listenStatus: document.querySelector('#listenStatus'),
  transcript: document.querySelector('#transcript'),
  agentForm: document.querySelector('#agentForm'),
  agentInput: document.querySelector('#agentInput'),
  apiKey: document.querySelector('#apiKey'),
  agentFeed: document.querySelector('#agentFeed'),
  presenceForm: document.querySelector('#presenceForm'),
  presenceStatus: document.querySelector('#presenceStatus'),
  presenceFeed: document.querySelector('#presenceFeed'),
  messageTemplate: document.querySelector('#messageTemplate'),
};

const store = {
  profileKey: 'morning-profile-v1',
  themeKey: 'morning-theme-v1',
  transcript: [],
};

const presenceChannel = new BroadcastChannel('morning-presence');
let recognition;
let listening = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

init();

function init() {
  hydrateTheme();
  hydrateProfile();
  bindEvents();
  pushAgentMessage('Morning Agent', 'Welcome to morning 🌇. I can auto-match you into the right live video room.');
  broadcastPresence('joined the lounge.');
}

function bindEvents() {
  els.themeToggle.addEventListener('click', toggleTheme);
  els.zoomForm.addEventListener('submit', onZoomLaunch);
  els.saveProfile.addEventListener('click', saveProfile);
  els.startListening.addEventListener('click', startListening);
  els.stopListening.addEventListener('click', stopListening);
  els.clearTranscript.addEventListener('click', clearTranscript);
  els.agentForm.addEventListener('submit', onAgentAsk);
  els.presenceForm.addEventListener('submit', onPresenceUpdate);

  presenceChannel.onmessage = (event) => {
    const item = event.data;
    if (!item?.name || !item?.status) {
      return;
    }
    renderPresenceItem(item);
  };
}

function toggleTheme() {
  document.body.classList.toggle('day');
  const day = document.body.classList.contains('day');
  els.themeToggle.textContent = day ? 'Night Mode' : 'Day Mode';
  localStorage.setItem(store.themeKey, day ? 'day' : 'night');
}

function hydrateTheme() {
  const pref = localStorage.getItem(store.themeKey);
  if (pref === 'day') {
    document.body.classList.add('day');
    els.themeToggle.textContent = 'Night Mode';
  }
}

function hydrateProfile() {
  const profileRaw = localStorage.getItem(store.profileKey);
  if (!profileRaw) {
    return;
  }
  const profile = JSON.parse(profileRaw);
  els.displayName.value = profile.displayName ?? '';
  els.meetingId.value = profile.meetingId ?? '';
  els.meetingPasscode.value = profile.meetingPasscode ?? '';
  els.meetingUrl.value = profile.meetingUrl ?? '';
}

function saveProfile() {
  const profile = {
    displayName: els.displayName.value.trim(),
    meetingId: els.meetingId.value.trim(),
    meetingPasscode: els.meetingPasscode.value.trim(),
    meetingUrl: els.meetingUrl.value.trim(),
  };
  localStorage.setItem(store.profileKey, JSON.stringify(profile));
  els.zoomStatus.textContent = 'Profile saved locally.';
}

async function onZoomLaunch(event) {
  event.preventDefault();
  const displayName = els.displayName.value.trim();
  const meetingId = els.meetingId.value.trim();
  const goal = els.meetingPasscode.value.trim();
  const customUrl = els.meetingUrl.value.trim();

  if (!displayName || !meetingId) {
    els.zoomStatus.textContent = 'Display name and conversation vibe are required.';
    els.zoomStatus.classList.add('error');
    return;
  }

  const apiKey = els.apiKey.value.trim();
  const match = await selectBestRoom({
    vibe: meetingId,
    goal,
    transcript: store.transcript.slice(-8).join(' '),
    apiKey,
  });

  const roomUrl = customUrl || `https://meet.jit.si/${match.roomSlug}#userInfo.displayName="${encodeURIComponent(displayName)}"`;

  renderMatch(match, roomUrl);

  window.open(roomUrl, '_blank', 'noopener,noreferrer');
  els.zoomStatus.classList.remove('error');
  els.zoomStatus.textContent = `Auto-joining ${match.roomName} for ${displayName}.`;
  saveProfile();
  pushAgentMessage('Morning Agent', `Matched you to ${match.roomName}. Need a crisp opening line?`);
}

const roomCatalog = [
  {
    roomName: 'Morning Founders Floor',
    roomSlug: 'morning-founders-floor',
    tags: ['startup', 'founder', 'fundraise', 'venture', 'pitch', 'growth'],
    opener: 'Ask everyone: “What inflection point are you building toward this quarter?”',
  },
  {
    roomName: 'Morning Product Lab',
    roomSlug: 'morning-product-lab',
    tags: ['product', 'pm', 'design', 'ux', 'roadmap', 'launch'],
    opener: 'Try: “Which user behavior change would define success for your next release?”',
  },
  {
    roomName: 'Morning AI Builders Club',
    roomSlug: 'morning-ai-builders-club',
    tags: ['ai', 'agent', 'ml', 'automation', 'llm', 'model'],
    opener: 'Lead with: “Where does your AI create leverage that your competitors cannot copy?”',
  },
  {
    roomName: 'Morning NYC Creators Lounge',
    roomSlug: 'morning-nyc-creators-lounge',
    tags: ['new york', 'manhattan', 'brooklyn', 'creator', 'brand', 'media'],
    opener: 'Try: “Which NYC scene most shaped your brand voice this year?”',
  },
];

async function selectBestRoom({ vibe, goal, transcript, apiKey }) {
  if (apiKey) {
    const aiRoom = await requestAIRoomMatch({ vibe, goal, transcript, apiKey });
    if (aiRoom) {
      return aiRoom;
    }
  }

  const text = `${vibe} ${goal} ${transcript}`.toLowerCase();
  const scored = roomCatalog.map((room) => {
    const score = room.tags.reduce((sum, tag) => (text.includes(tag) ? sum + 1 : sum), 0);
    return { ...room, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const selected = scored[0].score > 0 ? scored[0] : roomCatalog[0];
  return { ...selected, reason: selected.score > 0 ? 'Keyword match from your vibe/goal.' : 'Best default room.' };
}

async function requestAIRoomMatch({ vibe, goal, transcript, apiKey }) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You assign users to a live networking room. Return JSON with keys roomName, roomSlug, reason, opener. roomSlug must be URL-safe.',
          },
          {
            role: 'user',
            content: `Vibe: ${vibe}\nGoal: ${goal || 'none'}\nTranscript: ${transcript || 'none'}`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.roomName || !parsed.roomSlug) {
      return null;
    }
    return {
      roomName: parsed.roomName,
      roomSlug: parsed.roomSlug.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
      reason: parsed.reason || 'AI selected this room based on your context.',
      opener: parsed.opener || 'Start by asking what outcome would make this call a win.',
    };
  } catch {
    return null;
  }
}

function renderMatch(match, roomUrl) {
  els.matchResult.innerHTML = '';
  const details = document.createElement('p');
  details.textContent = `Room: ${match.roomName}`;
  const reason = document.createElement('p');
  reason.textContent = `Reason: ${match.reason}`;
  const opener = document.createElement('p');
  opener.textContent = `Suggested opener: ${match.opener}`;
  const link = document.createElement('a');
  link.href = roomUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open matched video room';

  els.matchResult.append(details, reason, opener, link);
}

function startListening() {
  if (!SpeechRecognition) {
    els.listenStatus.textContent =
      'Live transcription unavailable in this browser. Try Chrome/Edge for SpeechRecognition support.';
    els.listenStatus.classList.add('error');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    listening = true;
    els.listenStatus.classList.remove('error');
    els.listenStatus.textContent = 'Listening…';
    els.startListening.disabled = true;
    els.stopListening.disabled = false;
  };

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    const text = result[0].transcript.trim();
    if (!text) {
      return;
    }

    if (result.isFinal) {
      addTranscriptLine(text);
      maybeAutoSuggest();
    }
  };

  recognition.onerror = (event) => {
    els.listenStatus.textContent = `Listening issue: ${event.error}`;
    els.listenStatus.classList.add('error');
  };

  recognition.onend = () => {
    if (listening) {
      recognition.start();
      return;
    }
    els.listenStatus.textContent = 'Microphone idle.';
    els.startListening.disabled = false;
    els.stopListening.disabled = true;
  };

  recognition.start();
}

function stopListening() {
  listening = false;
  if (recognition) {
    recognition.stop();
  }
}

function clearTranscript() {
  store.transcript = [];
  els.transcript.innerHTML = '';
  els.listenStatus.textContent = 'Transcript cleared.';
}

function addTranscriptLine(text) {
  store.transcript.push(text);
  const line = document.createElement('p');
  line.textContent = `• ${text}`;
  els.transcript.append(line);
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

function maybeAutoSuggest() {
  const joined = store.transcript.slice(-4).join(' ').toLowerCase();
  const recommendations = [];

  if (joined.includes('startup') || joined.includes('fund')) {
    recommendations.push('Ask: “What milestone matters most before your next fundraise?”');
  }
  if (joined.includes('new york') || joined.includes('manhattan') || joined.includes('brooklyn')) {
    recommendations.push('Try a local tie-in: “Which NYC neighborhood best matches your brand vibe?”');
  }
  if (joined.includes('ai') || joined.includes('agent') || joined.includes('automation')) {
    recommendations.push('Follow-up: “Where do you still want a human touch in your product?”');
  }

  if (recommendations.length) {
    pushAgentMessage('Auto Suggest', recommendations[recommendations.length - 1]);
  }
}

async function onAgentAsk(event) {
  event.preventDefault();
  const question = els.agentInput.value.trim();
  if (!question) {
    return;
  }

  pushAgentMessage('You', question);
  els.agentInput.value = '';

  const apiKey = els.apiKey.value.trim();
  if (apiKey) {
    const rich = await askOpenAI(question, apiKey);
    pushAgentMessage('Morning Agent', rich);
    return;
  }

  const fallback = buildLocalSuggestion(question);
  pushAgentMessage('Morning Agent', fallback);
}

function buildLocalSuggestion(question) {
  const context = store.transcript.slice(-5).join(' ');
  const prompts = [
    'You could ask: “What project are you most energized by this quarter?”',
    'Try: “Who should we introduce you to after this call?”',
    'Follow with: “What challenge would make this meeting a win for you?”',
  ];
  const pick = prompts[Math.floor(Math.random() * prompts.length)];
  const tail = context ? ` I also heard: “${context.slice(0, 120)}...”` : '';
  return `${pick}${tail}`;
}

async function askOpenAI(question, apiKey) {
  try {
    const transcript = store.transcript.slice(-8).join('\n') || 'No transcript yet.';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are Morning Agent, a Manhattan-style networking concierge that suggests concise, high-signal conversation moves for live video meetings.',
          },
          {
            role: 'user',
            content: `User question: ${question}\n\nRecent meeting transcript:\n${transcript}`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return `OpenAI request failed (${response.status}). Using local suggestions only.`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'No response returned by AI service.';
  } catch (error) {
    return `Could not reach OpenAI (${error.message}). Using local suggestions only.`;
  }
}

function pushAgentMessage(author, body) {
  const node = els.messageTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector('.msg-author').textContent = author;
  node.querySelector('.msg-time').textContent = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  node.querySelector('.msg-body').textContent = body;
  els.agentFeed.append(node);
  els.agentFeed.scrollTop = els.agentFeed.scrollHeight;
}

function onPresenceUpdate(event) {
  event.preventDefault();
  const status = els.presenceStatus.value.trim();
  if (!status) {
    return;
  }
  broadcastPresence(status);
  els.presenceStatus.value = '';
}

function broadcastPresence(status) {
  const name = els.displayName.value.trim() || 'Guest';
  const packet = {
    name,
    status,
    at: new Date().toISOString(),
  };
  renderPresenceItem(packet);
  presenceChannel.postMessage(packet);
}

function renderPresenceItem(item) {
  const wrap = document.createElement('p');
  const time = new Date(item.at || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  wrap.textContent = `${time} · ${item.name}: ${item.status}`;
  els.presenceFeed.prepend(wrap);
}
