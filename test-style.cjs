const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://clinicflow-platform.vercel.app/', { waitUntil: 'networkidle' });
  
  const bg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  
  const h1Class = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? window.getComputedStyle(h1).fontSize : 'none';
  });

  console.log('Body background-color:', bg);
  console.log('H1 font-size:', h1Class);
  
  await browser.close();
})();
