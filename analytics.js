// Analytics module for TypeRush
// Handles error tracking, performance graphing, and highlight insights

/**
 * Render the error detail table
 * @param {Array} errors - Array of error objects {typed, expected, position, time}
 * @param {HTMLElement} container - Container element for the table
 */
export function renderErrorTable(errors, container) {
  if (!container) return;

  if (!errors || errors.length === 0) {
    container.innerHTML = `
      <div class="analytics-empty">
        <i class="fas fa-check-circle"></i>
        <p>Tidak ada kesalahan! Sempurna! 🎉</p>
      </div>
    `;
    return;
  }

  const rows = errors.slice(0, 50).map((err, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="error-char typed">${escapeHtml(err.typed || '⎵')}</span></td>
      <td><span class="error-char expected">${escapeHtml(err.expected || '⎵')}</span></td>
      <td>${err.position}</td>
      <td>${err.time.toFixed(1)}s</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="error-detail-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Diketik</th>
          <th>Seharusnya</th>
          <th>Posisi</th>
          <th>Waktu</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/**
 * Render WPM performance graph using Canvas API
 * @param {Array} wpmData - Array of {time, wpm, errors} per interval
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
export function renderPerformanceGraph(wpmData, canvas) {
  if (!canvas || !wpmData || wpmData.length < 2) {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#64748b';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Data tidak cukup untuk grafik', canvas.width / 2, canvas.height / 2);
    }
    return;
  }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 30, right: 20, bottom: 40, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Get theme colors
  const style = getComputedStyle(document.documentElement);
  const accentColor = style.getPropertyValue('--accent').trim() || '#00d4ff';
  const errorColor = style.getPropertyValue('--error').trim() || '#ef4444';
  const textColor = style.getPropertyValue('--text-secondary').trim() || '#94a3b8';
  const mutedColor = style.getPropertyValue('--text-muted').trim() || '#64748b';
  const gridColor = style.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.08)';

  ctx.clearRect(0, 0, width, height);

  // Calculate ranges
  const maxWpm = Math.max(...wpmData.map(d => d.wpm), 10);
  const maxTime = Math.max(...wpmData.map(d => d.time), 1);
  const maxErrors = Math.max(...wpmData.map(d => d.errors), 1);

  const yMax = Math.ceil(maxWpm / 10) * 10 + 10;

  // Draw grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padding.top + (chartH / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();

    // Y-axis labels
    const val = Math.round(yMax - (yMax / gridSteps) * i);
    ctx.fillStyle = mutedColor;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val.toString(), padding.left - 8, y + 4);
  }

  // X-axis labels
  const xSteps = Math.min(wpmData.length, 10);
  const xInterval = Math.max(1, Math.floor(wpmData.length / xSteps));
  ctx.textAlign = 'center';
  for (let i = 0; i < wpmData.length; i += xInterval) {
    const x = padding.left + (i / (wpmData.length - 1)) * chartW;
    ctx.fillStyle = mutedColor;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(`${wpmData[i].time}s`, x, height - padding.bottom + 20);
  }

  // Helper: data point to canvas coords
  function toX(i) {
    return padding.left + (i / (wpmData.length - 1)) * chartW;
  }
  function toY(wpm) {
    return padding.top + chartH - (wpm / yMax) * chartH;
  }

  // Draw error bars (background)
  wpmData.forEach((d, i) => {
    if (d.errors > 0) {
      const x = toX(i);
      const barH = (d.errors / maxErrors) * (chartH * 0.3);
      ctx.fillStyle = errorColor + '30';
      ctx.fillRect(x - 3, padding.top + chartH - barH, 6, barH);
    }
  });

  // Draw WPM line with gradient fill
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(wpmData[0].wpm));
  for (let i = 1; i < wpmData.length; i++) {
    const prevX = toX(i - 1);
    const prevY = toY(wpmData[i - 1].wpm);
    const currX = toX(i);
    const currY = toY(wpmData[i].wpm);
    const cpX = (prevX + currX) / 2;
    ctx.bezierCurveTo(cpX, prevY, cpX, currY, currX, currY);
  }

  // Fill area under curve
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
  gradient.addColorStop(0, accentColor + '40');
  gradient.addColorStop(1, accentColor + '05');
  ctx.lineTo(toX(wpmData.length - 1), padding.top + chartH);
  ctx.lineTo(toX(0), padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw the line itself
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(wpmData[0].wpm));
  for (let i = 1; i < wpmData.length; i++) {
    const prevX = toX(i - 1);
    const prevY = toY(wpmData[i - 1].wpm);
    const currX = toX(i);
    const currY = toY(wpmData[i].wpm);
    const cpX = (prevX + currX) / 2;
    ctx.bezierCurveTo(cpX, prevY, cpX, currY, currX, currY);
  }
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Draw data points
  wpmData.forEach((d, i) => {
    const x = toX(i);
    const y = toY(d.wpm);

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = d.errors > 0 ? errorColor : accentColor;
    ctx.fill();
    ctx.strokeStyle = d.errors > 0 ? errorColor : accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Axis labels
  ctx.fillStyle = textColor;
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Waktu (detik)', width / 2, height - 4);

  ctx.save();
  ctx.translate(14, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('WPM', 0, 0);
  ctx.restore();

  // Legend
  const legendY = 14;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'left';

  // WPM legend
  ctx.fillStyle = accentColor;
  ctx.fillRect(padding.left, legendY - 6, 12, 3);
  ctx.fillStyle = textColor;
  ctx.fillText('WPM', padding.left + 16, legendY);

  // Error legend
  ctx.fillStyle = errorColor + '50';
  ctx.fillRect(padding.left + 60, legendY - 8, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Errors', padding.left + 74, legendY);
}

/**
 * Calculate and render performance highlights
 * @param {Array} wpmData - Array of {time, wpm, errors}
 * @param {Array} errorLog - Array of error objects
 * @param {HTMLElement} container - Container element
 */
export function renderHighlights(wpmData, errorLog, container) {
  if (!container) return;

  if (!wpmData || wpmData.length < 2) {
    container.innerHTML = `
      <div class="analytics-empty">
        <i class="fas fa-chart-line"></i>
        <p>Data tidak cukup untuk analisis</p>
      </div>
    `;
    return;
  }

  // Find fastest section
  let fastestIdx = 0;
  let fastestWpm = 0;
  wpmData.forEach((d, i) => {
    if (d.wpm > fastestWpm) {
      fastestWpm = d.wpm;
      fastestIdx = i;
    }
  });

  // Find slowest section
  let slowestIdx = 0;
  let slowestWpm = Infinity;
  wpmData.forEach((d, i) => {
    if (d.wpm < slowestWpm && d.wpm > 0) {
      slowestWpm = d.wpm;
      slowestIdx = i;
    }
  });
  if (slowestWpm === Infinity) slowestWpm = 0;

  // Find second with most errors
  let maxErrorSec = 0;
  let maxErrorCount = 0;
  const errorBySec = {};
  if (errorLog && errorLog.length > 0) {
    errorLog.forEach(err => {
      const sec = Math.floor(err.time);
      errorBySec[sec] = (errorBySec[sec] || 0) + 1;
      if (errorBySec[sec] > maxErrorCount) {
        maxErrorCount = errorBySec[sec];
        maxErrorSec = sec;
      }
    });
  }

  container.innerHTML = `
    <div class="highlight-card highlight-fast">
      <div class="highlight-icon"><i class="fas fa-bolt"></i></div>
      <div class="highlight-info">
        <div class="highlight-label">Bagian Tercepat</div>
        <div class="highlight-value">${fastestWpm} WPM</div>
        <div class="highlight-detail">pada detik ke-${wpmData[fastestIdx].time}</div>
      </div>
    </div>
    <div class="highlight-card highlight-slow">
      <div class="highlight-icon"><i class="fas fa-turtle"></i></div>
      <div class="highlight-info">
        <div class="highlight-label">Bagian Terlambat</div>
        <div class="highlight-value">${slowestWpm} WPM</div>
        <div class="highlight-detail">pada detik ke-${wpmData[slowestIdx].time}</div>
      </div>
    </div>
    <div class="highlight-card highlight-error">
      <div class="highlight-icon"><i class="fas fa-circle-exclamation"></i></div>
      <div class="highlight-info">
        <div class="highlight-label">Error Terbanyak</div>
        <div class="highlight-value">${maxErrorCount} error${maxErrorCount !== 1 ? 's' : ''}</div>
        <div class="highlight-detail">${maxErrorCount > 0 ? `pada detik ke-${maxErrorSec}` : 'Tidak ada error!'}</div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}