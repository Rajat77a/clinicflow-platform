fetch('https://clinicflow-platform.vercel.app/')
  .then(r => r.text())
  .then(t => {
    const m = t.match(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/);
    if (m) {
      console.log('Found CSS link:', m[1]);
      fetch(new URL(m[1], 'https://clinicflow-platform.vercel.app/'))
        .then(r => r.text().then(ct => console.log('CSS Status:', r.status, 'Size:', ct.length, 'Content preview:', ct.slice(0, 100))));
    } else {
      console.log('No stylesheet found');
    }
  });
