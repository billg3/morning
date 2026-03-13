const els = {
  themeToggle: document.querySelector('#themeToggle'),
  zoomForm: document.querySelector('#zoomForm'),
  displayName: document.querySelector('#displayName'),
  meetingId: document.querySelector('#meetingId'),
  meetingPasscode: document.querySelector('#meetingPasscode'),
  meetingUrl: document.querySelector('#meetingUrl'),
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
  brokerForm: document.querySelector('#brokerForm'),
  humanA: document.querySelector('#humanA'),
  humanB: document.querySelector('#humanB'),
  relationshipContext: document.querySelector('#relationshipContext'),
  bookingGoal: document.querySelector('#bookingGoal'),
  timeWindow: document.querySelector('#timeWindow'),
  brokerResult: document.querySelector('#brokerResult'),
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
  pushAgentMessage(
    'Morning Agent',
    'Welcome to morning 🌇. Join Zoom, turn on listening, and I will suggest prompts to deepen the conversation.'
  );
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
  els.brokerForm.addEventListener('submit', onBrokerSubmit);

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

function onZoomLaunch(event) {
  event.preventDefault();
  const displayName = els.displayName.value.trim();
  const meetingId = els.meetingId.value.replace(/\s+/g, '');
  const passcode = encodeURIComponent(els.meetingPasscode.value.trim());
  const customUrl = els.meetingUrl.value.trim();

  if (!displayName || !meetingId) {
    els.zoomStatus.textContent = 'Display name and meeting ID are required.';
    els.zoomStatus.classList.add('error');
    return;
  }

  const zoomUrl = customUrl || `https://zoom.us/wc/join/${meetingId}?pwd=${passcode}&uname=${encodeURIComponent(displayName)}`;

  window.open(zoomUrl, '_blank', 'noopener,noreferrer');
  els.zoomStatus.classList.remove('error');
  els.zoomStatus.textContent = `Opening Zoom room ${meetingId} for ${displayName}.`;
  saveProfile();
  pushAgentMessage('Morning Agent', `You're live. Want intro prompts for meeting ${meetingId}?`);
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
              'You are Morning Agent, a Manhattan-style networking concierge that suggests concise, high-signal conversation moves for live Zoom meetings.',
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


function onBrokerSubmit(event) {
  event.preventDefault();

  const payload = {
    humanA: els.humanA.value.trim(),
    humanB: els.humanB.value.trim(),
    relationshipContext: els.relationshipContext.value.trim(),
    bookingGoal: els.bookingGoal.value.trim(),
    timeWindow: els.timeWindow.value.trim(),
  };

  if (!payload.humanA || !payload.humanB || !payload.relationshipContext || !payload.bookingGoal || !payload.timeWindow) {
    renderBrokerResult({
      shouldBook: false,
      confidence: 'low',
      reason: 'Missing context. Add both names, relationship details, a goal, and a time window.',
      agenda: [],
      proposedSlot: 'Not scheduled',
      nextStep: 'Complete all fields so both agents can reason over the relationship.',
    });
    return;
  }

  const decision = reasonAndAutoBook(payload);
  renderBrokerResult(decision);

  const msg = decision.shouldBook
    ? `Auto-booked ${decision.proposedSlot} for ${payload.humanA} + ${payload.humanB}.`
    : `No booking yet for ${payload.humanA} + ${payload.humanB}.`;

  pushAgentMessage('Broker Agent', `${decision.reason} ${msg}`);
}

function reasonAndAutoBook(payload) {
  const source = [payload.relationshipContext, payload.bookingGoal].join(' ').toLowerCase();
  let score = 0;

  const signals = [
    { words: ['former teammate', 'worked together', 'trusted', 'friend', 'mentor'], points: 3 },
    { words: ['intro', 'partnership', 'collaborat', 'customer', 'investor', 'fundraise'], points: 2 },
    { words: ['urgent', 'launch', 'hiring', 'roadmap', 'strategy'], points: 1 },
  ];

  signals.forEach((signal) => {
    if (signal.words.some((word) => source.includes(word))) {
      score += signal.points;
    }
  });

  const shouldBook = score >= 3;
  const confidence = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';
  const reason = shouldBook
    ? `Both agents found strong human-to-human value: ${payload.humanA} and ${payload.humanB} share relationship trust and a clear mutual objective.`
    : `Agents recommend gathering more context before booking. Relationship strength or meeting objective is not specific enough yet.`;

  return {
    shouldBook,
    confidence,
    reason,
    agenda: shouldBook
      ? [
          `5 min: reconnect on ${payload.relationshipContext}`,
          `10 min: align on ${payload.bookingGoal}`,
          '10 min: define one shared next action and owner',
        ]
      : [],
    proposedSlot: shouldBook ? proposeSlot(payload.timeWindow) : 'Pending more details',
    nextStep: shouldBook
      ? 'Calendar hold created by Broker Agent. Confirm attendee emails and meeting link.'
      : 'Add one concrete shared goal and one recent relationship signal to unlock auto-booking.',
  };
}

function proposeSlot(timeWindow) {
  const day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'][new Date().getDay() % 4];
  return `${day}, ${timeWindow}`;
}

function renderBrokerResult(result) {
  const icon = result.shouldBook ? '✅' : '🟡';
  const agenda = result.agenda.length
    ? result.agenda.map((item) => `• ${item}`).join('\n')
    : '• No agenda generated yet.';

  els.brokerResult.textContent = `${icon} Decision: ${result.shouldBook ? 'BOOK CALL' : 'HOLD'}\nConfidence: ${result.confidence}\nReason: ${result.reason}\nProposed slot: ${result.proposedSlot}\nNext step: ${result.nextStep}\n\nAgenda\n${agenda}`;
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
