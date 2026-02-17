/**
 * ============================================================================
 * AI INTEGRATION UI MODULE
 * ============================================================================
 *
 * PURPOSE:
 * Handles AI sidebar, chat interface, code formatting, and AI provider
 * integration. Provides UI for interacting with AI assistants (Gemini,
 * OpenAI, Claude, local models).
 *
 * EXPORTED FUNCTIONS:
 * - registerAICallbacks(cb) - Register dependencies from app.js
 * - updateAIVisibility() - Show/hide AI features based on settings
 * - toggleAISidebar() - Toggle AI sidebar visibility
 * - sendAIChatMessage(message) - Send message to AI chat
 * - formatCodeWithAI() - Format selected code with AI
 *
 * REQUIRED CALLBACKS (from app.js):
 * - showToast: Display notifications
 * - fetchWithAuth: Make API calls
 * - API_BASE: API base URL
 * - elements: DOM element references
 * - getSelectedText: Get selected text from editor
 * - insertTextAtCursor: Insert text at cursor
 *
 * HOW TO ADD NEW FEATURES:
 *
 * 1. Adding a new AI provider:
 *    - Add provider to settings-ui.js AI settings
 *    - Add API key field for new provider
 *    - Implement server-side integration in ai.py
 *    - Add provider logo/icon to UI
 *    - Test chat and formatting functions
 *
 * 2. Adding AI code actions:
 *    - Add button to AI sidebar or toolbar
 *    - Create action function (similar to formatCodeWithAI)
 *    - Call callbacks.fetchWithAuth with action: "ai_action"
 *    - Handle response and update editor
 *    - Examples: explain code, generate tests, refactor
 *
 * 3. Adding chat features:
 *    - Modify sendAIChatMessage() function
 *    - Add message history/context
 *    - Add code snippet sharing
 *    - Add file attachment
 *    - Add conversation export
 *
 * 4. Adding AI suggestions:
 *    - Create inline suggestion UI
 *    - Call AI for autocomplete/suggestions
 *    - Show suggestions in editor
 *    - Accept/reject suggestion controls
 *
 * 5. Customizing AI prompts:
 *    - Add prompt templates in settings
 *    - Allow custom system prompts
 *    - Add prompt variables (file name, language, etc.)
 *    - Save favorite prompts
 *
 * INTEGRATION POINTS:
 * - state.js: AI settings (aiIntegrationEnabled, aiType, cloudProvider, API keys)
 * - elements: AI sidebar, chat container, buttons
 * - settings-ui.js: AI configuration interface
 * - ai.js: Server-side AI integration
 * - editor.js: Text selection and insertion
 *
 * AI SETTINGS (in state):
 * - aiIntegrationEnabled: Master toggle for AI features
 * - aiType: "cloud" or "rule-based" or "local"
 * - cloudProvider: "gemini", "openai", or "claude"
 * - localAiProvider: "ollama", "lmstudio", or "custom"
 * - geminiApiKey, openaiApiKey, claudeApiKey: API keys
 * - ollamaUrl, ollamaModel: Ollama config
 * - lmStudioUrl, lmStudioModel: LM Studio config
 *
 * ARCHITECTURE NOTES:
 * - AI operations execute on server (API keys never exposed to client)
 * - Chat maintains conversation context
 * - Code formatting works on selected text or entire file
 * - AI sidebar is collapsible and persistent
 * - Supports multiple AI providers with unified interface
 *
 * COMMON PATTERNS:
 * - Send AI request: const response = await callbacks.fetchWithAuth(API_BASE, { action: "ai_chat", message })
 * - Get selection: const text = callbacks.getSelectedText()
 * - Insert result: callbacks.insertTextAtCursor(result)
 * - Toggle AI: updateAIVisibility() after settings change
 * - Error handling: try/catch with showToast on error
 *
 * CHAT INTERFACE:
 * - User messages and AI responses
 * - Markdown rendering in responses
 * - Code blocks with syntax highlighting
 * - Copy code button in code blocks
 * - Conversation history
 *
 * CODE FORMATTING:
 * - Format selected text or entire file
 * - AI improves structure, naming, comments
 * - Preserves functionality
 * - Shows loading state during processing
 * - Inserts formatted code at cursor or replaces selection
 *
 * ============================================================================
 */
import { state } from './state.js';

// Callbacks for cross-module functions
let callbacks = {
  showToast: null,
  fetchWithAuth: null,
  getApiBase: null
};

export function registerAICallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

/**
 * Updates visibility of AI integration button based on settings
 */
