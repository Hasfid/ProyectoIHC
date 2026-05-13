const fetch = require('node-fetch');

(async () => {
  const res = await fetch('https://aygdawwqjpbemzonevqg.supabase.co/functions/v1/identify-species', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ base64Image: "fake" })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
})();
