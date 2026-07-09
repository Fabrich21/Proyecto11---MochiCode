// apps/frontend/src/hooks/incidentes/usePostMortem.ts
import { useState, useCallback } from 'react';
import { PostMortem } from '@/components/incident-types';
import { useAuth } from '@/context/useAuth';

export function usePostMortem() {
  const keycloak = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener un post-mortem por ID
  const getPostMortem = useCallback(async (id: string): Promise<PostMortem | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/post-mortems/${id}`, {
        headers: {
          Authorization: `Bearer ${keycloak?.token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Error al obtener post-mortem');
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return null;
    } finally {
      setLoading(false);
    }
  }, [keycloak?.token]);

  // Obtener post-mortems de un incidente
  const getPostMortemsByIncident = useCallback(async (incidentId: string): Promise<PostMortem[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/post-mortems?incidentId=${incidentId}`, {
        headers: {
          Authorization: `Bearer ${keycloak?.token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Error al obtener post-mortems');
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      return [];
    } finally {
      setLoading(false);
    }
  }, [keycloak?.token]);

  // Crear un post-mortem
  const createPostMortem = useCallback(async (data: Partial<PostMortem>): Promise<PostMortem> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/post-mortems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak?.token || ''}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al crear post-mortem');
      }
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak?.token]);

  // Actualizar un post-mortem
  const updatePostMortem = useCallback(async (id: string, data: Partial<PostMortem>): Promise<PostMortem> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/post-mortems/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak?.token || ''}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al actualizar post-mortem');
      }
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak?.token]);

  // Eliminar un post-mortem
  const deletePostMortem = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/post-mortems/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${keycloak?.token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Error al eliminar post-mortem');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak?.token]);

  return {
    loading,
    error,
    getPostMortem,
    getPostMortemsByIncident,
    createPostMortem,
    updatePostMortem,
    deletePostMortem,
  };
}