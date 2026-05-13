const fetch = require('node-fetch');

(async () => {
  const res = await fetch('https://aygdawwqjpbemzonevqg.supabase.co/functions/v1/identify-species', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sb_publishable_4PaDR181sXCuPsLMD3ayUw_Hc6VoJ2c'
    },
    body: JSON.stringify({ base64Image: "fake" })
  });
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response:", text);
})();
