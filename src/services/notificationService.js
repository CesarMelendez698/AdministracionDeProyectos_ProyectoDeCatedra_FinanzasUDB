/**
 * Servicio de alertas y recordatorios.
 * Optimizado para ser 100% compatible con Expo Go en Android (SDK 53+),
 * donde las notificaciones push del sistema operativo fueron retiradas de Expo Go
 * y requieren un Development Build.
 */

export async function requestNotificationPermissions() {
  return true;
}

export async function syncClassNotifications(scheduleList) {
  // En Expo Go, el widget "Próxima Clase Hoy" en el Dashboard se encarga
  // de alertar al estudiante en tiempo real sin requerir Development Build.
  return Promise.resolve();
}

export async function sendBudgetAlertNotification(categoryName, percentage, spent, limit) {
  return Promise.resolve();
}
