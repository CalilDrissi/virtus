import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

interface WidgetConfig {
  widgetId: string;
  apiUrl: string;
  apiKey: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
  };
  position?: 'bottom-right' | 'bottom-left';
  title?: string;
  welcomeMessage?: string;
  placeholder?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const defaultTheme = {
  primaryColor: '#0078d4',
  backgroundColor: '#ffffff',
  textColor: '#333333',
};

function ChatWidget({ config }: { config: WidgetConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const theme = { ...defaultTheme, ...config.theme };
  const position = config.position || 'bottom-right';

  useEffect(() => {
    if (config.welcomeMessage && messages.length === 0) {
      setMessages([{ role: 'assistant', content: config.welcomeMessage }]);
    }
  }, [config.welcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify({
          widget_id: config.widgetId,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          stream: false,
        }),
      });

      const data = await response.json();
      setMessages([...updatedMessages, { role: 'assistant', content: data.content }]);
    } catch (error) {
      setMessages([...updatedMessages, {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const positionStyles = position === 'bottom-left'
    ? { left: '20px', right: 'auto' }
    : { right: '20px', left: 'auto' };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            ...positionStyles,
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: theme.primaryColor,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            ...positionStyles,
            width: '380px',
            height: '520px',
            backgroundColor: theme.backgroundColor,
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 9999,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.primaryColor,
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600 }}>{config.title || 'Chat'}</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '16px',
                    backgroundColor: msg.role === 'user' ? theme.primaryColor : '#f0f0f0',
                    color: msg.role === 'user' ? 'white' : theme.textColor,
                    fontSize: '14px',
                    lineHeight: 1.4,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '16px',
                    backgroundColor: '#f0f0f0',
                    color: theme.textColor,
                  }}
                >
                  <span style={{ animation: 'pulse 1.5s infinite' }}>...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              value={input}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyPress={handleKeyPress}
              placeholder={config.placeholder || 'Type a message...'}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '20px',
                border: '1px solid #e0e0e0',
                fontSize: '14px',
                outline: 'none',
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: theme.primaryColor,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || isLoading ? 0.5 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}

// Global initialization function
(window as any).VirtusWidget = {
  init: (config: WidgetConfig) => {
    const container = document.createElement('div');
    container.id = 'virtus-widget-container';
    document.body.appendChild(container);
    render(<ChatWidget config={config} />, container);
  },
};

export default ChatWidget;
