import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Tile,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  InlineNotification,
  Loading,
} from '@carbon/react';
import { ArrowLeft, Copy, Checkmark } from '@carbon/icons-react';
import { widgetsApi } from '../../services/api';

interface EmbedCode {
  html: string;
  npm: string;
  react: string;
  api_curl: string;
  python_sdk: string;
  js_sdk: string;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Button
        kind="ghost"
        size="sm"
        renderIcon={copied ? Checkmark : Copy}
        hasIconOnly
        iconDescription={copied ? 'Copied!' : 'Copy to clipboard'}
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          zIndex: 1,
        }}
      />
      <pre
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          fontFamily: 'IBM Plex Mono, Consolas, Monaco, monospace',
          maxHeight: '400px',
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function WidgetIntegration() {
  const { widgetId } = useParams<{ widgetId: string }>();
  const navigate = useNavigate();

  const { data: embedCode, isLoading, error } = useQuery<EmbedCode>({
    queryKey: ['widget-embed-code', widgetId],
    queryFn: () => widgetsApi.getEmbedCode(widgetId!).then(res => res.data),
    enabled: !!widgetId,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading..." withOverlay={false} />
      </div>
    );
  }

  if (error || !embedCode) {
    return (
      <Tile style={{ padding: '2rem' }}>
        <InlineNotification
          kind="error"
          title="Error"
          subtitle="Failed to load embed code. Please try again."
          hideCloseButton
        />
      </Tile>
    );
  }

  return (
    <Tile style={{ padding: '2rem' }}>
      <Button
        kind="ghost"
        renderIcon={ArrowLeft}
        onClick={() => navigate('/settings/widgets')}
        style={{ marginBottom: '1rem' }}
      >
        Back to Widgets
      </Button>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>Integration Options</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Choose how you want to integrate the chat widget into your application</p>
      </div>

      <Tabs>
        <TabList aria-label="Integration options">
          <Tab>HTML Script</Tab>
          <Tab>npm Package</Tab>
          <Tab>React</Tab>
          <Tab>REST API</Tab>
          <Tab>Python SDK</Tab>
          <Tab>JavaScript SDK</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>HTML Script Tag</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                The simplest way to add the chat widget. Just paste this script tag before the closing {'</body>'} tag.
              </p>
              <CodeBlock code={embedCode.html} />
              <InlineNotification
                kind="info"
                title="Domain Restrictions"
                subtitle="Make sure your domain is in the allowed domains list for the widget."
                lowContrast
                hideCloseButton
                style={{ marginTop: '1rem' }}
              />
            </div>
          </TabPanel>

          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>npm Package</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Install and configure the widget using our npm package for more control.
              </p>
              <CodeBlock code={embedCode.npm} />
            </div>
          </TabPanel>

          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>React Component</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Use our React component for seamless integration with React applications.
              </p>
              <CodeBlock code={embedCode.react} />
            </div>
          </TabPanel>

          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>REST API</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Build your own custom UI using our REST API directly.
              </p>
              <CodeBlock code={embedCode.api_curl} />
              <InlineNotification
                kind="warning"
                title="API Key Required"
                subtitle="Create an API key in Settings > API Keys to use the REST API."
                lowContrast
                hideCloseButton
                style={{ marginTop: '1rem' }}
              />
            </div>
          </TabPanel>

          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Python SDK</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Use our Python SDK for server-side integration and backend applications.
              </p>
              <CodeBlock code={embedCode.python_sdk} />
            </div>
          </TabPanel>

          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>JavaScript SDK</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Use our JavaScript/TypeScript SDK for Node.js applications.
              </p>
              <CodeBlock code={embedCode.js_sdk} />
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Tile>
  );
}
