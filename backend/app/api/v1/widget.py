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
    model_id: UUID
    name: str
    theme: dict
    position: str
    welcome_message: str
    placeholder_text: str
    allowed_domains: List[str]
    logo_url: str
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

    script = f"""
(function() {{
  var config = {{
    widgetId: "{widget_id}",
    apiUrl: "{base_url}",
    theme: {widget.theme},
    position: "{widget.position}",
    title: "{widget.title}",
    welcomeMessage: "{widget.welcome_message or ''}",
    placeholder: "{widget.placeholder_text}"
  }};

  var iframe = document.createElement('iframe');
  iframe.src = "{base_url}/widget/{widget_id}/frame";
  iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:400px;height:600px;border:none;z-index:9999;display:none;';
  iframe.id = 'virtus-chat-widget';
  document.body.appendChild(iframe);

  var button = document.createElement('button');
  button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  button.style.cssText = 'position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;background:#0078d4;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9998;display:flex;align-items:center;justify-content:center;';
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
