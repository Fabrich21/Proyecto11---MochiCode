/**
 * Motor de reglas para calcular la criticidad/prioridad de un incidente
 * basándose en su origen (sistema).
 */
export class PriorityRulesEngine {
  /**
   * Mapeo estático de sistemas a niveles de prioridad.
   */
  private static readonly REGLAS_ORIGEN: Record<string, string> = {
    'P1': 'CRITICA', // Ejemplo: Salud / Core
    'P2': 'ALTA',    // Ejemplo: Logística
    'P8': 'BAJA',    // Ejemplo: IoT
  };

  /**
   * Calcula la prioridad asignada a un webhook.
   * La prioridad inferida sobrescribe incondicionalmente cualquier prioridad explícita del payload.
   *
   * @param sistemaId Identificador del sistema de origen
   * @param payload El payload original del webhook (para futuras reglas complejas)
   * @returns Nivel de prioridad asignado
   */
  static calcularPrioridad(sistemaId: string, payload?: any): string {
    // Si el origen tiene una regla definida, la retornamos
    const regla = this.REGLAS_ORIGEN[sistemaId?.toUpperCase()];
    
    if (regla) {
      return regla;
    }

    // Default si no hay regla específica para el origen
    return 'MEDIA';
  }
}
