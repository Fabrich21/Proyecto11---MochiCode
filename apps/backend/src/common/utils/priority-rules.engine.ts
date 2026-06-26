/**
 * Motor de reglas para calcular la criticidad/prioridad de un incidente
 * basándose en su origen (sistema).
 */
export class PriorityRulesEngine {
  /**
   * Mapeo estático de sistemas a su Trust Level (Nivel Máximo de Confianza).
   * Define hasta qué nivel de prioridad le permitimos a un sistema declarar.
   */
  private static readonly TRUST_LEVELS: Record<string, string> = {
    'P1': 'CRITICA', // P1 puede emitir hasta CRITICA
    'P2': 'ALTA',    // P2 puede emitir hasta ALTA
    'P4': 'ALTA',    // Pagos puede emitir hasta ALTA
    'P7': 'CRITICA', // CRM (P07) es confiable, puede emitir CRITICA
    'P07': 'CRITICA', // Alias para P7
    'P8': 'BAJA',    // IoT solo puede emitir BAJA (sin importar lo que sugiera)
    'P9': 'MEDIA',   // Analítica hasta MEDIA
    'P12': 'ALTA',   // SSO hasta ALTA
  };

  private static readonly PRIORIDAD_PESO: Record<string, number> = {
    'CRITICA': 4,
    'ALTA': 3,
    'MEDIA': 2,
    'BAJA': 1,
  };

  /**
   * Calcula la prioridad asignada a un webhook usando Trust Levels.
   *
   * @param sistemaId Identificador del sistema de origen
   * @param prioridadSugerida Prioridad inferida por el Normalizador
   * @returns Nivel de prioridad final asignado
   */
  static calcularPrioridad(sistemaId: string, prioridadSugerida?: string): string {
    const sugerida = (prioridadSugerida || 'MEDIA').toUpperCase();
    const maxTrust = this.TRUST_LEVELS[sistemaId?.toUpperCase()] || 'MEDIA';

    const pesoSugerido = this.PRIORIDAD_PESO[sugerida] || 2;
    const pesoMaximo = this.PRIORIDAD_PESO[maxTrust] || 2;

    // Si la sugerida es menor o igual a su Trust Level, se la respetamos.
    // Si intenta pedir más prioridad de la que tiene permitida, la limitamos a su Max Trust.
    return pesoSugerido <= pesoMaximo ? sugerida : maxTrust;
  }
}
