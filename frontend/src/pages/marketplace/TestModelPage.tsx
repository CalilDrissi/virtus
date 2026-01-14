import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  TextInput,
  TextArea,
  Loading,
  Tag,
  InlineNotification,
  InlineLoading,
  Modal,
} from '@carbon/react';
import {
  ArrowLeft,
  SendAlt,
  Bot,
  Star,
  StarFilled,
  ShoppingCart,
  Checkmark,
} from '@carbon/icons-react';
import { modelsApi, subscriptionsApi, chatApi } from '../../services/api';
import { AIModel, Subscription } from '../../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_TEST_MESSAGES = 5;

export default function TestModelPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Feedback state
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Fetch model
  const { data: model, isLoading } = useQuery<AIModel>({
    queryKey: ['model', modelId],
    queryFn: () => modelsApi.get(modelId!).then(res => res.data),
    enabled: !!modelId,
  });

  // Check subscription status
  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ['subscriptions', 'active'],
    queryFn: () => subscriptionsApi.listActive().then(res => res.data),
  });

  const subscription = subscriptions?.find(s => s.model_id === modelId);
  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const hasReachedLimit = userMessageCount >= MAX_TEST_MESSAGES;

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: () => subscriptionsApi.checkout({
      model_id: modelId!,
      success_url: `${window.location.origin}/marketplace/${modelId}?subscribed=true`,
      cancel_url: `${window.location.origin}/marketplace/${modelId}/test`,
    }),
    onSuccess: async (response) => {
      if (response.data.session_id === 'free') {
        await queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        const subs = await subscriptionsApi.listActive();
        const newSub = subs.data.find((s: Subscription) => s.model_id === modelId);
        if (newSub) {
          navigate(`/subscriptions/${newSub.id}`);
        } else {
          navigate('/');
        }
      } else {
        window.location.href = response.data.url;
      }
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      alert(error.response?.data?.detail || error.message || 'Failed to subscribe');
    },
  });

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !modelId || isStreaming || hasReachedLimit) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await chatApi.complete({
        model_id: modelId,
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        use_rag: false,
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

  const handleSubmitFeedback = () => {
    // In a real app, this would send to an API
    console.log('Feedback submitted:', { modelId, rating, feedbackText });
    setFeedbackSubmitted(true);
    setIsFeedbackOpen(false);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading model..." withOverlay={false} />
      </div>
    );
  }

  if (!model) {
    return (
      <Tile style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Model not found</p>
        <Button kind="ghost" onClick={() => navigate('/marketplace')} style={{ marginTop: '1rem' }}>
          Back to Marketplace
        </Button>
      </Tile>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <Button
          kind="ghost"
          renderIcon={ArrowLeft}
          onClick={() => navigate(`/marketplace/${modelId}`)}
          style={{ marginBottom: '0.5rem' }}
        >
          Back to Model
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              backgroundColor: 'var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--brand-primary)',
            }}>
              {model.icon_url ? (
                <img src={model.icon_url} alt={model.name} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
              ) : (
                model.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 400, margin: 0 }}>Test {model.name}</h1>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <Tag type="purple">Trial Mode</Tag>
                <Tag type="outline">{MAX_TEST_MESSAGES - userMessageCount} messages left</Tag>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              kind="secondary"
              renderIcon={Star}
              onClick={() => setIsFeedbackOpen(true)}
              disabled={feedbackSubmitted}
            >
              {feedbackSubmitted ? 'Feedback Sent' : 'Leave Feedback'}
            </Button>
            {subscription ? (
              <Button
                kind="primary"
                renderIcon={Checkmark}
                onClick={() => navigate(`/subscriptions/${subscription.id}`)}
              >
                Open Full Version
              </Button>
            ) : (
              <Button
                kind="primary"
                renderIcon={ShoppingCart}
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? <InlineLoading description="..." /> : 'Subscribe Now'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Trial info banner */}
      <InlineNotification
        kind="info"
        title="Trial Mode"
        subtitle={`You can send up to ${MAX_TEST_MESSAGES} messages to test this model. Subscribe to unlock unlimited usage and RAG capabilities.`}
        lowContrast
        hideCloseButton
        style={{ marginBottom: '1rem', maxWidth: 'none' }}
      />

      {/* Chat Area */}
      <Tile style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <Bot size={48} />
              <p style={{ marginTop: '1rem' }}>Try out {model.name}</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Send a message to see how this model responds
              </p>
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

        {/* Limit reached banner */}
        {hasReachedLimit && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--notification-info-background)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Trial limit reached</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Subscribe to continue chatting with unlimited messages and RAG features.
                </p>
              </div>
              {!subscription && (
                <Button
                  kind="primary"
                  renderIcon={ShoppingCart}
                  onClick={() => subscribeMutation.mutate()}
                  disabled={subscribeMutation.isPending}
                >
                  Subscribe Now
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        {!hasReachedLimit && (
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
        )}
      </Tile>

      {/* Feedback Modal */}
      <Modal
        open={isFeedbackOpen}
        onRequestClose={() => setIsFeedbackOpen(false)}
        onRequestSubmit={handleSubmitFeedback}
        modalHeading={`Rate ${model.name}`}
        primaryButtonText="Submit Feedback"
        secondaryButtonText="Cancel"
        primaryButtonDisabled={rating === 0}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
          {/* Star Rating */}
          <div>
            <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>How would you rate this model?</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                  }}
                >
                  {star <= rating ? (
                    <StarFilled size={32} style={{ color: '#f1c21b' }} />
                  ) : (
                    <Star size={32} style={{ color: 'var(--text-secondary)' }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Text */}
          <TextArea
            id="feedback-text"
            labelText="Your feedback (optional)"
            placeholder="Tell us what you liked or what could be improved..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={4}
          />

          {/* Quick feedback tags */}
          <div>
            <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Quick feedback:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['Fast responses', 'Accurate answers', 'Good explanations', 'Needs improvement', 'Too slow', 'Incorrect answers'].map((tag) => (
                <Tag
                  key={tag}
                  type={feedbackText.includes(tag) ? 'blue' : 'outline'}
                  onClick={() => {
                    if (feedbackText.includes(tag)) {
                      setFeedbackText(feedbackText.replace(tag + ', ', '').replace(tag, ''));
                    } else {
                      setFeedbackText(feedbackText ? `${feedbackText}, ${tag}` : tag);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
