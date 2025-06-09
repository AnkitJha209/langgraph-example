import { Annotation, END, messagesStateReducer, START, StateGraph } from "@langchain/langgraph";
import OpenAI from "openai";
import dotenv from 'dotenv'

dotenv.config()

const client = new OpenAI({
    apiKey: process.env.GOOGLE_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});
const StateAnnotation  = Annotation.Root({
    query: Annotation<string>({
        reducer: (prev: string, next: string) => next,
        default: () => ""       
    }),
    llm_response: Annotation<string | null>({
        reducer: (prev: string| null, next: string | null) => next,
        default: () => null
    })
})

export const nodeOne = async (state: typeof StateAnnotation.State) => {
  let query = state.query
  let llm_response = await client.chat.completions.create({
    model: 'gemini-2.0-flash',
    messages: [{'role': 'user', 'content': query}]
  })
  const result = llm_response.choices[0].message.content
  state.llm_response = result
  return state
}


const workflow = new StateGraph(StateAnnotation)
.addNode("one", nodeOne)

.addEdge(START, "one")
.addEdge("one", END)


const graph = workflow.compile()



async function main(){
    const result = await graph.invoke({
        query: 'What is javascript give me answer in one line',
        llm_response: null
    })
    console.log("Result : ", result)
}

main();