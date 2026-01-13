import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Input,
  Button,
  Spinner,
  Dropdown,
  Option,
  Avatar,
} from '@fluentui/react-components';
import { Send24Regular, Bot24Regular } from '@fluentui/react-icons';
import { modelsApi, chatApi, subscriptionsApi } from '../../services/api';
import { AIModel, ChatMessage, SubscriptionWithUsage } from '../../types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    height: 'calc(100vh - 120px)',
    gap: tokens.spacingHorizontalL,
  },
  sidebar: {
    width: '280px',
    flexShrink: 0,
  },
  sidebarCard: {
    height: '100%',
    padding: tokens.spacingVerticalM,
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  chatCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  message: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  inputArea: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  input: {
    flex: 1,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
  },
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const styles = useStyles();
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
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <Card className={styles.sidebarCard}>
          <Text size={400} weight="semibold" block style={{ marginBottom: tokens.spacingVerticalM }}>
            Select Model
          </Text>
          <Dropdown
            placeholder="Choose a model"
            value={selectedModel?.name}
            onOptionSelect={(_, data) => setSelectedModelId(data.optionValue as string)}
          >
            {availableModels?.map(model => (
              <Option key={model.id} value={model.id}>
                {model.name}
              </Option>
            ))}
          </Dropdown>

          {selectedModel && (
            <div style={{ marginTop: tokens.spacingVerticalL }}>
              <Text size={300} weight="semibold" block>Model Info</Text>
              <Text size={200} block style={{ marginTop: tokens.spacingVerticalS, color: tokens.colorNeutralForeground3 }}>
                {selectedModel.description || 'No description'}
              </Text>
              <Text size={200} block style={{ marginTop: tokens.spacingVerticalS }}>
                Provider: {selectedModel.provider}
              </Text>
              <Text size={200} block>
                Category: {selectedModel.category.replace('_', ' ')}
              </Text>
            </div>
          )}
        </Card>
      </div>

      <div className={styles.chatArea}>
        <Card className={styles.chatCard}>
          {!selectedModelId ? (
            <div className={styles.emptyState}>
              <Bot24Regular style={{ fontSize: '48px' }} />
              <Text size={400}>Select a model to start chatting</Text>
            </div>
          ) : (
            <>
              <div className={styles.messages}>
                {messages.length === 0 ? (
                  <div className={styles.emptyState}>
                    <Bot24Regular style={{ fontSize: '48px' }} />
                    <Text size={400}>Start a conversation with {selectedModel?.name}</Text>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`${styles.message} ${
                        message.role === 'user' ? styles.userMessage : styles.assistantMessage
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <Avatar icon={<Bot24Regular />} color="brand" size={32} />
                      )}
                      <div
                        className={`${styles.messageBubble} ${
                          message.role === 'user' ? styles.userBubble : styles.assistantBubble
                        }`}
                      >
                        <Text style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
                      </div>
                    </div>
                  ))
                )}
                {isStreaming && (
                  <div className={`${styles.message} ${styles.assistantMessage}`}>
                    <Avatar icon={<Bot24Regular />} color="brand" size={32} />
                    <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                      <Spinner size="tiny" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.inputArea}>
                <Input
                  className={styles.input}
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isStreaming}
                />
                <Button
                  appearance="primary"
                  icon={<Send24Regular />}
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                >
                  Send
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
