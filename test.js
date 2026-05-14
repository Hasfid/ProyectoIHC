const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
const prompt = 'Act as a biologist. Return empty JSON {"candidates":[]} if image is missing.';
const payload = {
    contents: [ { parts: [ { text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: base64Image } } ] } ],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.2 }
};
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=AIzaSyAOYBZRskY8hIC1WiBPo9hswxICHZsQKbM', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
}).then(res => res.json()).then(console.log).catch(console.error);
