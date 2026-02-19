import html2canvas from 'html2canvas';

/**
 * Capture a dashboard panel as a PNG for PDF export.
 *
 * Instead of forcing fixed capture dimensions (which crops content),
 * we capture at the element's actual rendered size. This ensures
 * axis labels, legends, and wide charts are never clipped.
 *
 * The only parameter we control is `scale` (2x for crisp retina output).
 * The PDF generator handles fitting the image to the page.
 */
export async function captureChartForExport(
  panelId: string,
  title: string
): Promise<{ panelId: string; title: string; dataUrl: string; aspectRatio: number } | null> {
  const element = document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement | null;
  if (!element) return null;

  try {
    // Use the element's actual rendered dimensions — no cropping
    const rect = element.getBoundingClientRect();

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      // Scroll the element into the capture viewport
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      ignoreElements: (el) => {
        return el.classList?.contains('recharts-tooltip-wrapper') ||
               el.classList?.contains('tooltip');
      },
    });

    const dataUrl = canvas.toDataURL('image/png');
    return {
      panelId,
      title,
      dataUrl,
      aspectRatio: rect.width / rect.height,
    };
  } catch (error) {
    console.error(`Failed to capture chart ${panelId}:`, error);
    return null;
  }
}