export function updateAIVisibility() {
  const btnAI = document.getElementById("btn-ai-studio");
  if (btnAI) {
    btnAI.style.display = state.aiIntegrationEnabled ? "flex" : "none";
  }
  const aiSidebar = document.getElementById("ai-sidebar");
  if (aiSidebar && !state.aiIntegrationEnabled) {
    aiSidebar.classList.add("hidden");
  }
}

/**
 * Toggles the AI sidebar open/closed
 */
export function toggleAISidebar() {
  const aiSidebar = document.getElementById("ai-sidebar");
  if (!aiSidebar) return;

  const isHidden = aiSidebar.classList.contains("hidden");
  if (isHidden) {
    aiSidebar.classList.remove("hidden");
    document.getElementById("ai-chat-input")?.focus();
  } else {
    aiSidebar.classList.add("hidden");
  }
}

/**
 * Formats AI response text with markdown-style formatting
 * @param {string} text - Raw AI response text
 * @returns {string} HTML formatted response
 */
export function formatAiResponse(text) {
  if (!text) return "";

  // Replace code blocks with styled containers
  let formatted = text.replace(/```(?:yaml|yml)?\n([\s\S]*?)\n```/g, (match, code) => {
      return `<div class="ai-code-block"><pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre></div>`;
  });

  // Bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Inline code
  formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');

  // New lines to <br> (only outside of code blocks)
  // This is a simple version, ideally use a markdown library but keeping it local/lightweight
  return formatted.replace(/\n/g, '<br>');
}

/**
 * Copies text to clipboard with fallback for older browsers
 * @param {string} text - Text to copy
 */
export function copyToClipboard(text) {
  if (!navigator.clipboard) {
      // Fallback for non-secure contexts or browsers without clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
          document.execCommand('copy');
          if (callbacks.showToast) callbacks.showToast("Code copied to clipboard", "success");
      } catch (err) {
          console.error("Fallback copy failed:", err);
          if (callbacks.showToast) callbacks.showToast("Failed to copy code", "error");
      }
      document.body.removeChild(textArea);
      return;
  }

  navigator.clipboard.writeText(text).then(() => {
      if (callbacks.showToast) callbacks.showToast("Code copied to clipboard", "success");
  }).catch(err => {
      console.error("Async copy failed:", err);
      if (callbacks.showToast) callbacks.showToast("Failed to copy code", "error");
  });
}

/**
 * Sends a chat message to the AI provider and displays the response
 */
export async function sendAIChatMessage() {
  const input = document.getElementById("ai-chat-input");
  const messagesContainer = document.getElementById("ai-chat-messages");
  const query = input.value.trim();

  if (!query) return;

  // Add user message
  const userMsg = document.createElement("div");
  userMsg.className = "ai-message ai-message-user";
  userMsg.textContent = query;
  messagesContainer.appendChild(userMsg);

  input.value = "";
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Add assistant loading message
  const loadingMsg = document.createElement("div");
  loadingMsg.className = "ai-message ai-message-assistant";
  loadingMsg.innerHTML = '<span class="ai-loading">Thinking...</span>';
  messagesContainer.appendChild(loadingMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    console.log("AI Copilot: Sending query...", {
      provider: state.aiProvider,
      file: state.activeTab ? state.activeTab.path : null,
      query: query
    });

    const API_BASE = callbacks.getApiBase ? callbacks.getApiBase() : "";
    const result = await callbacks.fetchWithAuth(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ai_query",
        query: query,
        current_file: state.activeTab ? state.activeTab.path : null,
        file_content: (state.activeTab && state.editor) ? state.editor.getValue() : null,
        ai_type: state.aiType,
        cloud_provider: state.cloudProvider,
        ai_model: state.aiModel
      })
    });

    console.log("AI Copilot: Received response:", result);

    if (result.success) {
      // Parse markdown code blocks and format them
      const formattedResponse = formatAiResponse(result.response);
      loadingMsg.innerHTML = formattedResponse;

      // Add copy buttons to code blocks
      loadingMsg.querySelectorAll(".ai-code-block").forEach(block => {
          const copyBtn = document.createElement("button");
          copyBtn.className = "ai-copy-btn";
          copyBtn.innerHTML = '<span class="material-icons">content_copy</span>';
          copyBtn.title = "Copy to clipboard";
          copyBtn.onclick = () => {
              const code = block.querySelector("code").innerText;
              copyToClipboard(code);
          };
          block.appendChild(copyBtn);
      });
    } else {
      loadingMsg.textContent = "Error: " + (result.message || "Failed to get response from AI");
      loadingMsg.style.color = "var(--error-color)";
    }
  } catch (e) {
    console.error("AI Copilot Error:", e);
    loadingMsg.textContent = "Error connecting to AI service: " + e.message;
    loadingMsg.style.color = "var(--error-color)";
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
