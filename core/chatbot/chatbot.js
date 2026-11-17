import { escapeHtml } from '../utils/sanitize.js';

const CHAT_HISTORY_KEY = 'nortava-chat-history-v2';

let conversationHistory = [];
let isSending = false;

export function initChatbot() {
  createChatbotUI();
  setupChatbotEvents();
  loadChatHistory();
}

function getPageContext() {
  const path = window.location.pathname || '/';
  const params = new URLSearchParams(window.location.search);
  const listingId = path.includes('listing.html') ? params.get('id') || '' : '';
  return { path, listingId };
}

function getContextualPrompts() {
  const { path, listingId } = getPageContext();
  if (path.includes('listing.html') && listingId && listingId !== 'sample') {
    return [
      { label: 'Is this price fair?', message: 'Based on local Zimbabwe rental rates, is this property priced fairly and what should I check?' },
      { label: 'ZIM lease & safety check', message: 'What Zimbabwean tenancy laws and ownership checks should I verify before paying rent or a deposit?' },
      { label: 'How $2.50 unlock works', message: 'How does the $2.50 one-time contact unlock work?' },
      { label: 'How landlords are verified', message: 'How does Nortava verify landlords and Title Deeds to prevent scammers?' }
    ];
  }
  return [
    { label: '3 bed in Knowe < $450', message: 'Find me a 3 bedroom house to rent in Knowe, Norton under $450 with water available.' },
    { label: '2 bed flat in Harare', message: 'Search for a 2 bedroom property to rent in Harare with electricity and parking.' },
    { label: 'Title Deed verification', message: 'How does Nortava verify landlords with Title Deeds and National IDs?' },
    { label: 'ZIM tenant rights', message: 'What are my rights and safety steps under Zimbabwean rental and property laws?' }
  ];
}

function createChatbotUI() {
  if (document.querySelector('.chatbot-button')) return;

  const prompts = getContextualPrompts();
  const quickRepliesHTML = prompts
    .map(p => `<button type="button" class="quick-reply" data-message="${escapeHtml(p.message)}">${escapeHtml(p.label)}</button>`)
    .join('');

  const chatbotHTML = `
    <button type="button" class="chatbot-button" aria-label="Open Nortava AI Property Assistant">
      <i class="ri-sparkling-2-fill"></i>
    </button>
    <div class="chatbot-container" role="dialog" aria-label="Tariro Nortava AI Property Assistant">
      <div class="chatbot-header">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 40px; height: 40px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary);">
            <i class="ri-robot-2-fill" style="font-size: 1.4rem;"></i>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1rem;">Tariro · Nortava AI</h3>
            <span style="font-size: 0.75rem; opacity: 0.9; display: flex; align-items: center; gap: 4px;">
              <span style="width: 6px; height: 6px; background: #4ade80; border-radius: 50%;"></span> Zimbabwe Property &amp; Law Finder
            </span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.35rem;">
          <button type="button" class="chatbot-clear" id="chatClearBtn" title="New conversation" aria-label="Clear chat history" style="background: rgba(255,255,255,0.16); color: white; border: none; border-radius: 8px; padding: 0.35rem 0.55rem; font-size: 0.78rem; cursor: pointer;">
            <i class="ri-refresh-line"></i>
          </button>
          <button type="button" class="chatbot-close" aria-label="Close chat"><i class="ri-close-line"></i></button>
        </div>
      </div>
      <div class="chatbot-messages" id="chatMessages">
        <div class="chat-message bot">
          Hello! I'm <strong>Tariro</strong>, your Nortava AI Property Finder across all 10 Provinces of Zimbabwe. Tell me the area and conditions you want (e.g., <em>"3 bed house in Knowe under $450 with water"</em> or <em>"2 bed flat in Avondale Harare"</em>), or ask about landlord Title Deed checks and Zimbabwean tenancy law.
        </div>
      </div>
      <div class="quick-replies">
        ${quickRepliesHTML}
      </div>
      <div class="chatbot-input">
        <input type="text" placeholder="Describe area, bedrooms, budget, or ask ZIM laws..." id="chatInput" maxlength="1000">
        <button type="button" id="chatSend" aria-label="Send message"><i class="ri-send-plane-fill"></i></button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', chatbotHTML);
}

function setupChatbotEvents() {
  const chatButton = document.querySelector('.chatbot-button');
  const chatContainer = document.querySelector('.chatbot-container');
  const closeButton = document.querySelector('.chatbot-close');
  const clearButton = document.getElementById('chatClearBtn');
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('chatSend');
  const quickReplies = document.querySelectorAll('.quick-reply');

  chatButton?.addEventListener('click', () => {
    chatContainer.classList.toggle('active');
    if (chatContainer.classList.contains('active')) {
      chatInput?.focus();
    }
  });

  closeButton?.addEventListener('click', () => {
    chatContainer.classList.remove('active');
  });

  clearButton?.addEventListener('click', () => {
    conversationHistory = [];
    try {
      sessionStorage.removeItem(CHAT_HISTORY_KEY);
    } catch {
      // Ignore
    }
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="chat-message bot">
          Started a fresh conversation. Tell me which Zimbabwe area, budget, and property features you're looking for!
        </div>
      `;
    }
  });

  sendButton?.addEventListener('click', () => sendMessage());
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  quickReplies.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isSending) return;
      if (chatInput) {
        chatInput.value = btn.dataset.message || '';
      }
      sendMessage();
    });
  });
}

