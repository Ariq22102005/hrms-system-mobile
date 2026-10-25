/** Print only the generated payslip; expo-print web prints the current application page. */
export function printPayslipWeb(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = 'PTI payslip'; frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0' });
    let cleanupTimer: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(cleanupTimer); frame.remove(); };
    frame.onload = () => {
      try {
        if (!frame.contentWindow) throw new Error('Print window unavailable');
        frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
        frame.contentWindow.focus(); frame.contentWindow.print(); resolve();
        cleanupTimer = setTimeout(cleanup, 60000);
      } catch (error) { cleanup(); reject(error); }
    };
    frame.onerror = () => { cleanup(); reject(new Error('Payslip could not be prepared')); };
    frame.srcdoc = html; document.body.append(frame);
  });
}
