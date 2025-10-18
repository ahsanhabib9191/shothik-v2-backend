
const colors = require('colors');


const txt = `Water is a fundamental element essential for life on Earth, covering about 71% of the planet's surface. It exists in various forms, from oceans and rivers to glaciers and groundwater, sustaining ecosystems and human civilization alike. With its unique properties, water plays a crucial role in regulating the Earth's climate, supporting biodiversity, and shaping landscapes through erosion and deposition. Access to clean water is a basic human right, yet many communities around the world face challenges due to pollution, scarcity, and inequitable distribution. Thus, safeguarding water resources and promoting sustainable water management practices are imperative for the well-being of both present and future generations.

`;


// require prepositions
const { prepositions }  = require('./data/preposition');
const { huggingFace } = require('./huggingface/transformText-with-hug-face');


function replacePrepositionWithRandomSynonym(line) {
    Object.keys(prepositions).forEach(preposition => {
        if (line.includes(preposition)) {
            // Get a random synonym for the found preposition

            console.log('Found preposition:'.bgWhite.bgBlue, preposition);
            // new line 
            console.log('\n');

            const synonyms = prepositions[preposition];
            const randomSynonym = synonyms[Math.floor(Math.random() * synonyms.length)];
            // Replace the preposition in the line with the random synonym
            line = line.replace(preposition, randomSynonym);
        }
    });
    return line;
}

function reverseAnd(sentence) {
    let andIndex = sentence.indexOf(" and ");
    let ampersandIndex = sentence.indexOf("&");

    if ((andIndex !== -1 && sentence.indexOf(" and ", andIndex + 1) === -1) ||
        (ampersandIndex !== -1 && sentence.indexOf("&", ampersandIndex + 1) === -1)) {
        if (andIndex !== -1) {
            let parts = sentence.split(" and ");
            return `${parts[1]} & ${parts[0]}`;
        } else if (ampersandIndex !== -1) {
            let parts = sentence.split("&");
            return `${parts[1]} & ${parts[0]}`;
        }
    }
    
    return sentence;
}

function humanizeCustomization(line) {
    // new line
    console.log('\n');
    // console.log('Working on line:'.bgWhite.bgBlue, String(line).bold);
    console.log('\n');
    // split every words

    line = replacePrepositionWithRandomSynonym(line);
    line = reverseAnd(line);



    const splited = String(line).split(' ');
    const modifiedWords = splited.map(word => modifyWord(word));
    const modifiedLine = modifiedWords.join(' ');
    return modifiedLine;
}



function modifyWord(word){
    // console.log('Working on word:'.bgWhite.bgBlue, String(word).bold);
    // trim and replace blank spaces
    word = String(word).trim().replace(' ', '');
    
    // replace and to &

    console.log('Working on word:'.bgWhite.bgBlue, String(word).bold);

      // Check if the word is a preposition by looking through the keys of the prepositions object
    if (Object.keys(prepositions).includes(word)) {
        console.log('Found a preposition:'.bgWhite.bgBlue, String(word).bold);
    }


    return word;

}


function extractLines(txt){
    const splited = String(txt).split('.');
    const lines = splited.filter(line => String(line).replace(' ', '') !== "").map(line => line.trim());
    // remove empty lines 
    const filteredLines = lines.filter(line => String(line).length > 2 )
    return filteredLines;
}

// Start 
async function Start(){

    try {
        console.log(`\n`);
        var text = txt;
        const huggingFaceResponse = await huggingFace(txt);
        if(huggingFaceResponse.length > 0){
            text = huggingFaceResponse[0].generated_text;
        }

        const lines = extractLines(text);
        const humanizedLines = lines.map(line => humanizeCustomization(line));

        console.log(
            '================================='
        )
        console.log(humanizedLines.join('. ')+'. ')
        console.log(
            '================================='
        )

    } catch (error) {
        console.log(error)
    }


}

// start the function 
// Start();