function formatBotTextSafely(rawText) {
  const escaped = escapeHtml(rawText || '');

  // Convert **bold** cleanly on already-escaped text
  let html = escaped.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  // Turn internal relative paths including filtered /listings.html?... & /listing.html?id=... into safe clickable links
  html = html.replace(
    /(^|[\s(>])(\/(?:listing\.html\?id=[A-Za-z0-9_-]+|listings\.html(?:\?[A-Za-z0-9_=&%+.+-]+)?|safety\.html|report\.html|contact\.html|faq\.html|how-it-works\.html|about\.html|auth\/(?:login|register)\.html|dashboard\/landlord-add\.html|legal\/(?:terms|privacy|cookies|dmca)\.html))/g,
    (_, prefix, safePath) => `${prefix}<a href="${safePath}" style="color: var(--primary); text-decoration: underline; font-weight: 500;">${safePath}</a>`
  );

  // Preserve clean line breaks
  return html.replace(/\n/g, '<br>');
}

function appendMessageElement(text, sender, { isError = false, retryMessage = '' } = {}) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return null;

  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;
  messageDiv.style.display = 'block';
  messageDiv.style.visibility = 'visible';
  messageDiv.style.opacity = '1';

  if (sender === 'user') {
    messageDiv.textContent = text;
  } else {
    messageDiv.innerHTML = formatBotTextSafely(text);
    if (isError) {
      messageDiv.style.borderLeft = '3px solid var(--danger)';
      if (retryMessage) {
        const retryWrap = document.createElement('div');
        retryWrap.style.marginTop = '0.5rem';
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'btn btn-sm btn-outline';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', () => {
          messageDiv.remove();
          sendMessage(retryMessage, { skipUserEcho: true });
        });
        retryWrap.appendChild(retryBtn);
        messageDiv.appendChild(retryWrap);
      }
    }
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return messageDiv;
}

function showTypingIndicator() {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return null;
  const indicator = document.createElement('div');
  indicator.id = 'chatTypingIndicator';
  indicator.className = 'chat-message bot';
  indicator.style.opacity = '0.8';
  indicator.innerHTML = '<i class="ri-sparkling-line"></i> Thinking...';
  messagesContainer.appendChild(indicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return indicator;
}

async function sendMessage(overrideText = null, { skipUserEcho = false } = {}) {
  if (isSending) return;
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('chatSend');
  const message = (overrideText ?? chatInput?.value ?? '').trim();

  if (!message) return;

  isSending = true;
  if (sendButton) sendButton.disabled = true;

  if (!skipUserEcho) {
    appendMessageElement(message, 'user');
    if (chatInput) chatInput.value = '';
  }

  const typingEl = showTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: conversationHistory.slice(-10),
        context: getPageContext()
      })
    });

    const payload = await res.json().catch(() => ({}));
    typingEl?.remove();

    if (!res.ok || !payload.reply) {
      appendMessageElement(
        payload.error || 'Unable to reach Nortava AI right now. Please try again.',
        'bot',
        { isError: true, retryMessage: message }
      );
      return;
    }

    conversationHistory.push({ role: 'user', text: message });
    conversationHistory.push({ role: 'model', text: payload.reply });
    conversationHistory = conversationHistory.slice(-12);

    appendMessageElement(payload.reply, 'bot');
    saveChatHistory();
  } catch {
    typingEl?.remove();
    appendMessageElement(
      'Network connection interrupted while reaching Nortava AI. Please retry.',
      'bot',
      { isError: true, retryMessage: message }
    );
  } finally {
    isSending = false;
    if (sendButton) sendButton.disabled = false;
    chatInput?.focus();
  }
}

function saveChatHistory() {
  try {
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(conversationHistory.slice(-12)));
  } catch {
    // Ignore storage error
  }
}

function loadChatHistory() {
  try {
    const raw = sessionStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length === 0) return;

    conversationHistory = saved.slice(-12);
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';
    conversationHistory.forEach(item => {
      if (item.role === 'user' || item.role === 'model') {
        appendMessageElement(item.text, item.role === 'user' ? 'user' : 'bot');
      }
    });
  } catch {
    conversationHistory = [];
  }
}

export async function getChatbotResponse(message) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: [], context: getPageContext() })
  });
  const payload = await res.json().catch(() => ({}));
  return payload.reply || payload.error || 'Unavailable';
}
