import { NextResponse } from 'next/server';
import { listIncidents, createIncident } from '../_incidentsStore';

const BACKEND_URL = process.env.BACKEND_URL || '';

function normalizeSystemId(systemId?: string) {
  const value = (systemId || '').trim().toUpperCase();
  const match = value.match(/^P(\d+)$/);

  if (!match) {
    return value;
  }

  return `P${match[1].padStart(2, '0')}`;
}

function getApiKeyForSystem(systemId?: string) {
  const normalizedSystemId = normalizeSystemId(systemId);
  if (!normalizedSystemId) {
    return '';
  }

  const envKeyName = `API_KEY_${normalizedSystemId}`;
  return process.env[envKeyName] || '';
}

async function fetchAllBackendIncidents(baseUrl: string, authHeader: string | null) {
  const allItems: any[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/incidentes`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '100');

    const res = await fetch(url.toString(), { 
      cache: 'no-store',
      headers: {
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    });

    if (!res.ok) {
      throw new Error(`backend_error_${res.status}`);
    }

    const json = await res.json();
    const items: any[] = Array.isArray(json) ? json : (json.data ?? []);
    allItems.push(...items);

    const meta = Array.isArray(json) ? null : json.meta;
    totalPages = meta?.total_paginas ?? page;
    page += 1;
  } while (page <= totalPages);

  return allItems;
}

function mapBackendToFrontend(inc: any) {
  const prioridad = String(inc.prioridad ?? inc.priority ?? inc.severity ?? 'MEDIA').toUpperCase();
  const severity: 'critical' | 'high' | 'medium' =
    prioridad === 'CRITICA' || prioridad === 'CRITICAL' || prioridad === 'URGENTE'
      ? 'critical'
      : prioridad === 'ALTA' || prioridad === 'HIGH'
      ? 'high'
      : 'medium';

  let slaRemaining = 0;
  let slaPercentage = 0;
  let slaTargetMinutes = 60; // Fallback default

  if (inc.fechaLimiteResolucion) {
    const now = new Date();
    const limite = new Date(inc.fechaLimiteResolucion);
    slaRemaining = Math.max(0, Math.round((limite.getTime() - now.getTime()) / 60000));
    
    // Si la politicaSla viene poblada desde el backend
    if (inc.politicaSla?.tiempoMaximoResolucionMinutos) {
      slaTargetMinutes = inc.politicaSla.tiempoMaximoResolucionMinutos;
    }
    const elapsedMinutes = slaTargetMinutes - slaRemaining;
    slaPercentage = Math.round((elapsedMinutes / slaTargetMinutes) * 100);
    slaPercentage = Math.min(100, Math.max(0, slaPercentage));
  }

  return {
    id: inc.id,
    title: inc.titulo || `Incidente ${inc.id}`,
    system: inc.sistemaId || inc.sistema_id || inc.system || 'Desconocido',
    description: inc.descripcion || inc.titulo || 'Sin descripción',
    resolutionSummary: inc.resolutionSummary || inc.resolucion || inc.solucion || inc.solution || null,
    severity,
    incidentStatus: inc.estado ?? 'ABIERTO',
    createdAt: inc.creadoEn ?? inc.createdAt ?? new Date().toISOString(),
    slaRemaining,
    slaPercentage,
    affectedProject: inc.sistemaId ?? inc.affectedProject ?? null,
    affectedUsers: inc.affectedUsers ?? null,
    acknowledgedAt: inc.acknowledgedAt ?? null,
    resolvedAt: inc.fechaResolucion ?? inc.resolvedAt ?? null,
    closedAt:
      inc.estado === 'CERRADO'
        ? (inc.fechaResolucion ?? new Date().toISOString())
        : (inc.closedAt ?? null),
    slaTargetMinutes,
  };
}

// ─── GET /api/incidents ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  if (BACKEND_URL) {
    try {
      const authHeader = request.headers.get('Authorization');
      const items = await fetchAllBackendIncidents(BACKEND_URL, authHeader);
      
      return NextResponse.json(items.map(mapBackendToFrontend));
    } catch (err) {
      console.error('[GET /api/incidents] Error conectando al backend:', err);
      return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
    }
  }

  // Fallback mock
  return NextResponse.json(listIncidents());
}

// ─── POST /api/incidents ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  if (BACKEND_URL) {
    try {
      const body = await request.json();
      const authHeader = request.headers.get('Authorization');
      const sistemaId = normalizeSystemId(body.sistemaId || body.sistema_id || body.system);
      const apiKey = getApiKeyForSystem(sistemaId);

      console.log('[POST /api/incidents] Payload:', JSON.stringify(body, null, 2));
      console.log('[POST /api/incidents] BACKEND_URL:', BACKEND_URL);

      let url, res;

      if (apiKey) {
        // Usa la lógica de la compañera (Ingestión vía máquina)
        url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/alertas`;
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            sistema_id: sistemaId,
            creado_en: body.detectedAt || new Date().toISOString(),
            payload: {
              titulo: body.titulo,
              descripcion: body.descripcion,
              prioridad: body.prioridad,
            },
          }),
        });
      } else {
        // Fallback: Usa la lógica directa con JWT.
        // El backend usa ValidationPipe con forbidNonWhitelisted: true, por lo que
        // solo se deben enviar los campos declarados en CreateIncidenteDto. Enviar
        // campos extra (p.ej. detectedAt) provoca un 400 "property should not exist".
        url = `${BACKEND_URL.replace(/\/$/, '')}/api/v1/incidentes`;

        const cleanPayload: Record<string, unknown> = {
          titulo: body.titulo,
          descripcion: body.descripcion,
          sistemaId,
          creadorUsuarioId: body.creadorUsuarioId,
          prioridad: body.prioridad,
        };

        if (body.estado) {
          cleanPayload.estado = body.estado;
        }
        if (body.asignadoAUsuarioId) {
          cleanPayload.asignadoAUsuarioId = body.asignadoAUsuarioId;
        }

        res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(authHeader ? { 'Authorization': authHeader } : {})
          },
          body: JSON.stringify(cleanPayload),
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        return NextResponse.json(
          { error: 'backend_error', status: res.status, detail: errorText },
          { status: res.status },
        );
      }

      return NextResponse.json({ accepted: true }, { status: res.status });
    } catch (err) {
      console.error('[POST /api/incidents] Error:', err);
      return NextResponse.json({ error: 'connection_failed' }, { status: 502 });
    }
  }

  try {
    const body = await request.json();
    const created = createIncident({
      ...body,
      system: body.sistemaId || body.sistema_id || body.system,
      severity:
        String(body.prioridad || body.severity || '').toUpperCase() === 'CRITICA' || String(body.prioridad || body.severity || '').toUpperCase() === 'CRITICAL' || String(body.prioridad || body.severity || '').toUpperCase() === 'URGENTE'
          ? 'critical'
          : String(body.prioridad || body.severity || '').toUpperCase() === 'ALTA' || String(body.prioridad || body.severity || '').toUpperCase() === 'HIGH'
            ? 'high'
            : 'medium',
      description: body.descripcion || body.description || '',
      resolutionSummary: body.resolutionSummary || body.resolucion || body.solucion || body.solution || null,
      affectedProject: body.sistemaId || body.sistema_id || body.affectedProject,
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }
}