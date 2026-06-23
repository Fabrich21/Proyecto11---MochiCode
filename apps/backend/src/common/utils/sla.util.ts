/**
 * Utilidad para cálculos de Service Level Agreement (SLA).
 */
export class SlaUtil {
  /**
   * Calcula la fecha límite de resolución sumando horas naturales (24/7).
   * @param creadoEn Fecha de creación del incidente
   * @param minutosMaximos Tiempo máximo de resolución en minutos
   * @returns Nueva fecha con los minutos sumados
   */
  static calcularFechaLimiteResolucion(creadoEn: Date, minutosMaximos: number): Date {
    const msMaximos = minutosMaximos * 60 * 1000;
    return new Date(creadoEn.getTime() + msMaximos);
  }
}
