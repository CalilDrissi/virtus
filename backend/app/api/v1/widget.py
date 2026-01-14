from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from app.database import get_db
from app.models.widget import WidgetConfig
from app.api.deps import get_current_user, CurrentUser

router = APIRouter(prefix="/widgets", tags=["Widgets"])


class WidgetConfigCreate(BaseModel):
    name: str
    model_id: UUID
    theme: dict = {}
    position: str = "bottom-right"
    welcome_message: str = None
    placeholder_text: str = "Type a message..."
    allowed_domains: List[str] = []
    logo_url: str = None
    title: str = "Chat with AI"


class WidgetConfigUpdate(BaseModel):
    name: str = None
    model_id: UUID = None
    theme: dict = None
    position: str = None
    welcome_message: str = None
    placeholder_text: str = None
    allowed_domains: List[str] = None
    logo_url: str = None
    title: str = None


class WidgetConfigResponse(BaseModel):
    id: UUID
    organization_id: UUID
    model_id: UUID | None
    name: str
    theme: dict
    position: str
    welcome_message: str | None
    placeholder_text: str
    allowed_domains: List[str]
    logo_url: str | None
    title: str

    class Config:
        from_attributes = True


@router.get("", response_model=List[WidgetConfigResponse])
async def list_widgets(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all widget configurations"""
    result = await db.execute(
        select(WidgetConfig)
        .where(WidgetConfig.organization_id == current_user.org_id)
        .order_by(WidgetConfig.created_at.desc())
    )
    widgets = result.scalars().all()
    return [WidgetConfigResponse.model_validate(w) for w in widgets]


@router.post("", response_model=WidgetConfigResponse)
async def create_widget(
    data: WidgetConfigCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new widget configuration"""
    widget = WidgetConfig(
        organization_id=current_user.org_id,
        model_id=data.model_id,
        name=data.name,
        theme=data.theme,
        position=data.position,
        welcome_message=data.welcome_message,
        placeholder_text=data.placeholder_text,
        allowed_domains=data.allowed_domains,
        logo_url=data.logo_url,
        title=data.title,
    )
    db.add(widget)
    await db.commit()
    await db.refresh(widget)
    return WidgetConfigResponse.model_validate(widget)


@router.get("/{widget_id}", response_model=WidgetConfigResponse)
async def get_widget(
    widget_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a widget configuration"""
    result = await db.execute(
        select(WidgetConfig).where(
            WidgetConfig.id == widget_id,
            WidgetConfig.organization_id == current_user.org_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")
    return WidgetConfigResponse.model_validate(widget)


@router.patch("/{widget_id}", response_model=WidgetConfigResponse)
async def update_widget(
    widget_id: UUID,
    data: WidgetConfigUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a widget configuration"""
    result = await db.execute(
        select(WidgetConfig).where(
            WidgetConfig.id == widget_id,
            WidgetConfig.organization_id == current_user.org_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(widget, field, value)

    await db.commit()
    await db.refresh(widget)
    return WidgetConfigResponse.model_validate(widget)


@router.delete("/{widget_id}")
async def delete_widget(
    widget_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a widget configuration"""
    result = await db.execute(
        select(WidgetConfig).where(
            WidgetConfig.id == widget_id,
            WidgetConfig.organization_id == current_user.org_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")

    await db.delete(widget)
    await db.commit()
    return {"message": "Widget deleted"}


@router.get("/{widget_id}/embed.js", response_class=HTMLResponse)
async def get_widget_embed_script(
    widget_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the embed script for a widget"""
    result = await db.execute(
        select(WidgetConfig).where(WidgetConfig.id == widget_id)
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")

    # Check domain
    origin = request.headers.get("origin", "")
    if widget.allowed_domains:
        allowed = any(
            domain in origin or domain == "*"
            for domain in widget.allowed_domains
        )
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Domain not allowed")

    base_url = str(request.base_url).rstrip("/")
    primary_color = widget.theme.get("primaryColor", "#0078d4") if widget.theme else "#0078d4"

    script = f"""
(function() {{
  var config = {{
    widgetId: "{widget_id}",
    apiUrl: "{base_url}",
    theme: {widget.theme or '{}'},
    position: "{widget.position}",
    title: "{widget.title}",
    welcomeMessage: "{widget.welcome_message or ''}",
    placeholder: "{widget.placeholder_text}"
  }};

  var iframe = document.createElement('iframe');
  iframe.src = "{base_url}/api/v1/widgets/{widget_id}/frame";
  iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:400px;height:600px;border:none;z-index:9999;display:none;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);';
  iframe.id = 'virtus-chat-widget';
  iframe.allow = 'clipboard-read; clipboard-write';
  document.body.appendChild(iframe);

  var button = document.createElement('button');
  button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  button.style.cssText = 'position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:{primary_color};border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
  button.onmouseover = function() {{ this.style.transform = 'scale(1.1)'; }};
  button.onmouseout = function() {{ this.style.transform = 'scale(1)'; }};
  button.onclick = function() {{
    var widget = document.getElementById('virtus-chat-widget');
    if (widget.style.display === 'none') {{
      widget.style.display = 'block';
      button.style.display = 'none';
    }}
  }};
  document.body.appendChild(button);

  window.addEventListener('message', function(e) {{
    if (e.data === 'virtus-close') {{
      document.getElementById('virtus-chat-widget').style.display = 'none';
      button.style.display = 'flex';
    }}
  }});
}})();
"""
    return HTMLResponse(content=script, media_type="application/javascript")


@router.get("/{widget_id}/frame", response_class=HTMLResponse)
async def get_widget_frame(
    widget_id: UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Serve the widget iframe content"""
    result = await db.execute(
        select(WidgetConfig).where(WidgetConfig.id == widget_id)
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")

    base_url = str(request.base_url).rstrip("/")
    theme = widget.theme or {}
    primary_color = theme.get("primaryColor", "#0078d4")
    bg_color = theme.get("backgroundColor", "#ffffff")
    text_color = theme.get("textColor", "#333333")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{widget.title}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: {bg_color};
            height: 100vh;
            display: flex;
            flex-direction: column;
        }}
        .header {{
            padding: 16px;
            background: {primary_color};
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .header h1 {{
            font-size: 16px;
            font-weight: 600;
        }}
        .close-btn {{
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 4px 8px;
            line-height: 1;
        }}
        .close-btn:hover {{
            opacity: 0.8;
        }}
        .messages {{
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }}
        .message {{
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 16px;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
        }}
        .message.user {{
            align-self: flex-end;
            background: {primary_color};
            color: white;
            border-bottom-right-radius: 4px;
        }}
        .message.assistant {{
            align-self: flex-start;
            background: #f0f0f0;
            color: {text_color};
            border-bottom-left-radius: 4px;
        }}
        .typing {{
            align-self: flex-start;
            background: #f0f0f0;
            color: {text_color};
            padding: 12px 16px;
            border-radius: 16px;
        }}
        .typing span {{
            animation: pulse 1.5s infinite;
        }}
        @keyframes pulse {{
            0%, 100% {{ opacity: 0.4; }}
            50% {{ opacity: 1; }}
        }}
        .input-area {{
            padding: 12px 16px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            gap: 8px;
            background: {bg_color};
        }}
        .input-area input {{
            flex: 1;
            padding: 12px 16px;
            border: 1px solid #e0e0e0;
            border-radius: 24px;
            font-size: 14px;
            outline: none;
        }}
        .input-area input:focus {{
            border-color: {primary_color};
        }}
        .send-btn {{
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: {primary_color};
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.2s;
        }}
        .send-btn:disabled {{
            opacity: 0.5;
            cursor: not-allowed;
        }}
        .send-btn:not(:disabled):hover {{
            opacity: 0.9;
        }}
        .powered-by {{
            text-align: center;
            padding: 8px;
            font-size: 11px;
            color: #999;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{widget.title}</h1>
        <button class="close-btn" onclick="parent.postMessage('virtus-close', '*')">&times;</button>
    </div>
    <div class="messages" id="messages"></div>
    <div class="input-area">
        <input type="text" id="input" placeholder="{widget.placeholder_text}" onkeypress="handleKeyPress(event)" />
        <button class="send-btn" id="sendBtn" onclick="sendMessage()" disabled>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        </button>
    </div>
    <div class="powered-by">Powered by Virtus AI</div>

    <script>
        const config = {{
            widgetId: "{widget_id}",
            modelId: "{widget.model_id}",
            apiUrl: "{base_url}",
            welcomeMessage: "{widget.welcome_message or ''}"
        }};

        let messages = [];
        let conversationId = null;
        let isLoading = false;

        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('input');
        const sendBtn = document.getElementById('sendBtn');

        // Show welcome message
        if (config.welcomeMessage) {{
            addMessage('assistant', config.welcomeMessage);
        }}

        inputEl.addEventListener('input', () => {{
            sendBtn.disabled = !inputEl.value.trim() || isLoading;
        }});

        function handleKeyPress(e) {{
            if (e.key === 'Enter' && !e.shiftKey) {{
                e.preventDefault();
                sendMessage();
            }}
        }}

        function addMessage(role, content) {{
            messages.push({{ role, content }});
            const div = document.createElement('div');
            div.className = 'message ' + role;
            div.textContent = content;
            messagesEl.appendChild(div);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }}

        function showTyping() {{
            const div = document.createElement('div');
            div.className = 'typing';
            div.id = 'typing';
            div.innerHTML = '<span>...</span>';
            messagesEl.appendChild(div);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }}

        function hideTyping() {{
            const typing = document.getElementById('typing');
            if (typing) typing.remove();
        }}

        async function sendMessage() {{
            const content = inputEl.value.trim();
            if (!content || isLoading) return;

            isLoading = true;
            inputEl.value = '';
            sendBtn.disabled = true;
            addMessage('user', content);
            showTyping();

            try {{
                const response = await fetch(config.apiUrl + '/api/v1/chat/completions', {{
                    method: 'POST',
                    headers: {{
                        'Content-Type': 'application/json',
                    }},
                    body: JSON.stringify({{
                        model_id: config.modelId,
                        messages: messages.map(m => ({{ role: m.role, content: m.content }})),
                        conversation_id: conversationId,
                    }}),
                }});

                const data = await response.json();
                if (response.ok) {{
                    conversationId = data.conversation_id;
                    hideTyping();
                    addMessage('assistant', data.content);
                }} else {{
                    hideTyping();
                    addMessage('assistant', 'Sorry, an error occurred: ' + (data.detail || 'Unknown error'));
                }}
            }} catch (error) {{
                hideTyping();
                addMessage('assistant', 'Sorry, a connection error occurred. Please try again.');
            }} finally {{
                isLoading = false;
                sendBtn.disabled = !inputEl.value.trim();
            }}
        }}
    </script>
</body>
</html>"""
    return HTMLResponse(content=html)


class EmbedCodeResponse(BaseModel):
    html: str
    npm: str
    react: str
    api_curl: str
    python_sdk: str
    js_sdk: str


@router.get("/{widget_id}/embed-code", response_model=EmbedCodeResponse)
async def get_embed_code(
    widget_id: UUID,
    request: Request,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get all embed code options for a widget"""
    result = await db.execute(
        select(WidgetConfig).where(
            WidgetConfig.id == widget_id,
            WidgetConfig.organization_id == current_user.org_id,
        )
    )
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget not found")

    base_url = str(request.base_url).rstrip("/")
    theme = widget.theme or {}

    html_code = f'''<!-- Virtus AI Chat Widget -->
<script src="{base_url}/api/v1/widgets/{widget_id}/embed.js"></script>'''

    npm_code = f'''// Install the package
npm install @virtus/widget

// In your JavaScript/TypeScript file
import {{ VirtusWidget }} from '@virtus/widget';

VirtusWidget.init({{
  widgetId: '{widget_id}',
  apiUrl: '{base_url}',
  // Optional: customize theme
  theme: {{
    primaryColor: '{theme.get("primaryColor", "#0078d4")}',
    backgroundColor: '{theme.get("backgroundColor", "#ffffff")}',
    textColor: '{theme.get("textColor", "#333333")}',
  }},
}});'''

    react_code = f'''// Install the package
npm install @virtus/react

// In your React component
import {{ VirtusChatWidget }} from '@virtus/react';

function App() {{
  return (
    <VirtusChatWidget
      widgetId="{widget_id}"
      apiUrl="{base_url}"
      position="{widget.position}"
      theme={{{{
        primaryColor: '{theme.get("primaryColor", "#0078d4")}',
      }}}}
    />
  );
}}'''

    api_curl = f'''# Chat Completion
curl -X POST {base_url}/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{{
    "model_id": "{widget.model_id}",
    "messages": [
      {{"role": "user", "content": "Hello!"}}
    ]
  }}'

# Streaming Response
curl -X POST {base_url}/api/v1/chat/completions/stream \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{{
    "model_id": "{widget.model_id}",
    "messages": [
      {{"role": "user", "content": "Hello!"}}
    ]
  }}'
'''

    python_sdk = f'''# Install the SDK
pip install virtus-ai

# Use the SDK
from virtus import VirtusClient

client = VirtusClient(
    api_key="YOUR_API_KEY",
    base_url="{base_url}"
)

# Simple chat
response = client.chat.complete(
    model_id="{widget.model_id}",
    messages=[
        {{"role": "user", "content": "Hello!"}}
    ]
)
print(response.content)

# Streaming
for chunk in client.chat.stream(
    model_id="{widget.model_id}",
    messages=[{{"role": "user", "content": "Hello!"}}]
):
    print(chunk, end="", flush=True)
'''

    js_sdk = f'''// Install the SDK
npm install @virtus/sdk

// Use the SDK
import {{ VirtusClient }} from '@virtus/sdk';

const client = new VirtusClient({{
  apiKey: 'YOUR_API_KEY',
  baseUrl: '{base_url}',
}});

// Simple chat
const response = await client.chat.complete({{
  modelId: '{widget.model_id}',
  messages: [
    {{ role: 'user', content: 'Hello!' }}
  ],
}});
console.log(response.content);

// Streaming
for await (const chunk of client.chat.stream({{
  modelId: '{widget.model_id}',
  messages: [{{ role: 'user', content: 'Hello!' }}],
}})) {{
  process.stdout.write(chunk);
}}
'''

    return EmbedCodeResponse(
        html=html_code,
        npm=npm_code,
        react=react_code,
        api_curl=api_curl,
        python_sdk=python_sdk,
        js_sdk=js_sdk,
    )
