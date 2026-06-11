function cleanup(t) {
    return t.replace(/data:\s*\[DONE\]/gi, "")
            .replace(/^data:\s*/gm, "")
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .replace(/^(json|JSON)/g, '')
            .trim();
}

function extract(content) {
    let aiResponse = { narrative: "", actions: [] };
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
        const potentialJson = content.substring(firstBrace, lastBrace + 1);
        try {
            aiResponse = JSON.parse(potentialJson);
        } catch (e) {
            console.log("Parse error, using fallback");
        }
    }

    if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
        let textBefore = firstBrace !== -1 ? content.substring(0, firstBrace).trim() : "";
        let textAfter = lastBrace !== -1 ? content.substring(lastBrace + 1).trim() : "";

        textBefore = cleanup(textBefore);
        textAfter = cleanup(textAfter);

        if (textBefore.length > 5) aiResponse.narrative = textBefore;
        else if (textAfter.length > 5) aiResponse.narrative = textAfter;
        else if (firstBrace === -1) aiResponse.narrative = cleanup(content);
    }

    if (aiResponse.narrative) {
        aiResponse.narrative = aiResponse.narrative
            .replace(/\{[\s\S]*\}/g, '')
            .replace(/^data:\s*/gm, "")
            .replace(/^```(json|JSON)?/i, "")
            .replace(/```$/i, "")
            .replace(/^(Narrative|Narrateur|MJ|Systeme|Arise|json|JSON)\s*:\s*/i, '')
            .trim();
    }
    return aiResponse;
}

const testContent = "data: {\"narrative\": \"data: Ce que tu vois est faux.\", \"actions\": []}";
console.log("Input:", testContent);
console.log("Output:", JSON.stringify(extract(testContent), null, 2));

const testContent2 = "data: Le narrateur dit :\ndata: {\"actions\": []}\ndata: C'est fini.";
console.log("\nInput 2:", testContent2);
console.log("Output 2:", JSON.stringify(extract(testContent2), null, 2));
