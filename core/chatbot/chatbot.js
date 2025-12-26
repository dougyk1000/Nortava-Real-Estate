const CHATBOT_RESPONSES = {
  greetings: {
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
    responses: [
      "Hello! Welcome to Nortava. I'm here to help you find your perfect property in Norton, Zimbabwe. How can I assist you today?",
      "Hi there! Looking for a place to rent or buy in Norton? I'm here to guide you through the process.",
      "Welcome to Nortava! Whether you're a tenant looking for a home or a landlord wanting to list your property, I can help. What would you like to know?"
    ]
  },
  howItWorks: {
    patterns: ['how does it work', 'how to use', 'explain', 'how does nortava work', 'help me understand'],
    responses: [
      "Here's how Nortava works:\n\n1. Browse available listings in Norton for free\n2. When you find a property you like, pay a small $2.50 unlock fee\n3. Get instant access to the landlord's contact details\n4. Reach out directly to arrange viewings\n\nLandlords can list properties completely free!"
    ]
  },
  payments: {
    patterns: ['payment', 'pay', 'ecocash', 'onemoney', 'mukuru', 'innbucks', 'how to pay', 'cost', 'price', 'fee'],
    responses: [
      "Nortava accepts local payment methods:\n\n- EcoCash\n- OneMoney\n- Mukuru\n- InnBucks\n\nThe unlock fee is just $2.50 per property. Once you pay, you'll have permanent access to that landlord's contact details.",
      "Paying is simple and secure. Choose your preferred method, follow the payment instructions on the listing, and your contact access is immediate!"
    ]
  },
  listings: {
    patterns: ['listing', 'property', 'properties', 'house', 'apartment', 'room', 'find', 'search', 'browse', 'available'],
    responses: [
      "I can help you find exactly what you're looking for! We have listings across Norton—from Katanga to the Crescent. Are you looking for a full house, a cottage, or maybe just a room?",
      "To find your next home: \n1. Head to the 'Browse' page\n2. Filter by your budget (rent usually starts around $100 for rooms)\n3. Look for the 'Verified' badge for extra safety.\nWhat area of Norton do you prefer?",
      "Finding a place in Norton is easy with Nortava! Pro tip: our listings update in real-time. If you find a place you like, unlock it quickly before someone else does!"
    ]
  },
  nortonInfo: {
    patterns: ['about norton', 'places in norton', 'schools', 'shops', 'amenities', 'hospital', 'police'],
    responses: [
      "Norton is a thriving town! If you're looking for convenience, Katanga has the best local markets. For a quieter residential feel, check out the Crescent or Twin Lakes areas.",
      "Moving with family? Norton has great schools like Norton Development Council Primary and several secondary options. Most residential areas have good access to local clinics and the main police station near the highway.",
      "Shopping in Norton is great! You have the main shopping centers along the Bulawayo road, plus Katanga's vibrant market. Most areas are well-connected by local transport (kombis)."
    ]
  },
  landlordValue: {
    patterns: ['why list', 'is it really free', 'benefits for landlords', 'how much can i earn'],
    responses: [
      "Listing is 100% free! You don't pay us a cent to post. You benefit from:\n- Targeted Norton audience\n- Automated tenant notifications\n- Fraud protection through verification\n- Analytics to see how many people are viewing your home.",
      "Maximize your earnings by getting Verified! Verified landlords get 3x more unlocks because tenants trust them more. It's a simple process to build your reputation in Norton."
    ]
  },
  tenantValue: {
    patterns: ['why pay', 'is it worth $2.50', 'value for tenants', 'contact fee'],
    responses: [
      "The $2.50 fee helps us keep the platform clean of fake listings and scams. For less than the price of a lunch, you get direct, verified access to landlords, saving you time and transport money on 'viewing' fake places.",
      "Think of it as an investment in safety. We verify landlords so you don't have to worry about meeting 'agents' who don't actually own the property."
    ]
  },
  landlord: {
    patterns: ['landlord', 'post listing', 'list property', 'add property', 'sell', 'rent out'],
    responses: [
      "As a landlord on Nortava:\n\n1. Register for a free account as 'Landlord'\n2. Go to your dashboard\n3. Click 'Add Listing' and fill in property details\n4. Upload up to 3 photos\n5. Your listing goes live immediately!\n\nListing is completely free. You earn when tenants pay to unlock your contact.",
      "Pro tip: Provide clear property descriptions and quality photos to attract tenants quickly. Respond promptly to inquiries to maintain trust."
    ]
  },
  tenant: {
    patterns: ['tenant', 'renter', 'looking for', 'need a place', 'find a home'],
    responses: [
      "Welcome, tenant! Here's your journey:\n\n1. Create a free account\n2. Browse all available properties\n3. Save listings you like\n4. Pay $2.50 to unlock landlord contacts\n5. Reach out directly to schedule viewings\n\nAll your unlocked contacts are saved in your dashboard forever!",
      "Always double-check property details and photos before paying. Use saved listings to compare options and make the best choice for you."
    ]
  },
  safety: {
    patterns: ['safe', 'safety', 'scam', 'fraud', 'trust', 'secure', 'verify'],
    responses: [
      "Your safety matters! Tips:\n\n- Always view properties before paying rent\n- Meet landlords in public places first\n- Never send deposits without seeing the property\n- Report suspicious listings using our Report feature\n- Look for verified landlords (blue badge)\n\nWe verify landlords to ensure authenticity.",
      "Remember: Nortava verifies listings and landlords. Trust only verified profiles and report anything suspicious immediately."
    ]
  },
  account: {
    patterns: ['account', 'register', 'sign up', 'login', 'password', 'forgot'],
    responses: [
      "Account help:\n\n- Register: Click 'Get Started' and choose your role\n- Login: Use your email and password\n- Forgot password: Use the reset link on the login page\n- Profile: Update your details in the dashboard\n\nNeed more help? Contact us via WhatsApp!"
    ]
  },
  contact: {
    patterns: ['contact', 'support', 'help', 'whatsapp', 'email', 'reach'],
    responses: [
      "Get in touch with us:\n\n- WhatsApp: Available on our Contact page\n- Email: Support team responds within 24 hours\n- Report issues: Use the Report feature for listing problems\n\nWe're here to help make your property search smooth!"
    ]
  },
  norton: {
    patterns: ['norton', 'zimbabwe', 'location', 'area', 'where'],
    responses: [
      "Nortava is specifically built for Norton, Zimbabwe! We focus on areas like Katanga, Crescent, and Twin Lakes. We know Norton because we're local!",
      "Looking for a place in Norton? We cover all residential zones. Katanga is great for convenience, while the Crescent offers a quieter feel. What area interests you?"
    ]
  },
  nortonInfo: {
    patterns: ['schools', 'shops', 'amenities', 'hospital', 'police'],
    responses: [
      "Norton has great amenities! You'll find schools like Norton Development Council Primary, vibrant markets in Katanga, and essential services like the main police station near the highway.",
      "Most residential areas in Norton have good access to local clinics and shopping centers along the Bulawayo road. It's a well-connected community!"
    ]
  },
  landlordValue: {
    patterns: ['why list', 'benefits for landlords'],
    responses: [
      "Listing is 100% free! Benefit from a targeted Norton audience, automated notifications, and fraud protection. Plus, see exactly how many people are viewing your property!",
      "Verified landlords in Norton get more trust and more contact unlocks. It's the best way to reach serious tenants in town."
    ]
  },
  tenantValue: {
    patterns: ['why pay', 'is it worth', 'contact fee'],
    responses: [
      "The $2.50 fee ensures you get direct, verified access to real landlords. It saves you time and transport money by filtering out fake listings and scams.",
      "Think of it as an investment in safety. We verify landlords so you can search for your next home in Norton with confidence."
    ]
  },
  thanks: {
    patterns: ['thank', 'thanks', 'appreciate', 'helpful'],
    responses: [
      "You're welcome! Happy to help. If you have more questions, just ask!",
      "Glad I could help! Good luck with your property search!",
      "Anytime! Feel free to reach out if you need anything else."
    ]
  },
  bye: {
    patterns: ['bye', 'goodbye', 'see you', 'later', 'exit'],
    responses: [
      "Goodbye! Best of luck finding your perfect property in Norton!",
      "Take care! Come back anytime you need help with your property search.",
      "Bye for now! Wishing you success with Nortava!"
    ]
  },
  openingHours: {
    patterns: ['hours', 'opening', 'working hours', 'time'],
    responses: [
      "Our team is available Monday to Friday, 8:00 AM to 6:00 PM, and Saturdays from 9:00 AM to 1:00 PM. Outside these hours, you can still browse listings online!",
      "We're online weekdays 8 AM – 6 PM, Saturdays 9 AM – 1 PM. Messages after hours will be answered the next business day."
    ]
  },
  faq: {
    patterns: ['faq', 'questions', 'common questions', 'frequently asked', 'help topics'],
    responses: [
      "You can find answers to the most common questions on our FAQ page or ask me directly here!",
      "Need help fast? I can answer many FAQs about listings, payments, accounts, and safety—just ask!"
    ]
  },
  promotions: {
    patterns: ['promotion', 'discount', 'offer', 'special'],
    responses: [
      "Currently, Nortava doesn't have promotional discounts. But all listings are free for landlords, and tenants only pay the small $2.50 unlock fee per property.",
      "Keep an eye on our website or WhatsApp announcements for any special offers in the future!"
    ]
  },
  troubleshooting: {
    patterns: ['not working', 'error', 'issue', 'problem', 'bug', 'glitch'],
    responses: [
      "Oops! Try refreshing your page or clearing your browser cache. Still stuck? Contact support via WhatsApp or email.",
      "If something isn't working, check your internet connection and make sure you're using the latest version of your browser. Problems persisting? Reach out to us!"
    ]
  },
  listingsTips: {
    patterns: ['tips', 'advice', 'how to find', 'best way to search', 'choose property'],
    responses: [
      "Tip: Use filters like price, rooms, and location to narrow down properties quickly. Always check photos and descriptions carefully before unlocking contacts.",
      "Save listings you like so you can compare later. Unlock contacts only for properties you're genuinely interested in—this keeps your dashboard neat!"
    ]
  },
  landlordTips: {
    patterns: ['landlord tips', 'how to sell', 'listing advice', 'maximize listing'],
    responses: [
      "Pro tip for landlords: Upload high-quality photos, give clear property descriptions, and respond promptly to inquiries. This helps your listing get more attention!",
      "Keep your listings updated and accurate—tenants love honesty, and it builds trust on Nortava!"
    ]
  },
  chatbotHelp: {
    patterns: ['help chatbot', 'how to use bot', 'what can you do', 'assist'],
    responses: [
      "I can help you navigate Nortava, answer questions about listings, payments, accounts, safety, and more. Try asking me anything related to Nortava!",
      "I'm here to guide you step-by-step. Ask me about properties, fees, landlord tips, tenant tips, or local info about Norton, Zimbabwe."
    ]
  },
  feedback: {
    patterns: ['feedback', 'review', 'suggestion', 'comment'],
    responses: [
      "We love feedback! You can submit your suggestions via the Feedback page or tell me directly here, and it will reach the Nortava team.",
      "Your opinion matters! Share what you like or think could improve, and we'll make Nortava better for everyone."
    ]
  },
  humanFallback: {
    patterns: ['human', 'person', 'agent', 'someone', 'real help'],
    responses: [
      "If you'd like to speak with a real human, you can contact us via WhatsApp or email using the Contact page. We're happy to help!",
      "No problem! A Nortava support agent is ready to assist you via our WhatsApp support line or email."
    ]
  },
  verification: {
    patterns: ['verify', 'verified', 'verified landlord', 'blue badge', 'trusted', 'badge'],
    responses: [
      "Verified landlords have a blue badge on their profile. This means Nortava has confirmed their identity and legitimacy. Always look for this badge when unlocking contacts!",
      "Landlords can request verification through their dashboard. Verification takes 24-48 hours and helps build trust on the platform."
    ]
  },
  images: {
    patterns: ['image', 'photo', 'picture', 'upload photo', 'how many photos'],
    responses: [
      "You can upload up to 3 images per listing. Use high-quality photos to attract more tenants! Supported formats: JPG, PNG (max 5MB each).",
      "Good photos make a huge difference! Show the property from multiple angles, include the living room, bedrooms, and kitchen. Natural lighting works best."
    ]
  },
  neighborhoods: {
    patterns: ['neighborhood', 'area', 'katanga', 'district', 'suburb', 'location type'],
    responses: [
      "Popular areas in Norton include Katanga, Crescent, and other residential zones. Each area has its own character and price range. Explore our listings page!",
      "Want to know about a specific area? Check listing descriptions for neighborhood details, proximity to schools/shops, and community features."
    ]
  },
  reportIssue: {
    patterns: ['report', 'complaint', 'suspicious', 'report listing', 'flag'],
    responses: [
      "Found a suspicious listing? Click the Report button on any listing page. Our team reviews all reports within 24 hours. Your safety is our priority!",
      "Report scams, fake listings, or concerns using our Report feature. Include details to help us investigate quickly."
    ]
  },
  editListing: {
    patterns: ['edit listing', 'change listing', 'update property', 'modify listing', 'repost'],
    responses: [
      "As a landlord, edit listings anytime from the dashboard. Click Edit, make changes, and save. Your updated listing goes live instantly!",
      "Need to adjust price, add details, or update photos? Go to Dashboard → My Listings → Edit. Changes take effect immediately."
    ]
  },
  deleteAccount: {
    patterns: ['delete account', 'remove account', 'close account', 'deactivate'],
    responses: [
      "To delete your account, contact our support team via WhatsApp or email. We'll help with account deletion and data removal.",
      "Accounts can be deleted through support. Note: Active listings and transactions will be handled per our terms of service."
    ]
  },
  mobileApp: {
    patterns: ['app', 'mobile app', 'ios', 'android', 'download app', 'phone app'],
    responses: [
      "Nortava is fully optimized for mobile browsers! Use it on any smartphone. Our website works great on phones without needing a separate app.",
      "Access Nortava from any phone browser. Everything is mobile-optimized for smooth browsing, searching, and listing on the go!"
    ]
  },
  unknown: {
    patterns: [],
    responses: [
      "I'm not sure I understand, but I can help with listings, payments, accounts, safety, or general questions about Nortava. Can you try rephrasing?",
      "Sorry, I didn't catch that. Ask me anything about Nortava, like browsing listings, paying fees, or listing your property.",
      "Hmm, I'm still learning. I can help with property search, landlord/tenant guidance, or account questions. Can you ask another way?"
    ]
  }
};
const FALLBACK_RESPONSES = [
  "I'm not sure I understand. Try asking about:\n- How Nortava works\n- Payment methods\n- Finding properties\n- Listing your property\n- Safety tips",
  "Could you rephrase that? I can help with property searches, payments, account questions, and more!",
  "I didn't quite catch that. Feel free to ask about how to use Nortava, payment options, or listing properties!"
];

