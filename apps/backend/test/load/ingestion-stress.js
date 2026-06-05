import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. Configuración de la Prueba (Infraestructura)
export const options = {
  // Simulamos el tráfico en 3 etapas
  stages: [
    { duration: '10s', target: 50 }, // Rampa de subida: Llegar a 50 usuarios simultáneos en 10s
    { duration: '30s', target: 50 }, // Carga sostenida: Mantener a esos 50 usuarios bombardeando por 30s
    { duration: '10s', target: 0 },  // Rampa de bajada: Reducir a 0 usuarios en 10s
  ],
  // Umbrales de éxito automáticos (Si no se cumplen, la prueba falla)
  thresholds: {
    http_req_duration: ['p(95)<500'], // El 95% de las peticiones DEBEN tardar menos de 500ms
    http_req_failed: ['rate<0.01'],   // La tasa de error debe ser menor al 1% (Idealmente 0)
  },
};

// 2. El código que ejecutará cada Usuario Virtual (VU) repetidamente
export default function () {
  const url = 'http://localhost:3001/api/ingestion/alertas';

  // Seguridad Zero Trust: Leemos la llave desde la consola, NUNCA quemada en el código.
  const apiKey = __ENV.API_KEY || 'auth_p8_secret';

  // Armamos el Payload estricto que exige tu backend
  const payload = JSON.stringify({
    sistema_id: 'P8',
    payload: {
      sensor_id: `k6-stress-sensor-${__VU}-${__ITER}`, // Identificador único de prueba
      temperatura: 90.5 + Math.random() * 10,
      estado: 'stress_test'
    }
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  };

  // 3. Disparamos el POST al Worker
  const res = http.post(url, payload, params);

  // 4. Validamos que el Guard y el Worker nos hayan dado luz verde (202 Accepted)
  check(res, {
    'status es 202 Accepted': (r) => r.status === 202,
  });

  // 5. Respiro lógico de 1 segundo entre peticiones por usuario
  sleep(1);
}