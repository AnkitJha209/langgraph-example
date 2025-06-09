import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import dotenv from 'dotenv'
import OpenAI from "openai";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

const StateAnnotation = Annotation.Root({
    query: Annotation<string>({
        reducer: (_prev, next) => next,
        default: () => "",
    }),
    llm_response: Annotation<string | null>({
        reducer: (_prev, next) => next,
        default: () => null,
    }),
    isCodingquestion: Annotation<boolean>({
        reducer: (_prev, next) => next,
        default: () => false,
    }),
    accuracyOfCode: Annotation<string>({
        reducer: (_prev, next) => next,
        default: () => "",
    }),
});



export const nodeOneClassify = async (state: typeof StateAnnotation.State) => {
    const query = state.query;

    const SYSTEM_PROMPT = `
        You are an AI assistant. Your job is to detect if the user's query is
        related to coding or not. Reply only with true or false.
    `;

    const result = await client.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query },
        ],
    });
    console.log(result.choices[0].message.content)

    const content = result.choices[0].message.content?.toLowerCase().trim();
    state.isCodingquestion = content === "true";
    return state;
};

export const nodeTwoRouting = async (state: typeof StateAnnotation.State) => {
    return state.isCodingquestion ? "three" : "four";
};

export const nodeThree = async (state: typeof StateAnnotation.State) => {
    const query = state.query;
    const SYSTEM_PROMPT = `
        You are an Expert Coding AI Agent. The code should be small and concise and should be in string format 
        Example: 
        "function(a,b){ \n let sum = a+b \n console.log(sum) \n return }"
    `;

    const response = await client.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query },
        ],
    });
    console.log(response.choices[0].message.content)

    state.llm_response = response.choices[0].message.content ?? "";
    return state;
};

export const nodeFourGeneralize = async (state: typeof StateAnnotation.State) => {
    const query = state.query;

    const response = await client.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: query }],
    });
    console.log(response.choices[0].message.content)

    state.llm_response = response.choices[0].message.content ?? "";
    return state;
};

export const nodeFiveReviewCode = async (state: typeof StateAnnotation.State) => {
    const { query, llm_response } = state;
    console.log(query)
    const SYSTEM_PROMPT = `
        You are an expert code reviewer. Assess the accuracy of the following code based on the user's query.
        The result should be in string format
        User Query: ${query}
        LLM Response: ${llm_response}
        
        Example 
        accuracy = "95%"
    `;
    console.log(SYSTEM_PROMPT)

    const response = await client.chat.completions.create({
        model: "gemini-2.0-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }],
    });
    console.log("hii three")
    console.log(response.choices[0].message.content)

    state.accuracyOfCode = response.choices[0].message.content as string;
    return state;
};

const workflow = new StateGraph(StateAnnotation)
    .addNode("one", nodeOneClassify)
    .addNode("three", nodeThree)
    .addNode("four", nodeFourGeneralize)
    .addNode("five", nodeFiveReviewCode)
    .addEdge(START, "one")
    .addConditionalEdges("one", nodeTwoRouting)
    .addEdge("three", "five")
    .addEdge("five", END)
    .addEdge("four", END)

const graph = workflow.compile();

export async function complex() {
    const result = await graph.invoke({
        query: "write me a code to add two number in js",
        llm_response: null,
        isCodingquestion: false,
        accuracyOfCode: "",
    });

    console.log("Result:", result);
}
