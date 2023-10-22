export class NpcPrompts {
    
    // OPENAI API KEY FROM TIM, DELETE BEFORE PUSHING
    private OPENAI_API_KEY=""
    
    private OPENAI_URL="https://api.openai.com/v1/chat/completions"

    private hunger: {[key: number]: string} = {
        0: "starving", 1: "famished", 2: "ravenous", 3: "hungry", 4: "peckish", 
        5: "content", 6: "satisfied", 7: "full", 8: "stuffed", 9: "overfed",
    };

    private happiness: {[key: number]: string} = {
        0: "miserable", 1: "unhappy", 2: "slightly Content", 3: "content", 4: "happy", 
        5: "joyful", 6: "delighted", 7: "ecstatic", 8: "blissful", 9: "euphoric",
    };

    private belligerent: {[key: number]: string} = {
        0: "peaceful", 1: "calm", 2: "agitated", 3: "irritable", 4: "hostile", 
        5: "combative", 6: "antagonistic", 7: "belligerent", 8: "furious", 9: "enraged",
    };

    private role: {[key: number]: string} = {
        0: "farmer", 1: "miner"
    };
    
    private roleLocation: {[key: number]: string} = {
        0: "Wheat farms", 1: "mines"
    };

    private sex: {[key: number]: string} = {
        0: "male", 1: "female"
    };

    private realmState = {
        "name": "REALM_NAME",
        "defense": "vulnerable",
        happiness: "happy",
    };

    private harvest_descriptions: {[key: number]: string} = {
        0: " begin harvesting the wheat fields.", // 
        1: " begin extracting the earths' mines.",
        2: " head out to the shores, cast your nets, and bring back the riches of the sea."
    };

    // Predefined Prompts taking NPC params into account
    GreetingsRole(npc) {
        return 
            `The lord of your realm has just returned to the city.
            Your hunger state is ${this.hunger[npc.mood.hunger]},
            your happiness state is ${this.happiness[npc.mood.happiness]}
            and your belligerent state is ${this.belligerent[npc.mood.belligerent]}.
            Use these states and the current context of your realm as the characters current feelings without mentioning them directly.
            Address your lord by greeting him from a first-person perspective and share with him your thoughts and feelings.`
        ;
    };

    HarvestRole(npc) {
        return 
            `The lord of your realm has ordered you to ${this.harvest_descriptions[npc.role]}.
            Your hunger state is ${this.hunger[npc.mood.hunger]},
            your happiness state is ${this.happiness[npc.mood.happiness]}
            and your belligerent state is ${this.belligerent[npc.mood.belligerent]}.
            Use these states and the current context of your realm as the characters current feelings without mentioning them directly.
            Respond to your lord about his order from a first-person perspective and share with him your thoughts.
            Keep in mind you cannot refuse his order.`
        ;
    };

    BuildRole(npc) {
        return 
            `The lord has invested in infrastructure and tools for the ${this.roleLocation[npc.role]}. 
            You are tasked with using these new resources to enhance your role as a ${this.role[npc.role]}. 
            Your hunger state is ${this.hunger[npc.mood.hunger]},
            your happiness state is ${this.happiness[npc.mood.happiness]}
            and your belligerent state is ${this.belligerent[npc.mood.belligerent]}.
            Use these states and the current context of your realm as the characters current feelings without mentioning them directly.
            Respond to your lord from a first-person perspective and share with him your thoughts 
            and tell him how these new resources will benefit your work.`
        ;
    };

    VisitRole(npc) {
        return 
            `The lord of your realm is visiting the ${this.roleLocation[npc.role]}. 
            Your hunger state is ${this.hunger[npc.mood.hunger]},
            your happiness state is ${this.happiness[npc.mood.happiness]}
            and your belligerent state is ${this.belligerent[npc.mood.belligerent]}.
            Use these states and the current context of your realm as the characters current feelings without mentioning them directly.
            Address your lord by welcoming him from a first-person perspective and share with him your thoughts`
        ;
    };

    async generatePrompt(promptSystem, promptUser) {

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                // REQUIRED: 1 set or role/content
                "messages": [ { "role": "system", "content": promptSystem, }, { "role": "user", "content": promptUser, }, ],
                
                // REQUIRED
                "model": "gpt-4", // Available models: gpt-4, gpt-4-0613, gpt-4-32k, gpt-4-32k-0613, gpt-3.5-turbo, gpt-3.5-turbo-0613, gpt-3.5-turbo-16k, gpt-3.5-turbo-16k-0613
                
                // OPTIONAL: Fine-tuning our prompts ?
                // "max_tokens": 100, // May be used to limit size of generated prompts. Rough count = 3 words / 4 tokens. OR specify it inside given prompt
                // "temperature": 1, // Between 0 and 2, defaults to 1. (0 -> focused and deterministic, 2 -> random and creative)
                // "top_p": 1, // !!use EITHER 'temperature' or 'top_p'!!. If I understood correctly, basically uses a % based calc for its choice of words. Lower value means less 'exotic' vocab basically
            
                // Generated prompts during testing with:
                // temperature=1,
                // max_tokens=256,
                // top_p=1,
                // frequency_penalty=0,
                // presence_penalty=0
            }),
        };

        try {
            const response = await fetch(this.OPENAI_URL, requestOptions);
            const data = await response.json();
            const generatedPrompt = data.choices[0].message.content.trim();

            console.log(generatedPrompt);
            // Set the msg in village chat history
        
        } catch (error) {
            console.error('Error:', error);
        }
    }

    // Iterate over array of npcs ?
    generateGreetingsPrompts(npcs) {

        // Iterate over every NPC ?
        for (const npc of npcs) {

            const promptSystem = 
                `Imagine yourself as a ${this.sex[npc.sex]} ${this.role[npc.role]} in the medieval realm of ${this.realmState.name}.
                In this realm, your society is deeply involved in mining various minerals,
                sustaining its population through agriculture and fishing, establishing prosperous trade routes,
                and maintaining a robust military defense against potential threats from foreign realms.
                Your realm's military defense is ${this.realmState.defense} and the general sentiment of the populace is ${this.realmState.happiness}.
                Keep the answer under 50 words.`
            ;
            
            this.generatePrompt(promptSystem, this.GreetingsRole(npc));
        }
    }

    // Possible to receive one npc only ?
    generateHarvestPromt(npc) {        
            const promptSystem = 
                `Imagine yourself as a ${this.sex[npc.sex]} ${this.role[npc.role]} in the medieval realm of ${this.realmState.name}.
                In this realm, your society is deeply involved in mining various minerals,
                sustaining its population through agriculture and fishing, establishing prosperous trade routes,
                and maintaining a robust military defense against potential threats from foreign realms.
                Your realm's military defense is ${this.realmState.defense} and the general sentiment of the populace is ${this.realmState.happiness}.
                Keep the answer under 50 words.`
            ;
            
            this.generatePrompt(promptSystem, this.HarvestRole(npc));
        }
        
    generateBuildPrompt(npc) {
        const promptSystem = 
            `Imagine yourself as a ${this.sex[npc.sex]} ${this.role[npc.role]} in the medieval realm of ${this.realmState.name}.
            In this realm, your society is deeply involved in mining various minerals,
            sustaining its population through agriculture and fishing, establishing prosperous trade routes,
            and maintaining a robust military defense against potential threats from foreign realms.
            Your realm's military defense is ${this.realmState.defense} and the general sentiment of the populace is ${this.realmState.happiness}.
            Keep the answer under 50 words.`
        ;
        
        this.generatePrompt(promptSystem, this.BuildRole(npc));
    }

    generateVisitPrompt(npc) {    
        const promptSystem = 
            `Imagine yourself as a ${this.sex[npc.sex]} ${this.role[npc.role]} in the medieval realm of ${this.realmState.name}.
            In this realm, your society is deeply involved in mining various minerals,
            sustaining its population through agriculture and fishing, establishing prosperous trade routes,
            and maintaining a robust military defense against potential threats from foreign realms.
            Your realm's military defense is ${this.realmState.defense} and the general sentiment of the populace is ${this.realmState.happiness}.
            Keep the answer under 50 words.`
        ;
            
        this.generatePrompt(promptSystem, this.VisitRole(npc));
    }
};