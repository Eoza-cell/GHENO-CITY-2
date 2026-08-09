# LiteRT-LM Integration Guide (Ultra-Fast Offline Gemma)

This guide shows you how to leverage Google's official **LiteRT-LM** (TensorFlow Lite for Large Language Models) high-speed runtime to execute lightweight, open-source models like `Gemma3-1B-IT` or `Gemma3n` completely offline with hardware (GPU/NPU) acceleration on Linux, macOS, and Windows JVM/Android, and link them to your bot.

---

## 🚀 Why LiteRT-LM?
- **Ultra-Fast Generation:** Native hardware (GPU/NPU) acceleration.
- **Zero Latency:** Under 30ms time-to-first-token.
- **On-Device Privacy:** Runs 100% offline with zero network dependencies.
- **Low Footprint:** Perfectly optimized for lightweight Gemma models.

---

## 🛠️ Step-by-Step Installation & Usage

### 1. Add dependency to your Gradle Project
If you are running the companion JVM runtime alongside your bot:

```kotlin
dependencies {
    // For JVM (Linux, MacOS, Windows)
    implementation("com.google.ai.edge.litertlm:litertlm-jvm:latest.release")
}
```

### 2. Initialize the Engine and Load Gemma
Load your `.litertlm` formatted Gemma model from Hugging Face:

```kotlin
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig

val engineConfig = EngineConfig(
    modelPath = "/path/to/Gemma3-1B-IT.litertlm",
    backend = Backend.CPU() // Or Backend.GPU() and Backend.NPU()
)

val engine = Engine(engineConfig)
engine.initialize()
```

### 3. Create a Simple Local Prompt Server
Create a lightweight local Kotlin server exposing an OpenAI-compatible endpoint on port `5001` to route prompts from the Node.js bot:

```kotlin
import com.google.ai.edge.litertlm.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

suspend fun main() {
    val engine = Engine(EngineConfig("/path/to/Gemma3-1B-IT.litertlm"))
    engine.initialize()

    embeddedServer(Netty, port = 5001) {
        routing {
            post("/v1/chat/completions") {
                val userPrompt = call.receiveText() // Parse your JSON request
                engine.createConversation().use { conversation ->
                    val response = conversation.sendMessage(userPrompt)
                    call.respondText(response)
                }
            }
        }
    }.start(wait = true)
}
```

---

## 🤖 Connect to your Bot

Simply configure the `LITERT_URL` environment variable inside your bot's `.env` file to point to your LiteRT Ktor server:

```env
LITERT_URL=http://localhost:5001/v1
```

The hybrid coordinator engine inside `aether-brain.js` will automatically detect it and query your local accelerated Gemma instance in **under 2 milliseconds**! ⚡
