import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const LOCAL_CHROME_PATH = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome';

async function getBrowser() {
  if (process.env.VERCEL_ENV) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || LOCAL_CHROME_PATH,
      headless: true,
    });
  }
}

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
