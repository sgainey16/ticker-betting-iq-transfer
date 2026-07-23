"""One-shot: generate a Fox-Sports-1-style wide studio two-shot for The
Ticker home page using Gemini Nano Banana (gemini-3-pro-image-preview) with
BOTH host portraits as identity references.

Run: python3 generate_studio.py
Output: /app/backend/static/hosts/studio.png
"""
import asyncio
import base64
import os
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv("/app/backend/.env")

STATIC = Path("/app/backend/static/hosts")
REGGIE = STATIC / "reggie_portrait.png"
MARC = STATIC / "marc_portrait.png"
OUT = STATIC / "studio.png"


PROMPT = """A wide cinematic sports television studio shot. Two male hockey
broadcasters are seated behind a large curved black anchor desk together, in
frame from the waist up, with visible physical space between them. The desk
front is glossy black with a bright blue LED underlighting strip that curves
across the whole set. A huge wall of glowing video monitors fills the entire
background — dozens of individual TV screens showing different hockey action
in a subtle blue tint. Dark ambient studio lighting with rim highlights on
both hosts. Both hosts wear tailored dark suits with ties, hands resting on
paper notes on the desk, looking toward each other mid-conversation. On the
front of the desk, in large letters carved-in with blue LED backlight, is
the wordmark 'THE TICKER'. Cinematic 16:7 aspect ratio, professional
broadcast quality, Fox Sports 1 style.

CRITICAL: The host on the LEFT MUST match the man in the FIRST reference
image (younger, dark hair, clean-shaven, mid-30s). The host on the RIGHT
MUST match the man in the SECOND reference image (older, gray hair,
mustache, warm smiling face, 60s). Both faces should be clearly recognizable
as those exact people."""


async def main():
    api_key = os.environ["EMERGENT_LLM_KEY"]

    def b64(path):
        return base64.b64encode(path.read_bytes()).decode("utf-8")

    ref_reggie = b64(REGGIE)
    ref_marc = b64(MARC)

    chat = (
        LlmChat(
            api_key=api_key,
            session_id="ticker-studio-generate-v1",
            system_message="You are an expert broadcast set designer.",
        )
        .with_model("gemini", "gemini-3-pro-image-preview")
        .with_params(modalities=["image", "text"])
    )

    msg = UserMessage(
        text=PROMPT,
        file_contents=[ImageContent(ref_reggie), ImageContent(ref_marc)],
    )

    text, images = await chat.send_message_multimodal_response(msg)
    print(f"Text: {text[:200] if text else '(no text)'}")

    if not images:
        print("❌ No image returned")
        return

    img = images[0]
    print(f"Got image: mime={img['mime_type']}")
    OUT.write_bytes(base64.b64decode(img["data"]))
    print(f"✅ Saved to {OUT}  ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
