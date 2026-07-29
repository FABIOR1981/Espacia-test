// TimeIndicator.js — Línea de tiempo actual para agenda
// Uso: importar y llamar initTimeIndicator(agendaContainer, slotHeight)

function initTimeIndicator(agendaContainer, slotHeight = 50) {
  const startHour = 8;
  const endHour = 21;
  const intervalMinutes = 30;
  const indicatorId = 'time-indicator';

  // Crear el elemento si no existe
  let indicator = document.getElementById(indicatorId);
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = indicatorId;
    indicator.style.position = 'absolute';
    indicator.style.left = '0';
    indicator.style.width = '100%';
    indicator.style.height = '1.5px';
    indicator.style.background = 'red';
    indicator.style.zIndex = '10';
    indicator.style.pointerEvents = 'none';
    // Círculo/etiqueta
    const label = document.createElement('div');
    label.id = 'time-indicator-label';
    label.style.position = 'absolute';
    label.style.left = '0';
    label.style.top = '-8px';
    label.style.width = '48px';
    label.style.height = '18px';
    label.style.background = 'white';
    label.style.borderRadius = '9px';
    label.style.border = '1px solid red';
    label.style.color = 'red';
    label.style.fontSize = '12px';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.justifyContent = 'center';
    label.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
    indicator.appendChild(label);
    agendaContainer.appendChild(indicator);
  }

  function updateIndicator() {
      // Hora real de Montevideo
      const now = new Date();
      const dtf = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Montevideo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = dtf.formatToParts(now);
      const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
      const minutes = parseInt(parts.find(p => p.type === 'minute').value, 10);
      // Validación: fuera de rango
      if (hour < startHour || hour >= endHour) {
        indicator.style.display = 'none';
        return;
      }
      indicator.style.display = 'block';
      // Buscar slot base
      const baseLabel = `${hour.toString().padStart(2, '0')}:00`;
      const slotElem = agendaContainer.querySelector(`.grid-slot[data-time="${baseLabel}"]`);
      if (!slotElem) {
        indicator.style.display = 'none';
        return;
      }
      // Altura de una hora (dos slots de 30min)
      const alturaHora = slotElem.offsetHeight * 2;
      // Cálculo de precisión
      const top = slotElem.offsetTop + (minutes * (alturaHora / 60));
      indicator.style.top = `${top}px`;
      // Actualizar etiqueta
      const label = indicator.querySelector('#time-indicator-label');
      label.textContent = `Ahora ${hour.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}`;
    }

  updateIndicator();
  setInterval(updateIndicator, 60000);
}

// Exportar para uso
window.initTimeIndicator = initTimeIndicator;
