import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UseWebSocketsOptions {
  room?: string;
  onNuevoIncidente?: (incidente: any) => void;
  onIncidenteActualizado?: (data: any) => void;
  onEstadoActualizado?: (data: any) => void;
}

export const useWebSockets = (options: UseWebSocketsOptions = {}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Inicializar la conexión
    const socketInstance = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'], // Priorizar websocket
      reconnectionAttempts: Infinity, // Reintentar siempre si se cae el backend
      reconnectionDelay: 1000,
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Conectado al servidor WebSocket:', socketInstance.id);
      
      // Si hay una sala configurada, unirse a ella inmediatamente
      if (options.room) {
        socketInstance.emit('joinRoom', options.room);
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Desconectado del servidor WebSocket');
    });

    // Registrar listeners si fueron provistos
    if (options.onNuevoIncidente) {
      socketInstance.on('nuevo_incidente', options.onNuevoIncidente);
    }
    if (options.onIncidenteActualizado) {
      socketInstance.on('incidente_actualizado', options.onIncidenteActualizado);
    }
    if (options.onEstadoActualizado) {
      socketInstance.on('estado_actualizado', options.onEstadoActualizado);
    }

    // Cleanup al desmontar el componente
    return () => {
      if (options.room) {
        socketInstance.emit('leaveRoom', options.room);
      }
      socketInstance.disconnect();
    };
  }, []); // Dependencias vacías para instanciar solo una vez al montar

  // Función para forzar la unión manual a una sala
  const joinRoom = useCallback((room: string) => {
    if (socket) {
      socket.emit('joinRoom', room);
    }
  }, [socket]);

  // Función para abandonar manual
  const leaveRoom = useCallback((room: string) => {
    if (socket) {
      socket.emit('leaveRoom', room);
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
  };
};
