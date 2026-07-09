// apps/frontend/src/app/api/post-mortems/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';

// GET - Obtener un post-mortem por ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get('Authorization');

    const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/v1/post-mortems/${id}`, {
      cache: 'no-store',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.error('[GET /api/post-mortems/[id]] Error:', res.status);
      return NextResponse.json(
        { error: 'Error al obtener post-mortem' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[GET /api/post-mortems/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Error de conexión con el backend' },
      { status: 502 }
    );
  }
}

// PUT - Actualizar un post-mortem
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const authHeader = request.headers.get('Authorization');

    const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/v1/post-mortems/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[PUT /api/post-mortems/[id]] Error:', res.status, errorText);
      return NextResponse.json(
        { error: 'Error al actualizar post-mortem', detail: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PUT /api/post-mortems/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Error de conexión con el backend' },
      { status: 502 }
    );
  }
}

// DELETE - Eliminar un post-mortem
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get('Authorization');

    const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/v1/post-mortems/${id}`, {
      method: 'DELETE',
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!res.ok) {
      console.error('[DELETE /api/post-mortems/[id]] Error:', res.status);
      return NextResponse.json(
        { error: 'Error al eliminar post-mortem' },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/post-mortems/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Error de conexión con el backend' },
      { status: 502 }
    );
  }
}