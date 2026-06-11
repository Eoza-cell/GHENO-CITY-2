const { cleanAIResponse } = require('./ai-utils');

const mockResponses = [
    "data: {\"narrative\": \"Test\", \"actions\": []}",
    "data:   {\"narrative\": \"Multiple data\", \"actions\": []}\ndata: [DONE]",
    "Normal text",
    "```json\n{\"narrative\": \"Markdown\"}\n```"
];

mockResponses.forEach(res => {
    console.log("Original:", JSON.stringify(res));
    console.log("Cleaned:", JSON.stringify(cleanAIResponse(res)));
    console.log("---");
});
