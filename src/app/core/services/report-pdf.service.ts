import { Injectable } from '@angular/core';

export interface ReportPdfOptions {
  root: HTMLElement;
  title: string;
  period: string;
  language: 'ar' | 'en';
  portrait: boolean;
  fileName: string;
  progress?: (done: number, total: number) => void;
}

/** Export a separate snapshot, so responsive filters and current scroll positions never crop a report. */
@Injectable({ providedIn: 'root' })
export class ReportPdfService {
  async download(options: ReportPdfOptions): Promise<void> {
    const clone = options.root.cloneNode(true) as HTMLElement;
    const [{ jsPDF }, { toCanvas, getFontEmbedCSS }] = await Promise.all([import('jspdf'), import('html-to-image')]);
    await document.fonts.ready;
    const stage = document.createElement('div');
    stage.className = 'pdf-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.inert = true;
    clone.classList.add('pdf-export');
    clone.style.width = options.portrait ? '820px' : '1180px';
    stage.append(clone);
    options.root.parentElement!.append(stage);
    try {
      clone.querySelectorAll('.sidebar,.topbar,.auth-panel,.report-view-switch,.year-strip,.filter-rail,.section-nav,.notice,.site-footer,.print-header,.pdf-status,.comparison-filters,.year-comparison > form,.pl-share-picker,.monthly-share-picker,.customer-controls').forEach((element) => element.remove());
      this.expandWideCharts(clone);
      const content = clone.querySelector<HTMLElement>('.canvas,.reference-content,.monthly-comparison,.year-comparison');
      if (!content) throw new Error('No report content to export.');
      const blocks = options.portrait
        ? Array.from(content.querySelectorAll<HTMLElement>('.reference-sheet'))
        : Array.from(content.querySelectorAll<HTMLElement>('.summary,.context-line,.section-heading,.chart,.comparison-header,.year-comparison > header,.year-comparison > .table-scroll,.year-comparison > .legend,.customer-data-note,.comparison-period,.customer-selected-heading,.customer-selected-metrics'))
          .filter((element) => !element.parentElement?.closest('.chart'));
      if (!blocks.length) throw new Error('No report blocks to export.');

      const header = document.createElement('div');
      header.className = 'pdf-page-heading';
      header.dir = 'ltr';
      const logo = document.createElement('img');
      logo.src = new URL('logo.jpg', document.baseURI).href;
      logo.alt = 'First Premium Support Services';
      const heading = document.createElement('div');
      const company = document.createElement('strong');
      company.textContent = 'First Premium Support Services';
      company.dir = 'ltr';
      const title = document.createElement('span');
      title.textContent = options.title;
      title.dir = options.language === 'ar' ? 'rtl' : 'ltr';
      title.style.textAlign = 'left';
      const period = document.createElement('bdi');
      period.textContent = options.period;
      period.dir = 'ltr';
      heading.append(company, title, period);
      header.append(logo, heading);
      clone.prepend(header);
      await logo.decode();
      const fontEmbedCSS = await getFontEmbedCSS(clone, { preferredFontFormat: 'woff2' });
      const config = { backgroundColor: '#ffffff', pixelRatio: 2, fontEmbedCSS };
      const headerCanvas = await toCanvas(header, config);
      const headerImage = headerCanvas.toDataURL('image/png');
      headerCanvas.width = headerCanvas.height = 1;
      const pdf = new jsPDF({ orientation: options.portrait ? 'portrait' : 'landscape', unit: 'mm', format: 'a4', compress: true });
      pdf.setProperties({ title: options.title, author: 'First Premium Support Services', subject: options.period, creator: 'Codit Reports' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12, headerHeight = options.portrait ? 24 : 21;
      const startY = margin + headerHeight + 6;
      const bottomY = pageHeight - 15;
      const availableWidth = pageWidth - margin * 2;
      let position = startY;
      const addHeader = () => {
        pdf.addImage(headerImage, 'PNG', margin, margin, availableWidth, headerHeight, 'company-header', 'FAST');
        pdf.setDrawColor(13, 141, 181);
        pdf.setLineWidth(.4);
        pdf.line(margin, margin + headerHeight + 2, pageWidth - margin, margin + headerHeight + 2);
      };
      const nextPage = () => { pdf.addPage(); position = startY; addHeader(); };
      addHeader();
      for (const [index, block] of blocks.entries()) {
        options.progress?.(index + 1, blocks.length);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const bounds = block.getBoundingClientRect();
        if (!bounds.width || !bounds.height) continue;
        const mmPerPixel = availableWidth / bounds.width;
        const totalHeight = Math.ceil(bounds.height);
        const blockHeight = totalHeight * mmPerPixel;
        const fullPageHeight = bottomY - startY;
        if (options.portrait && index > 0 && position > startY) nextPage();
        if (blockHeight <= fullPageHeight && position + blockHeight > bottomY) nextPage();
        // Keep section headings with the next chart rather than alone at the bottom of a page.
        if (block.matches('.section-heading,.comparison-header') && bottomY - position < blockHeight + 40) nextPage();
        const breaks = this.safeBreaks(block);
        let offset = 0;
        while (offset < totalHeight) {
          let remaining = Math.floor((bottomY - position) / mmPerPixel);
          if (remaining < 40) { nextPage(); remaining = Math.floor((bottomY - position) / mmPerPixel); }
          let height = Math.min(totalHeight - offset, remaining);
          if (offset + height < totalHeight) {
            const boundary = breaks.filter((point) => point > offset + height * .45 && point <= offset + height).at(-1);
            if (boundary) height = boundary - offset;
          }
          const wrapper = document.createElement('div');
          wrapper.style.cssText = `position:relative;overflow:hidden;width:${bounds.width}px;height:${height}px;background:white;`;
          const originalStyle = block.getAttribute('style');
          block.before(wrapper);
          wrapper.append(block);
          block.style.setProperty('position', 'relative', 'important');
          block.style.setProperty('top', `${-offset}px`, 'important');
          block.style.setProperty('margin', '0', 'important');
          block.style.setProperty('width', `${bounds.width}px`, 'important');
          let canvas: HTMLCanvasElement;
          try { canvas = await toCanvas(wrapper, config); }
          finally {
            wrapper.replaceWith(block);
            if (originalStyle === null) block.removeAttribute('style'); else block.setAttribute('style', originalStyle);
          }
          pdf.addImage(canvas.toDataURL('image/jpeg', .94), 'JPEG', margin, position, availableWidth, height * mmPerPixel, undefined, 'FAST');
          canvas.width = canvas.height = 1;
          position += height * mmPerPixel;
          offset += height;
          if (offset < totalHeight) nextPage();
        }
        position += block.matches('.section-heading,.context-line') ? 2 : 6;
      }
      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        pdf.setPage(page);
        pdf.setDrawColor(225, 233, 240);
        pdf.setLineWidth(.2);
        pdf.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(116, 136, 153);
        pdf.text('Powered by Codit  |  +20 114 491 8857', margin, pageHeight - 6);
        pdf.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      }
      await pdf.save(options.fileName, { returnPromise: true });
    } finally {
      stage.remove();
    }
  }

  private safeBreaks(block: HTMLElement): number[] {
    const top = block.getBoundingClientRect().top;
    return [...new Set(Array.from(block.querySelectorAll<HTMLElement>('tr,.reference-chart,.centre-performance-row,.top-customer,.customer-rank-row,.account-bar,.customer-list-row,.columns,.customer-months,.pl-margin-columns,.pdf-column-group,.year-summary,.reference-columns,.customer-period-row,.customer-service-row'))
      .filter((element) => element.offsetHeight)
      .map((element) => Math.ceil(element.getBoundingClientRect().bottom - top) + 2))].sort((a, b) => a - b);
  }

  private expandWideCharts(root: HTMLElement): void {
    for (const element of root.querySelectorAll<HTMLElement>('.monthly-columns,.pl-margin-columns,.customer-months,.comparison-bars,.profit-columns,.expense-columns')) {
      const columns = Array.from(element.children);
      const groups: HTMLElement[] = [];
      for (let first = 0; first < columns.length; first += 12) {
        const group = element.cloneNode(false) as HTMLElement;
        const chunk = columns.slice(first, first + 12);
        group.classList.add('pdf-column-group');
        group.style.setProperty('display', 'grid', 'important');
        group.style.setProperty('grid-template-columns', `repeat(${chunk.length},minmax(0,1fr))`, 'important');
        group.append(...chunk);
        groups.push(group);
      }
      if (groups.length) element.replaceWith(...groups);
    }
    for (const table of root.querySelectorAll<HTMLTableElement>('.pl-share-table,.monthly-share-table,.heat-table')) {
      const count = table.rows[0]?.cells.length ?? 0;
      if (count <= 13) continue;
      const groups: HTMLTableElement[] = [];
      for (let first = 1; first < count; first += 12) {
        const group = table.cloneNode(true) as HTMLTableElement;
        for (const row of Array.from(group.rows)) {
          Array.from(row.cells).forEach((cell, index) => { if (index > 0 && (index < first || index >= first + 12)) cell.remove(); });
        }
        groups.push(group);
      }
      table.replaceWith(...groups);
    }
  }
}