export function initChatbot() {
  createChatbotUI();
  setupChatbotEvents();
  loadChatHistory();
}

function createChatbotUI() {
  if (document.querySelector('.chatbot-button')) return;
  
  const chatbotHTML = `
    <button class="chatbot-button" aria-label="Open chat assistant">
      <i class="ri-message-3-fill"></i>
    </button>
    <div class="chatbot-container">
      <div class="chatbot-header">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 40px; height: 40px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary);">
            <i class="ri-robot-2-fill" style="font-size: 1.5rem;"></i>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1rem;">Nortava AI</h3>
            <span style="font-size: 0.75rem; opacity: 0.8; display: flex; align-items: center; gap: 4px;">
              <span style="width: 6px; height: 6px; background: #4ade80; border-radius: 50%;"></span> Online
            </span>
          </div>
        </div>
        <button class="chatbot-close" aria-label="Close chat"><i class="ri-close-line"></i></button>
      </div>
      <div class="chatbot-messages" id="chatMessages">
        <div class="chat-message bot">
          Hi! 👋 I'm the Nortava AI. I know everything about property in Norton. Want to know about Katanga prices, how verification works, or the best schools in the area? I'm here to help!
        </div>
      </div>
      <div class="quick-replies">
        <button class="quick-reply" data-message="How does Nortava work?">How it works</button>
        <button class="quick-reply" data-message="What payment methods do you accept?">Payments</button>
        <button class="quick-reply" data-message="How do I list my property?">List property</button>
        <button class="quick-reply" data-message="Safety tips">Safety tips</button>
      </div>
      <div class="chatbot-input">
        <input type="text" placeholder="Type your message..." id="chatInput">
        <button id="chatSend" aria-label="Send message"><i class="ri-send-plane-fill"></i></button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', chatbotHTML);
}

function setupChatbotEvents() {
  const chatButton = document.querySelector('.chatbot-button');
  const chatContainer = document.querySelector('.chatbot-container');
  const closeButton = document.querySelector('.chatbot-close');
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('chatSend');
  const quickReplies = document.querySelectorAll('.quick-reply');
  
  chatButton.addEventListener('click', () => {
    chatContainer.classList.toggle('active');
    if (chatContainer.classList.contains('active')) {
      chatInput.focus();
    }
  });
  
  closeButton.addEventListener('click', () => {
    chatContainer.classList.remove('active');
  });
  
  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  quickReplies.forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.message;
      sendMessage();
    });
  });
}

function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  
  if (!message) return;
  
  addMessage(message, 'user');
  chatInput.value = '';
  
  setTimeout(() => {
    const response = getBotResponse(message);
    addMessage(response, 'bot');
  }, 500);
}

function addMessage(text, sender) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;
  
  // Use innerHTML to handle line breaks if needed, or textContent for safety
  // Since we want to show texts, let's ensure it's visible
  messageDiv.textContent = text;
  
  // Force visibility styles just in case
  messageDiv.style.display = 'block';
  messageDiv.style.visibility = 'visible';
  messageDiv.style.opacity = '1';
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  saveChatHistory();
}

function getBotResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  for (const category of Object.values(CHATBOT_RESPONSES)) {
    for (const pattern of category.patterns) {
      if (lowerMessage.includes(pattern)) {
        const responses = category.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
  }
  
  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

function saveChatHistory() {
  const messages = document.querySelectorAll('#chatMessages .chat-message');
  const history = Array.from(messages).map(msg => ({
    text: msg.textContent,
    sender: msg.classList.contains('user') ? 'user' : 'bot'
  }));
  
  sessionStorage.setItem('nortava-chat-history', JSON.stringify(history.slice(-20)));
}

function loadChatHistory() {
  const history = sessionStorage.getItem('nortava-chat-history');
  if (!history) return;
  
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;
  
  const messages = JSON.parse(history);
  if (messages.length <= 1) return;
  
  messagesContainer.innerHTML = '';
  messages.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${msg.sender}`;
    messageDiv.textContent = msg.text;
    messagesContainer.appendChild(messageDiv);
  });
}

export function getChatbotResponse(message) {
  return getBotResponse(message);
}
