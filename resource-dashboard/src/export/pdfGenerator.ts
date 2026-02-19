import type jsPDF from 'jspdf';

// ── Interfaces ──

export interface PDFExportOptions {
  teamName: string;
  month: string;               // "2026-01"
  monthLabel: string;          // "January 2026"
  generatedDate: string;       // "Feb 18, 2026"

  // Section toggles
  includeKPISummary: boolean;
  includeNarrative: boolean;
  includeAlerts: boolean;
  includeCharts: string[];     // panel IDs to include

  // Data
  kpiCards: { label: string; value: string; color: 'green' | 'yellow' | 'red' | 'neutral' }[];
  narrativeText: string;
  narrativeHighlights: string[];
  alerts: { title: string; detail: string; severity: 'alert' | 'warning' | 'info' }[];
  chartImages: { panelId: string; title: string; dataUrl: string; aspectRatio: number }[];
}

// ── Page Layout Constants ──

const PAGE = {
  width: 215.9,          // mm (8.5 inches)
  height: 279.4,         // mm (11 inches)
  marginTop: 16,
  marginBottom: 16,
  marginLeft: 12,
  marginRight: 12,
  get contentWidth() { return this.width - this.marginLeft - this.marginRight; },  // ~192mm
  get contentHeight() { return this.height - this.marginTop - this.marginBottom; }, // ~247mm
};

const COLORS = {
  primary: [37, 99, 235] as [number, number, number],
  textDark: [15, 23, 42] as [number, number, number],
  textMuted: [100, 116, 139] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  yellow: [202, 138, 4] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  greenBg: [240, 253, 244] as [number, number, number],
  yellowBg: [254, 252, 232] as [number, number, number],
  redBg: [254, 242, 242] as [number, number, number],
  neutralBg: [249, 250, 251] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const FONTS = {
  titleSize: 18,
  subtitleSize: 11,
  sectionHeaderSize: 13,
  bodySize: 10,
  smallSize: 8,
  kpiValueSize: 22,
  kpiLabelSize: 8,
};

// ── Main Export Function ──

export async function generateExecutivePDF(options: PDFExportOptions): Promise<jsPDF> {
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  let y = PAGE.marginTop;

  // 1. Header
  y = renderHeader(doc, y, options);

  // 2. KPI Summary
  if (options.includeKPISummary && options.kpiCards.length > 0) {
    y = checkPageBreak(doc, y, 50);
    y = renderKPISummary(doc, y, options.kpiCards);
  }

  // 3. Narrative
  if (options.includeNarrative && options.narrativeText) {
    y = checkPageBreak(doc, y, 40);
    y = renderNarrative(doc, y, options.narrativeText, options.narrativeHighlights);
  }

  // 4. Alerts
  if (options.includeAlerts && options.alerts.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = renderAlerts(doc, y, options.alerts);
  }

  // 5. Charts
  for (const chart of options.chartImages) {
    if (options.includeCharts.includes(chart.panelId)) {
      y = checkPageBreak(doc, y, 80);
      y = renderChart(doc, y, chart);
    }
  }

  // 6. Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    renderFooter(doc, i, pageCount, options);
  }

  return doc;
}

// ── Helper Functions ──

function checkPageBreak(doc: jsPDF, y: number, neededHeight: number): number {
  if (y + neededHeight > PAGE.height - PAGE.marginBottom) {
    doc.addPage();
    return PAGE.marginTop;
  }
  return y;
}

function renderHeader(doc: jsPDF, y: number, options: PDFExportOptions): number {
  // Team name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONTS.titleSize);
  doc.setTextColor(...COLORS.primary);
  doc.text(options.teamName || 'Engineering Team', PAGE.marginLeft, y + 6);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONTS.subtitleSize);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Monthly Resource Report', PAGE.marginLeft, y + 13);

  // Month label — right aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONTS.sectionHeaderSize);
  doc.setTextColor(...COLORS.textDark);
  const monthText = options.monthLabel;
  const monthWidth = doc.getTextWidth(monthText);
  doc.text(monthText, PAGE.width - PAGE.marginRight - monthWidth, y + 6);

  // Generated date — right aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONTS.smallSize);
  doc.setTextColor(...COLORS.textMuted);
  const dateText = `Generated ${options.generatedDate}`;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, PAGE.width - PAGE.marginRight - dateWidth, y + 13);

  // Horizontal line
  y += 17;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);

  return y + 8;
}

function renderKPISummary(
  doc: jsPDF,
  y: number,
  cards: PDFExportOptions['kpiCards']
): number {
  // Section title
  y = renderSectionTitle(doc, y, 'KPI Summary');

  const cardGap = 4;
  const cardsPerRow = 3;
  const cardWidth = (PAGE.contentWidth - (cardsPerRow - 1) * cardGap) / cardsPerRow;
  const cardHeight = 24;

  for (let i = 0; i < cards.length; i++) {
    const col = i % cardsPerRow;
    const row = Math.floor(i / cardsPerRow);

    // Check for page break at start of each new row
    if (col === 0 && row > 0) {
      y = checkPageBreak(doc, y, cardHeight + cardGap);
    }

    const x = PAGE.marginLeft + col * (cardWidth + cardGap);
    const cardY = y + row * (cardHeight + cardGap);
    const card = cards[i];

    // Card background
    const bgColor = getCardBgColor(card.color);
    doc.setFillColor(...bgColor);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'F');

    // Card border
    const borderColor = getCardBorderColor(card.color);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'S');

    // Card value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTS.kpiValueSize);
    doc.setTextColor(...getCardTextColor(card.color));
    doc.text(card.value, x + 6, cardY + 14);

    // Card label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONTS.kpiLabelSize);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(card.label, x + 6, cardY + 20);
  }

  const totalRows = Math.ceil(cards.length / cardsPerRow);
  return y + totalRows * (cardHeight + cardGap) + 6;
}

