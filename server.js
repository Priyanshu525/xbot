require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

const app = express();
app.use(bodyParser.json());

const cors = require('cors');
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server is UP and RUNNING");
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/chat", async (req, res) => {
  try {
    const { conversation } = req.body;
    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ error: "conversation (array) is required" });
    }

    // Get the last few messages for context (both user and assistant)
    const recentMessages = conversation.slice(-6); // Last 3 exchanges

    // Classify intent based on the full conversation context
    const classification = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `Analyze the conversation history and classify the user's current intent. 
          Consider both what the user said AND what the assistant previously said.
          
          Respond with ONLY one of these words:
          - "positive": if user wants to buy, join, or is interested 
          - "neutral": if user is asking questions or needs more info  
          - "negative": if user is rejecting or not interested
          - "confused": if user doesn't understand or needs clarification
          - "followup": if user is responding to assistant's previous question
          - "positive_completed": if the user has already agreed, accepted the offer, or said they joined/done`

        },
        { 
          role: "user", 
          content: `Full conversation context: ${JSON.stringify(recentMessages)}. Classify the user's intent:` 
        },
      ],
      temperature: 0.1
    });

    const intent = classification.choices[0].message.content.trim().toLowerCase();

    // Generate response based on full conversation context
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You're a friendly, natural-sounding sales assistant for a trading community. 
          You're talking to someone on Twitter. Be conversational and human-like.
          
          Important context from the conversation: ${JSON.stringify(recentMessages)}
          
          Guidelines:
          1. If they're positive/ready to join: Send this exact and full message exactly like this: "Awesome, It’s quite simple, just access our Bullman telegram support, fill in your details, and our team will connect with you soon. \n Click this link to access our telegramsupport  and join our free channel:https://t.me/bullmansupport_bot" 
          2. If they're asking questions: Answer helpfully, highlight benefits
          3. If they're confused: Clarify simply, ask if they need more explanation
          4. If they're negative: Be polite and leave door open
          5. Always maintain conversation flow and reference previous messages when appropriate
          6. Keep responses concise and one liners.
          7. Sound like genZ american native language and always response like human dont tell too much about the product.
          8. After explaining the product working's, just ask would you be open for it?.
          9. Dont use emojis in the response.
          10. If user is positive_completed: then you can just ask them : "Let me know when its done".
          
          Sound like a real person - use casual language, and natural responses.
          Don't be robotic or use corporate jargon.`
        },
        {
          role: "user",
          content: `Based on the conversation history above, craft a natural response. 
          The user's apparent intent is: ${intent}`
        }
      ],
      temperature: 0.7
    });

    const reply = response.choices[0].message.content;

    res.json({ 
      reply: reply,
      intent 
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      reply: "Hey, sorry - having a bit of a technical moment here. Could you try that again? 😅",
      intent: "neutral"
    });
  }
});


app.listen(3000, () => console.log("Bot running on port 3000"));
