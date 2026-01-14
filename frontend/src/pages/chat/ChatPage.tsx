import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Tile,
  TextInput,
  Button,
  Loading,
  Dropdown,
} from '@carbon/react';
import { SendAlt, Bot } from '@carbon/icons-react';
import { modelsApi, chatApi, subscriptionsApi } from '../../services/api';
import { AIModel, SubscriptionWithUsage } from '../../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const initialModelId = searchParams.get('model');

  const [selectedModelId, setSelectedModelId] = useState<string | null>(initialModelId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: subscriptions } = useQuery<SubscriptionWithUsage[]>({
    queryKey: ['active-subscriptions'],
    queryFn: () => subscriptionsApi.listActive().then(res => res.data),
  });

  const { data: models } = useQuery<AIModel[]>({
    queryKey: ['models'],
    queryFn: () => modelsApi.list().then(res => res.data),
  });

  const availableModels = models?.filter(m =>
    subscriptions?.some(s => s.model_id === m.id) || !m.pricing?.monthly_subscription_price
  );

  const modelItems = availableModels?.map(m => ({ id: m.id, text: m.name })) || [];
  const selectedModel = availableModels?.find(m => m.id === selectedModelId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedModelId || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await chatApi.complete({
        model_id: selectedModelId,
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        use_rag: true,
        stream: false,
      });

      setMessages([...updatedMessages, {
        role: 'assistant',
        content: response.data.content,
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...updatedMessages, {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '1.5rem' }}>
      {/* Sidebar */}
      <div style={{ width: '280px', flexShrink: 0 }}>
        <Tile style={{ height: '100%', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Select Model</h3>
          <Dropdown
            id="model-select"
            titleText=""
            label="Choose a model"
            items={modelItems}
            itemToString={(item) => item?.text || ''}
            selectedItem={modelItems.find(m => m.id === selectedModelId)}
            onChange={({ selectedItem }) => setSelectedModelId(selectedItem?.id || null)}
          />

          {selectedModel && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Model Info</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {selectedModel.description || 'No description'}
              </p>
              <p style={{ fontSize: '0.75rem' }}>Provider: {selectedModel.provider}</p>
              <p style={{ fontSize: '0.75rem' }}>Category: {selectedModel.category.replace('_', ' ')}</p>
            </div>
          )}
        </Tile>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Tile style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          {!selectedModelId ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <Bot size={48} />
              <p style={{ marginTop: '1rem' }}>Select a model to start chatting</p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                    <Bot size={48} />
                    <p style={{ marginTop: '1rem' }}>Start a conversation with {selectedModel?.name}</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        maxWidth: '80%',
                        alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                        flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                      }}
                    >
                      {message.role === 'assistant' && (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--brand-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Bot size={16} style={{ color: 'var(--white)' }} />
                        </div>
                      )}
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '1rem',
                        backgroundColor: message.role === 'user' ? 'var(--brand-primary)' : 'var(--border-subtle)',
                        color: message.role === 'user' ? 'var(--white)' : 'var(--text-primary)',
                      }}>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                      </div>
                    </div>
                  ))
                )}
                {isStreaming && (
                  <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Bot size={16} style={{ color: 'var(--white)' }} />
                    </div>
                    <div style={{ padding: '0.75rem 1rem', borderRadius: '1rem', backgroundColor: 'var(--border-subtle)' }}>
                      <Loading small withOverlay={false} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <TextInput
                  id="chat-input"
                  labelText=""
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isStreaming}
                  style={{ flex: 1 }}
                />
                <Button
                  kind="primary"
                  renderIcon={SendAlt}
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                >
                  Send
                </Button>
              </div>
            </>
          )}
        </Tile>
      </div>
    </div>
  );
}