function renderNarrative(
  doc: jsPDF,
  y: number,
  text: string,
  highlights: string[]
): number {
  // Section title
  y = renderSectionTitle(doc, y, 'Monthly Summary');

  // Paragraph text with word-wrap
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONTS.bodySize);
  doc.setTextColor(...COLORS.textDark);
  const lines = doc.splitTextToSize(text, PAGE.contentWidth);
  const lineHeight = 4.5;

  for (const line of lines) {
    y = checkPageBreak(doc, y, lineHeight + 2);
    doc.text(line, PAGE.marginLeft, y);
    y += lineHeight;
  }

  // Highlight chips
  if (highlights.length > 0) {
    y += 3;
    let chipX = PAGE.marginLeft;
    const chipHeight = 6;
    const chipPadding = 3;
    const chipGap = 3;

    for (const h of highlights) {
      doc.setFontSize(7);
      const chipWidth = doc.getTextWidth(h) + chipPadding * 2;

      // Wrap to next line if needed
      if (chipX + chipWidth > PAGE.width - PAGE.marginRight) {
        chipX = PAGE.marginLeft;
        y += chipHeight + 2;
        y = checkPageBreak(doc, y, chipHeight + 2);
      }

      // Chip background
      doc.setFillColor(...COLORS.greenBg);
      doc.roundedRect(chipX, y - 4, chipWidth, chipHeight, 2, 2, 'F');

      // Chip text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.primary);
      doc.text(h, chipX + chipPadding, y);

      chipX += chipWidth + chipGap;
    }

    y += chipHeight;
  }

  return y + 8;
}

function renderAlerts(
  doc: jsPDF,
  y: number,
  alerts: PDFExportOptions['alerts']
): number {
  // Section title
  y = renderSectionTitle(doc, y, 'Key Alerts');

  const maxAlerts = Math.min(alerts.length, 8);

  for (let i = 0; i < maxAlerts; i++) {
    const alert = alerts[i];
    const alertHeight = 14;
    y = checkPageBreak(doc, y, alertHeight);

    // Left border color based on severity
    const borderColor = alert.severity === 'alert' ? COLORS.red
      : alert.severity === 'warning' ? COLORS.yellow
      : COLORS.primary;

    // Left border line
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(1.2);
    doc.line(PAGE.marginLeft, y, PAGE.marginLeft, y + alertHeight - 2);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONTS.bodySize);
    doc.setTextColor(...COLORS.textDark);
    doc.text(alert.title, PAGE.marginLeft + 5, y + 4);

    // Detail
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONTS.smallSize);
    doc.setTextColor(...COLORS.textMuted);
    const detailLines = doc.splitTextToSize(alert.detail, PAGE.contentWidth - 8);
    doc.text(detailLines[0] || '', PAGE.marginLeft + 5, y + 9);

    y += alertHeight;
  }

  return y + 6;
}

function renderChart(
  doc: jsPDF,
  y: number,
  chart: { panelId: string; title: string; dataUrl: string; aspectRatio: number }
): number {
  // Chart title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONTS.subtitleSize);
  doc.setTextColor(...COLORS.textDark);
  doc.text(chart.title, PAGE.marginLeft, y + 4);
  y += 8;

  // Fill the full page content width, derive height from the captured aspect ratio
  let imgWidth = PAGE.contentWidth;
  let imgHeight = imgWidth / chart.aspectRatio;

  // Cap height to the remaining printable area on this page (leave room for spacing)
  const maxHeight = PAGE.contentHeight - 10;
  if (imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = imgHeight * chart.aspectRatio;
  }

  // Page break if the image won't fit below current y
  y = checkPageBreak(doc, y, imgHeight + 4);

  // Add the image
  doc.addImage(chart.dataUrl, 'PNG', PAGE.marginLeft, y, imgWidth, imgHeight);

  return y + imgHeight + 10;
}

function renderFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  options: PDFExportOptions
): void {
  const footerY = PAGE.height - 12;

  // Left: generated date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONTS.smallSize);
  doc.setTextColor(...COLORS.textMuted);
  doc.text(`Generated on ${options.generatedDate}`, PAGE.marginLeft, footerY);

  // Right: page number
  const pageText = `Page ${pageNum} of ${totalPages}`;
  const pageWidth = doc.getTextWidth(pageText);
  doc.text(pageText, PAGE.width - PAGE.marginRight - pageWidth, footerY);
}

// ── Shared Helpers ──

function renderSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONTS.sectionHeaderSize);
  doc.setTextColor(...COLORS.textDark);
  doc.text(title, PAGE.marginLeft, y + 4);

  // Subtle underline
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE.marginLeft, y + 6, PAGE.width - PAGE.marginRight, y + 6);

  return y + 12;
}

function getCardBgColor(color: string): [number, number, number] {
  switch (color) {
    case 'green': return COLORS.greenBg;
    case 'yellow': return COLORS.yellowBg;
    case 'red': return COLORS.redBg;
    default: return COLORS.neutralBg;
  }
}

function getCardBorderColor(color: string): [number, number, number] {
  switch (color) {
    case 'green': return [187, 247, 208];
    case 'yellow': return [253, 230, 138];
    case 'red': return [254, 202, 202];
    default: return COLORS.border;
  }
}

function getCardTextColor(color: string): [number, number, number] {
  switch (color) {
    case 'green': return COLORS.green;
    case 'yellow': return COLORS.yellow;
    case 'red': return COLORS.red;
    default: return COLORS.textDark;
  }
}
