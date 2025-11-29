

document.getElementById("chatForm").addEventListener("submit", function(e) {
    e.preventDefault();  
    sendMessage();
});



async function sendMessage() {
  const input = document.getElementById("userInput");
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";

  showTyping();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    removeTyping();

    if (!res.ok) {
      throw new Error("Network response was not ok");
    }

    // Create bot message container
    const messageDiv = createMessageElement("", "bot");
    
    // Read the stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let botResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          
          if (data === "[DONE]") {
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              botResponse += parsed.content;
              messageDiv.innerText = botResponse;
              
              // Auto-scroll
              const box = document.getElementById("chat-box");
              box.scrollTop = box.scrollHeight;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    removeTyping();
    addMessage("Sorry, there was an error processing your request.", "bot");
    console.error("Error:", error);
  }
}

function addMessage(text, type) {
  const messageDiv = createMessageElement(text, type);
  // Message already added to DOM by createMessageElement
}

function createMessageElement(text, type) {
  const box = document.getElementById("chat-box");

  const div = document.createElement("div");
  div.classList.add("message", type === "user" ? "user-message" : "bot-message");
  div.innerText = text;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  
  return div;
}

function showTyping() {
  const box = document.getElementById("chat-box");

  const typing = document.createElement("div");
  typing.classList.add("typing");
  typing.id = "typing";

  typing.innerHTML = `
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  `;

  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;
}

function removeTyping() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();
}